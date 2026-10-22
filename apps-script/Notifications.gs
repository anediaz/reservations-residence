  // --- Notifications mail ---------------------------------------------------

  var MANAGER_SUBJECTS = {
    requested: function (resourceName, reference) { return 'Nouvelle demande de réservation — ' + resourceName + ' (' + reference + ')' },
    pending_payment: function (resourceName, reference) { return 'Réservation approuvée — virement attendu — ' + resourceName + ' (' + reference + ')' },
    confirmed: function (resourceName, reference) { return 'Virement reçu — réservation confirmée — ' + resourceName + ' (' + reference + ')' },
    refused: function (resourceName, reference) { return 'Demande refusée — ' + resourceName + ' (' + reference + ')' },
    cancelled: function (resourceName, reference) { return 'Réservation annulée — ' + resourceName + ' (' + reference + ')' },
    blocked: function (resourceName) { return 'Dates bloquées — ' + resourceName },
  }

  var REQUESTER_SUBJECTS = {
    requested: function () { return 'Votre demande de réservation a été reçue' },
    pending_payment: function () { return 'Votre demande de réservation est approuvée — virement attendu' },
    confirmed: function (resourceName) { return 'Votre réservation est confirmée — ' + resourceName },
    refused: function () { return 'Votre demande de réservation a été refusée' },
    cancelled: function () { return 'Votre réservation a été annulée' },
  }

  var REQUESTER_STATUS_LABELS = {
    requested: 'Votre demande a été reçue, en cours d\'examen',
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
      rows.push(["Numéro d'appartement", reservation.requester_lot])
    }
    if (reservation.requester_email) {
      rows.push(['Résident', reservation.requester_email])
    }
    if (reservation.amount_total) {
      rows.push(['Montant total', reservation.amount_total + ' €'])
    }
    if (reservation.comment) {
      rows.push(['Commentaire', reservation.comment])
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
    if (status === 'requested') {
      nextStep = 'Votre demande a été transmise au gestionnaire, vous recevrez un mail dès qu\'elle sera traitée.'
    } else if (status === 'pending_payment') {
      nextStep = reservation.hold_expires_at
        ? 'Merci d\'effectuer le virement avant le ' + formatDateOnly(reservation.hold_expires_at) + ', sinon la réservation sera automatiquement annulée.'
        : 'Merci d\'effectuer le virement sous ' + HOLD_HOURS + 'h, sinon la réservation sera automatiquement annulée.'
    } else if (status === 'confirmed') {
      nextStep = 'Votre réservation est confirmée, vous n\'avez rien d\'autre à faire.'
    } else if ((status === 'refused' || status === 'cancelled') && reason) {
      nextStep = 'Motif : ' + reason
    }

    var textBody = buildEmailText(rows, eventLink) +
      (nextStep ? '\n\n' + nextStep : '')
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
