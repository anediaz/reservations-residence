  /**
  * Prems — backend V0 (Apps Script).
  * Une seule surface d'API, appelée en POST avec { action, ...payload }.
  * Contrôle de rôle toujours ici, jamais côté frontend.
  */

  var RESIDENTS_SHEET = 'residents'
  var RESERVATIONS_SHEET = 'reservations'
  var AUDIT_LOG_SHEET = 'audit_log'
  var RESOURCES_SHEET = 'resources'

  var HOLD_HOURS = 48

  var ACTIONS = {
    authenticate: handleAuthenticate,
    listRequests: handleListRequests,
    approveRequest: handleApproveRequest,
    refuseRequest: handleRefuseRequest,
    confirmPayment: handleConfirmPayment,
    adminCancel: handleAdminCancel,
    listReservations: handleListReservations,
    blockDates: handleBlockDates,
    listResidents: handleListResidents,
    upsertResident: handleUpsertResident,
    revokeResident: handleRevokeResident,
    deleteResident: handleDeleteResident,
    listResources: handleListResources,
    upsertResource: handleUpsertResource,
    deleteResource: handleDeleteResource,
  }

  function doPost(e) {
    var result
    try {
      var body = JSON.parse(e.postData.contents)
      var handler = ACTIONS[body.action]
      if (!handler) {
        throw new Error('Action inconnue: ' + body.action)
      }
      result = handler(body)
    } catch (err) {
      result = { error: err.message }
    }
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON)
  }

  /**
  * Vérifie le idToken Google (signature, expiration, audience) auprès de
  * Google, puis vérifie que l'email appartient à un résident actif avec le
  * rôle manager. Ne fait jamais confiance au frontend pour le rôle.
  */
  function handleAuthenticate(body) {
    var manager = requireManager(body)
    return { email: manager.email, name: manager.name, role: 'manager' }
  }

  /**
  * Demandes en attente de décision, avec conflits de dates et adresses
  * inconnues signalés — le gestionnaire tranche, il n'a pas à chercher.
  */
  function handleListRequests(body) {
    requireManager(body)

    var all = readSheetAsObjects(RESERVATIONS_SHEET)
    var residentEmails = readSheetAsObjects(RESIDENTS_SHEET).map(function (r) {
      return String(r.email || '').toLowerCase()
    })
    var blocking = all.filter(function (r) {
      return r.status === 'pending_payment' || r.status === 'confirmed' || r.status === 'blocked'
    })

    var requests = all.filter(function (r) {
      return r.status === 'requested'
    })

    return requests.map(function (r) {
      return {
        reservation_id: r.reservation_id,
        reference: r.reference,
        resource_id: r.resource_id,
        requester_email: r.requester_email,
        requester_lot: r.requester_lot,
        requester_contact: r.requester_contact,
        start_at: r.start_at,
        end_at: r.end_at,
        units: r.units,
        amount_total: r.amount_total,
        hasConflict: blocking.some(function (other) {
          return other.resource_id === r.resource_id && datesOverlap(r, other)
        }),
        unknownAddress: residentEmails.indexOf(String(r.requester_email || '').toLowerCase()) === -1,
      }
    })
  }

  /**
  * Passe la demande en pending_payment, bloque le créneau 48h le temps du
  * virement.
  */
  function handleApproveRequest(body) {
    var manager = requireManager(body)
    var found = findRowById(RESERVATIONS_SHEET, 'reservation_id', body.reservationId)
    if (!found || found.record.status !== 'requested') {
      throw new Error('Demande introuvable ou déjà traitée.')
    }

    var holdExpiresAt = new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000)
    var updates = {
      status: 'pending_payment',
      hold_expires_at: holdExpiresAt,
    }

    found.record.hold_expires_at = holdExpiresAt
    var eventId = upsertCalendarEventForReservation(found.record, 'pending_payment')
    if (eventId) {
      updates.calendar_event_id = eventId
    }

    updateRow(RESERVATIONS_SHEET, found.rowNumber, updates)
    appendAuditLog(manager.email, 'request_approved', body.reservationId, '')

    return { ok: true }
  }

  var CALENDAR_EVENT_STYLES = {
    requested: { titlePrefix: 'Demande', color: CalendarApp.EventColor.YELLOW, hex: '#f6c343' },
    pending_payment: { titlePrefix: 'En attente de paiement', color: CalendarApp.EventColor.ORANGE, hex: '#ff9800' },
    confirmed: { titlePrefix: 'Confirmée', color: CalendarApp.EventColor.GREEN, hex: '#43a047' },
    refused: { titlePrefix: 'Refusée', color: CalendarApp.EventColor.RED, hex: '#e53935' },
    cancelled: { titlePrefix: 'Annulée', color: CalendarApp.EventColor.GRAY, hex: '#757575' },
    blocked: { titlePrefix: 'Bloqué', color: CalendarApp.EventColor.BLUE, hex: '#1a73e8' },
  }

  function reservationDisplayRef(reservation) {
    return reservation.reference || reservation.requester_contact || reservation.reservation_id
  }

  /**
  * Crée (ou met à jour, si déjà existant) l'événement sur l'agenda Google de
  * la ressource, avec un titre et une couleur reflétant le statut, puis
  * notifie. Une erreur agenda (ressource sans calendar_id, agenda
  * inaccessible, etc.) ne doit jamais bloquer le traitement de la
  * réservation.
  */
  function upsertCalendarEventForReservation(reservation, status) {
    var resourceRow = findRowById(RESOURCES_SHEET, 'resource_id', reservation.resource_id)
    var calendarId = resourceRow ? resolveCalendarId(resourceRow.record.calendar_id) : ''
    var resourceName = resourceRow ? resourceRow.record.name : reservation.resource_id
    if (!calendarId) {
      notifyReservationStatusChange(reservation, status, resourceName, '', '')
      return ''
    }
    var style = CALENDAR_EVENT_STYLES[status]
    var title = (style ? style.titlePrefix : status) + ' — ' + resourceName + ' — ' + reservationDisplayRef(reservation)
    var eventId = ''
    var eventLink = ''
    try {
      var calendar = CalendarApp.getCalendarById(calendarId)
      var event = reservation.calendar_event_id ? calendar.getEventById(reservation.calendar_event_id) : null
      if (event) {
        event.setTitle(title)
      } else {
        event = calendar.createEvent(title, new Date(reservation.start_at), new Date(reservation.end_at))
      }
      if (style) {
        event.setColor(style.color)
      }
      eventId = event.getId()
      eventLink = getEventHtmlLink(calendarId, event)
    } catch (e) {
      // agenda inaccessible, pas bloquant
    }
    notifyReservationStatusChange(reservation, status, resourceName, calendarId, eventLink)
    return eventId
  }

  function formatDateOnly(value) {
    return Utilities.formatDate(new Date(value), Session.getScriptTimeZone(), 'dd/MM/yyyy')
  }

  function getEventHtmlLink(calendarId, event) {
    try {
      var apiEventId = event.getId().split('@')[0]
      return Calendar.Events.get(calendarId, apiEventId).htmlLink
    } catch (e) {
      return ''
    }
  }

  function getCalendarEditorEmails(calendarId) {
    try {
      var acl = Calendar.Acl.list(calendarId)
      return (acl.items || [])
        .filter(function (rule) {
          return rule.scope && rule.scope.type === 'user' && rule.scope.value &&
            rule.scope.value !== calendarId &&
            (rule.role === 'writer' || rule.role === 'owner')
        })
        .map(function (rule) {
          return rule.scope.value
        })
    } catch (e) {
      return []
    }
  }

  var MANAGER_SUBJECTS = {
    pending_payment: function (resourceName, reference) { return 'Réservation approuvée — virement attendu — ' + resourceName + ' (' + reference + ')' },
    confirmed: function (resourceName, reference) { return 'Virement reçu — réservation confirmée — ' + resourceName + ' (' + reference + ')' },
    refused: function (resourceName, reference) { return 'Demande refusée — ' + resourceName + ' (' + reference + ')' },
    cancelled: function (resourceName, reference) { return 'Réservation annulée — ' + resourceName + ' (' + reference + ')' },
    blocked: function (resourceName) { return 'Dates bloquées — ' + resourceName },
  }

  var REQUESTER_SUBJECTS = {
    pending_payment: function () { return 'Votre demande de réservation est approuvée — virement attendu' },
    confirmed: function (resourceName) { return 'Votre réservation est confirmée — ' + resourceName },
    refused: function () { return 'Votre demande de réservation a été refusée' },
    cancelled: function () { return 'Votre réservation a été annulée' },
  }

  var REQUESTER_STATUS_LABELS = {
    pending_payment: 'Votre réservation est approuvée, en attente de votre virement',
    confirmed: 'Votre réservation est confirmée',
    refused: 'Votre demande de réservation a été refusée',
    cancelled: 'Votre réservation a été annulée',
  }

  function buildEmailHtml(hex, label, rows, eventLink) {
    var htmlRows = rows.map(function (row) {
      return '<tr><td style="padding:4px 12px 4px 0;color:#555;">' + row[0] + '</td><td style="padding:4px 0;font-weight:bold;">' + row[1] + '</td></tr>'
    }).join('')
    return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">' +
      '<p><span style="display:inline-block;background:' + hex + ';color:#fff;padding:4px 12px;border-radius:4px;font-weight:bold;">' + label + '</span></p>' +
      '<table>' + htmlRows + '</table>' +
      (eventLink ? '<p style="margin-top:16px;"><a href="' + eventLink + '">Voir l\'événement dans Google Agenda</a></p>' : '') +
      '</div>'
  }

  function buildEmailText(rows, eventLink) {
    return rows.map(function (row) { return row[0] + ' : ' + row[1] }).join('\n') +
      (eventLink ? '\n\nÉvénement agenda : ' + eventLink : '')
  }

  /**
  * Mail destiné aux comptes éditeurs/propriétaires de l'agenda : contenu
  * orienté suivi/gestion (identité du demandeur, montant, lien agenda).
  */
  function buildManagerNotification(reservation, status, resourceName, reference, dates, label, hex, eventLink) {
    var subjectFn = MANAGER_SUBJECTS[status]
    var subject = subjectFn ? subjectFn(resourceName, reference) : 'Prems — ' + resourceName + ' — ' + label + ' (' + reference + ')'

    var rows = [
      ['Statut', label],
      ['Ressource', resourceName],
      ['Référence', reference],
      ['Dates', dates],
    ]
    if (reservation.requester_lot) {
      rows.push(['Lot', reservation.requester_lot])
    }
    if (reservation.requester_email) {
      rows.push(['Résident', reservation.requester_email])
    }
    if (reservation.amount_total) {
      rows.push(['Montant total', reservation.amount_total + ' €'])
    }

    var appLink = buildReservationAppLink(reservation.reservation_id)
    var textBody = buildEmailText(rows, eventLink) + (appLink ? '\n\nVoir la réservation dans Prems : ' + appLink : '')
    var htmlBody = buildEmailHtml(hex, label, rows, eventLink)
    if (appLink) {
      htmlBody = htmlBody.replace('</div>', '<p style="margin-top:12px;"><a href="' + appLink + '">Voir la réservation dans Prems</a></p></div>')
    }

    return { subject: subject, textBody: textBody, htmlBody: htmlBody }
  }

  /**
  * Lien vers la réservation dans l'espace gestionnaire (onglet Réservations,
  * ligne surlignée via ?reservationId=). `APP_URL` (propriété de script) doit
  * pointer vers la racine déployée de l'app, sous-chemin inclus
  * (ex. https://xxx.github.io/reservations-residence). Absent = pas de lien.
  */
  function buildReservationAppLink(reservationId) {
    var appUrl = PropertiesService.getScriptProperties().getProperty('APP_URL')
    if (!appUrl) {
      return ''
    }
    return appUrl.replace(/\/$/, '') + '/gestionnaire/reservations?reservationId=' + encodeURIComponent(reservationId)
  }

  /**
  * Mail destiné au demandeur : contenu orienté résident (statut reformulé,
  * prochaine étape), pas d'information interne (pas sa propre adresse).
  */
  function buildRequesterNotification(reservation, status, resourceName, reference, dates, label, hex, eventLink, reason) {
    var subjectFn = REQUESTER_SUBJECTS[status]
    var subject = subjectFn ? subjectFn(resourceName) : 'Prems — votre réservation — ' + label

    var requesterLabel = REQUESTER_STATUS_LABELS[status] || label

    var rows = [
      ['Statut', requesterLabel],
      ['Ressource', resourceName],
      ['Dates', dates],
      ['Référence', reference],
    ]
    if (reservation.amount_total) {
      rows.push([status === 'confirmed' ? 'Montant payé' : 'Montant total', reservation.amount_total + ' €'])
    }

    var nextStep = ''
    if (status === 'pending_payment') {
      nextStep = reservation.hold_expires_at
        ? 'Merci d\'effectuer le virement avant le ' + formatDateOnly(reservation.hold_expires_at) + ', sinon la réservation sera automatiquement annulée.'
        : 'Merci d\'effectuer le virement sous ' + HOLD_HOURS + 'h, sinon la réservation sera automatiquement annulée.'
    } else if (status === 'confirmed') {
      nextStep = 'Votre réservation est confirmée, vous n\'avez rien d\'autre à faire.'
    } else if ((status === 'refused' || status === 'cancelled') && reason) {
      nextStep = 'Motif : ' + reason
    }

    var textBody = buildEmailText(rows, eventLink) + (nextStep ? '\n\n' + nextStep : '')
    var htmlBody = buildEmailHtml(hex, requesterLabel, rows, eventLink)
    if (nextStep) {
      htmlBody = htmlBody.replace('</div>', '<p style="margin-top:12px;">' + nextStep + '</p></div>')
    }

    return { subject: subject, textBody: textBody, htmlBody: htmlBody }
  }

  /**
  * Prévient par mail le demandeur et les comptes éditeurs/propriétaires de
  * l'agenda de la ressource à chaque changement de statut d'une réservation,
  * avec un contenu différent pour chacun (voir buildManagerNotification /
  * buildRequesterNotification). `calendarId`/`eventLink`/`reason` optionnels
  * (ex. ressource sans agenda, refus sans motif). Non bloquant : une erreur
  * mail ne doit jamais faire échouer l'action.
  */
  function notifyReservationStatusChange(reservation, status, resourceName, calendarId, eventLink, reason) {
    try {
      var style = CALENDAR_EVENT_STYLES[status]
      var label = style ? style.titlePrefix : status
      var hex = style ? style.hex : '#607d8b'
      var reference = reservationDisplayRef(reservation)
      var dates = formatDateOnly(reservation.start_at) + ' → ' + formatDateOnly(reservation.end_at)

      var editorEmails = (calendarId ? getCalendarEditorEmails(calendarId) : [])
        .filter(function (email) { return email !== reservation.requester_email })

      if (editorEmails.length) {
        var managerMail = buildManagerNotification(reservation, status, resourceName, reference, dates, label, hex, eventLink)
        editorEmails.forEach(function (email) {
          try {
            MailApp.sendEmail({ to: email, subject: managerMail.subject, body: managerMail.textBody, htmlBody: managerMail.htmlBody })
          } catch (e) {
            // adresse invalide ou quota, on continue les autres
          }
        })
      }

      if (reservation.requester_email) {
        var requesterMail = buildRequesterNotification(reservation, status, resourceName, reference, dates, label, hex, eventLink, reason)
        try {
          MailApp.sendEmail({ to: reservation.requester_email, subject: requesterMail.subject, body: requesterMail.textBody, htmlBody: requesterMail.htmlBody })
        } catch (e) {
          // adresse invalide ou quota
        }
      }
    } catch (e) {
      // non bloquant
    }
  }

  /**
  * `calendar_id` peut être l'identifiant brut (xxx@group.calendar.google.com)
  * ou une URL de partage Google Calendar : soit `?src=` (identifiant
  * URL-encodé, lien "intégrer"), soit `?cid=` (identifiant encodé en base64,
  * lien "partager"). On tolère les trois pour l'usage de l'agenda côté API.
  */
  function resolveCalendarId(rawValue) {
    var value = String(rawValue || '').trim()
    if (!value) {
      return ''
    }
    if (!/^https?:\/\//i.test(value)) {
      return value
    }
    var srcMatch = value.match(/[?&]src=([^&]+)/)
    if (srcMatch) {
      try {
        return decodeURIComponent(srcMatch[1])
      } catch (e) {
        return ''
      }
    }
    var cidMatch = value.match(/[?&]cid=([^&]+)/)
    if (cidMatch) {
      try {
        return Utilities.newBlob(Utilities.base64Decode(cidMatch[1])).getDataAsString()
      } catch (e) {
        return ''
      }
    }
    return ''
  }

  function getResourceInfo(resourceId) {
    var resourceRow = findRowById(RESOURCES_SHEET, 'resource_id', resourceId)
    return {
      name: resourceRow ? resourceRow.record.name : resourceId,
      calendarId: resourceRow ? resolveCalendarId(resourceRow.record.calendar_id) : '',
    }
  }

  function handleRefuseRequest(body) {
    var manager = requireManager(body)
    var found = findRowById(RESERVATIONS_SHEET, 'reservation_id', body.reservationId)
    if (!found || found.record.status !== 'requested') {
      throw new Error('Demande introuvable ou déjà traitée.')
    }

    updateRow(RESERVATIONS_SHEET, found.rowNumber, { status: 'refused' })
    appendAuditLog(manager.email, 'request_refused', body.reservationId, body.reason || '')

    var info = getResourceInfo(found.record.resource_id)
    notifyReservationStatusChange(found.record, 'refused', info.name, info.calendarId, '', body.reason || '')

    return { ok: true }
  }

  /**
  * Constate le virement : passe en confirmed. La génération du code de porte
  * et son envoi restent à câbler avec l'API de la serrure (hors scope V0
  * actuel) ; l'échec de cette étape ne doit jamais faire revenir en arrière
  * une réservation déjà payée.
  */
  function handleConfirmPayment(body) {
    var manager = requireManager(body)
    var found = findRowById(RESERVATIONS_SHEET, 'reservation_id', body.reservationId)
    if (!found || found.record.status !== 'pending_payment') {
      throw new Error('Réservation introuvable ou paiement déjà constaté.')
    }

    upsertCalendarEventForReservation(found.record, 'confirmed')
    updateRow(RESERVATIONS_SHEET, found.rowNumber, {
      status: 'confirmed',
      paid_at: new Date(),
    })
    appendAuditLog(manager.email, 'payment_confirmed', body.reservationId, '')

    return { ok: true }
  }

  function handleAdminCancel(body) {
    var manager = requireManager(body)
    var found = findRowById(RESERVATIONS_SHEET, 'reservation_id', body.reservationId)
    if (!found) {
      throw new Error('Réservation introuvable.')
    }

    deleteCalendarEventForReservation(found.record)
    updateRow(RESERVATIONS_SHEET, found.rowNumber, { status: 'cancelled' })
    appendAuditLog(manager.email, 'reservation_cancelled', body.reservationId, body.reason || '')

    var info = getResourceInfo(found.record.resource_id)
    notifyReservationStatusChange(found.record, 'cancelled', info.name, info.calendarId, '', body.reason || '')

    return { ok: true }
  }

  function deleteCalendarEventForReservation(reservation) {
    if (!reservation.calendar_event_id) {
      return
    }
    var resourceRow = findRowById(RESOURCES_SHEET, 'resource_id', reservation.resource_id)
    var calendarId = resourceRow ? resolveCalendarId(resourceRow.record.calendar_id) : ''
    if (!calendarId) {
      return
    }
    try {
      CalendarApp.getCalendarById(calendarId).getEventById(reservation.calendar_event_id).deleteEvent()
    } catch (e) {
      // agenda déjà nettoyé ou inaccessible, pas bloquant
    }
  }

  /**
  * Bloque des dates sur une ressource (travaux, AG, ménage exceptionnel) :
  * créé comme une réservation de statut "blocked", pour profiter des mêmes
  * contrôles de conflit que les réservations résidents. Levée via adminCancel.
  */
  function handleBlockDates(body) {
    var manager = requireManager(body)
    var resourceId = String(body.resourceId || '').trim()
    if (!resourceId) {
      throw new Error('Ressource manquante.')
    }
    if (!body.startAt || !body.endAt || new Date(body.startAt) >= new Date(body.endAt)) {
      throw new Error('Dates invalides.')
    }

    var reservationId = Utilities.getUuid()
    var record = {
      reservation_id: reservationId,
      resource_id: resourceId,
      start_at: new Date(body.startAt),
      end_at: new Date(body.endAt),
      status: 'blocked',
      requester_contact: body.reason || '',
    }
    var eventId = upsertCalendarEventForReservation(record, 'blocked')
    if (eventId) {
      record.calendar_event_id = eventId
    }

    appendRowByHeader(RESERVATIONS_SHEET, record)
    appendAuditLog(manager.email, 'dates_blocked', reservationId, body.reason || '')

    return { ok: true, reservation_id: reservationId }
  }

  function handleListReservations(body) {
    requireManager(body)
    var all = readSheetAsObjects(RESERVATIONS_SHEET)
    var status = body.filters && body.filters.status
    var filtered = status ? all.filter(function (r) { return r.status === status }) : all
    return filtered.sort(function (a, b) {
      return new Date(b.start_at) - new Date(a.start_at)
    })
  }

  /**
  * Liste des résidents et gestionnaires connus. Le mot de passe / token n'y
  * figure jamais : seul l'email Google fait foi.
  */
  function handleListResidents(body) {
    requireManager(body)
    return readSheetAsObjects(RESIDENTS_SHEET).sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }

  /**
  * Crée ou met à jour un résident. Si resident_id est fourni et existe,
  * met à jour la ligne ; sinon crée une nouvelle ligne avec un id généré.
  */
  function handleUpsertResident(body) {
    var manager = requireManager(body)
    var resident = body.resident || {}
    var email = String(resident.email || '').trim().toLowerCase()
    if (!email) {
      throw new Error('Email manquant.')
    }
    if (resident.role !== 'resident' && resident.role !== 'admin' && resident.role !== 'super_admin') {
      throw new Error('Rôle invalide.')
    }

    var found = resident.resident_id
      ? findRowById(RESIDENTS_SHEET, 'resident_id', resident.resident_id)
      : null

    if (found) {
      if (found.record.role === 'super_admin' && (resident.role !== 'super_admin' || resident.status === 'inactive')) {
        throw new Error('Le compte super gestionnaire ne peut pas être rétrogradé ni désactivé.')
      }
      if (String(found.record.email || '').toLowerCase() === manager.email && resident.status === 'inactive') {
        throw new Error('Impossible de désactiver votre propre compte.')
      }
      updateRow(RESIDENTS_SHEET, found.rowNumber, {
        email: email,
        lot: resident.lot || '',
        role: resident.role,
        status: resident.status === 'inactive' ? 'inactive' : 'active',
      })
      appendAuditLog(manager.email, 'resident_updated', resident.resident_id, '')
      return { ok: true, resident_id: resident.resident_id }
    }

    var residentId = Utilities.getUuid()
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESIDENTS_SHEET)
    sheet.appendRow([
      residentId,
      email,
      resident.lot || '',
      resident.role,
      'active',
      new Date(),
    ])
    appendAuditLog(manager.email, 'resident_created', residentId, '')
    return { ok: true, resident_id: residentId }
  }

  /**
  * Révoque l'accès d'un résident (status = inactive). On ne supprime jamais
  * la ligne : l'historique des réservations passées doit rester lisible.
  */
  function handleRevokeResident(body) {
    var manager = requireManager(body)
    var found = findRowById(RESIDENTS_SHEET, 'resident_id', body.residentId)
    if (!found) {
      throw new Error('Résident introuvable.')
    }
    if (found.record.role === 'super_admin') {
      throw new Error('Le compte super gestionnaire ne peut pas être révoqué.')
    }
    if (String(found.record.email || '').toLowerCase() === manager.email) {
      throw new Error('Impossible de révoquer votre propre compte.')
    }

    updateRow(RESIDENTS_SHEET, found.rowNumber, { status: 'inactive' })
    appendAuditLog(manager.email, 'resident_revoked', body.residentId, '')

    return { ok: true }
  }

  /**
  * Supprime définitivement la ligne résident (contrairement à revokeResident,
  * qui ne fait que désactiver). À réserver aux comptes créés par erreur : une
  * fois des réservations liées, préférer la révocation.
  */
  function handleDeleteResident(body) {
    var manager = requireManager(body)
    var found = findRowById(RESIDENTS_SHEET, 'resident_id', body.residentId)
    if (!found) {
      throw new Error('Résident introuvable.')
    }
    if (found.record.role === 'super_admin') {
      throw new Error('Le compte super gestionnaire ne peut pas être supprimé.')
    }
    if (String(found.record.email || '').toLowerCase() === manager.email) {
      throw new Error('Impossible de supprimer votre propre compte.')
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESIDENTS_SHEET)
    sheet.deleteRow(found.rowNumber)
    appendAuditLog(manager.email, 'resident_deleted', body.residentId, '')

    return { ok: true }
  }

  /**
  * Liste des ressources réservables (chambre, outils en V2) avec leur
  * configuration : tarifs, forfait ménage, horaires, agenda Google.
  */
  function handleListResources(body) {
    requireManager(body)
    return readSheetAsObjects(RESOURCES_SHEET).map(function (r) {
      return Object.assign({}, r, {
        check_in_time: formatTimeValue(r.check_in_time),
        check_out_time: formatTimeValue(r.check_out_time),
      })
    })
  }

  /**
  * Les cellules au format heure sont lues comme des Date (epoch 1899-12-30) :
  * on les ramène à une chaîne HH:mm, lisible et réutilisable dans <input type="time">.
  */
  function formatTimeValue(value) {
    if (Object.prototype.toString.call(value) === '[object Date]') {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm')
    }
    return value || ''
  }

  /**
  * Crée ou met à jour une ressource. Les règles (tarifs, agenda) sont de la
  * donnée, pas du code : lues à l'exécution, pas en dur.
  */
  function handleUpsertResource(body) {
    var manager = requireManager(body)
    var resource = body.resource || {}
    var resourceId = String(resource.resource_id || '').trim()
    if (!resourceId) {
      throw new Error('Identifiant de ressource manquant.')
    }

    var pricePerUnit = Number(resource.price_per_unit)
    var cleaningFee = Number(resource.cleaning_fee)
    var maxUnits = Number(resource.max_units)
    if (!isFinite(pricePerUnit) || pricePerUnit < 0) {
      throw new Error('Prix par nuit invalide.')
    }
    if (!isFinite(cleaningFee) || cleaningFee < 0) {
      throw new Error('Forfait ménage invalide.')
    }
    if (!isFinite(maxUnits) || maxUnits < 1) {
      throw new Error('Nombre de nuits maximum invalide.')
    }

    var updates = {
      name: resource.name || resourceId,
      calendar_id: resource.calendar_id || '',
      price_per_unit: pricePerUnit,
      cleaning_fee: cleaningFee,
      check_in_time: resource.check_in_time || '',
      check_out_time: resource.check_out_time || '',
      max_units: maxUnits,
    }

    var found = findRowById(RESOURCES_SHEET, 'resource_id', resourceId)
    if (found) {
      updateRow(RESOURCES_SHEET, found.rowNumber, updates)
    } else {
      appendRowByHeader(RESOURCES_SHEET, Object.assign({
        resource_id: resourceId,
        booking_unit: 'nights',
        buffer_minutes: 0,
        lock_id: '',
      }, updates))
    }
    appendAuditLog(manager.email, found ? 'resource_updated' : 'resource_created', resourceId, '')
    return { ok: true, resource_id: resourceId }
  }

  /**
  * Supprime une ressource, seulement si aucune réservation ne la référence
  * (passée ou future) — l'historique des réservations doit rester lisible.
  */
  function handleDeleteResource(body) {
    var manager = requireManager(body)
    var found = findRowById(RESOURCES_SHEET, 'resource_id', body.resourceId)
    if (!found) {
      throw new Error('Ressource introuvable.')
    }

    var inUse = readSheetAsObjects(RESERVATIONS_SHEET).some(function (r) {
      return String(r.resource_id) === String(body.resourceId)
    })
    if (inUse) {
      throw new Error('Cette ressource a des réservations associées, suppression impossible.')
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESOURCES_SHEET)
    sheet.deleteRow(found.rowNumber)
    appendAuditLog(manager.email, 'resource_deleted', body.resourceId, '')

    return { ok: true }
  }

  // --- Authentification / autorisation ---------------------------------

  function requireManager(body) {
    var idToken = body.idToken
    if (!idToken) {
      throw new Error('idToken manquant.')
    }

    var payload = verifyGoogleIdToken(idToken)
    var email = String(payload.email || '').toLowerCase()
    if (!payload.email_verified || !email) {
      throw new Error('Email Google non vérifié.')
    }

    var resident = findResidentByEmail(email)
    var hasManagerRole = resident && (resident.role === 'admin' || resident.role === 'super_admin')
    if (!resident || !hasManagerRole || resident.status !== 'active') {
      throw new Error('Ce compte n\'a pas les droits gestionnaire.')
    }

    return { email: email, name: payload.name || email }
  }

  function verifyGoogleIdToken(idToken) {
    var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID')
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID absent des propriétés du script.')
    }

    var response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    )
    if (response.getResponseCode() !== 200) {
      throw new Error('Jeton Google invalide ou expiré.')
    }

    var payload = JSON.parse(response.getContentText())
    if (payload.aud !== clientId) {
      throw new Error('Jeton Google destiné à une autre application.')
    }

    return payload
  }

  function findResidentByEmail(email) {
    var residents = readSheetAsObjects(RESIDENTS_SHEET)
    for (var i = 0; i < residents.length; i++) {
      if (String(residents[i].email || '').toLowerCase() === email) {
        return residents[i]
      }
    }
    return null
  }

  // --- Aide-cycle réservation --------------------------------------------

  function datesOverlap(a, b) {
    return new Date(a.start_at) < new Date(b.end_at) && new Date(b.start_at) < new Date(a.end_at)
  }

  function appendAuditLog(actor, action, target, detail) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_LOG_SHEET)
    sheet.appendRow([new Date(), actor, action, target, detail])
  }

  // --- Accès générique aux feuilles ---------------------------------------

  function readSheetAsObjects(sheetName) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
    var values = sheet.getDataRange().getValues()
    var headers = values[0]

    var rows = []
    for (var i = 1; i < values.length; i++) {
      var record = {}
      for (var c = 0; c < headers.length; c++) {
        record[headers[c]] = values[i][c]
      }
      rows.push(record)
    }
    return rows
  }

  function findRowById(sheetName, idField, idValue) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
    var values = sheet.getDataRange().getValues()
    var headers = values[0]
    var idCol = headers.indexOf(idField)

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][idCol]) === String(idValue)) {
        var record = {}
        for (var c = 0; c < headers.length; c++) {
          record[headers[c]] = values[i][c]
        }
        return { rowNumber: i + 1, record: record }
      }
    }
    return null
  }

  function appendRowByHeader(sheetName, record) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    var row = headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''
    })
    sheet.appendRow(row)
  }

  function updateRow(sheetName, rowNumber, updates) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

    Object.keys(updates).forEach(function (field) {
      var col = headers.indexOf(field)
      if (col === -1) {
        throw new Error('Colonne inconnue: ' + field)
      }
      sheet.getRange(rowNumber, col + 1).setValue(updates[field])
    })
  }
