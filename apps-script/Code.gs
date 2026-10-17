  /**
  * Prems — backend V0 (Apps Script).
  * Une seule surface d'API, appelée en POST avec { action, ...payload }.
  * Contrôle de rôle toujours ici, jamais côté frontend.
  */

  var RESIDENTS_SHEET = 'residents'
  var RESERVATIONS_SHEET = 'reservations'
  var AUDIT_LOG_SHEET = 'audit_log'

  var HOLD_HOURS = 48

  var ACTIONS = {
    authenticate: handleAuthenticate,
    listRequests: handleListRequests,
    approveRequest: handleApproveRequest,
    refuseRequest: handleRefuseRequest,
    confirmPayment: handleConfirmPayment,
    adminCancel: handleAdminCancel,
    listReservations: handleListReservations,
    listResidents: handleListResidents,
    upsertResident: handleUpsertResident,
    revokeResident: handleRevokeResident,
    deleteResident: handleDeleteResident,
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
      return r.status === 'pending_payment' || r.status === 'confirmed'
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
    updateRow(RESERVATIONS_SHEET, found.rowNumber, {
      status: 'pending_payment',
      hold_expires_at: holdExpiresAt,
    })
    appendAuditLog(manager.email, 'request_approved', body.reservationId, '')

    return { ok: true }
  }

  function handleRefuseRequest(body) {
    var manager = requireManager(body)
    var found = findRowById(RESERVATIONS_SHEET, 'reservation_id', body.reservationId)
    if (!found || found.record.status !== 'requested') {
      throw new Error('Demande introuvable ou déjà traitée.')
    }

    updateRow(RESERVATIONS_SHEET, found.rowNumber, { status: 'refused' })
    appendAuditLog(manager.email, 'request_refused', body.reservationId, body.reason || '')

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

    updateRow(RESERVATIONS_SHEET, found.rowNumber, { status: 'cancelled' })
    appendAuditLog(manager.email, 'reservation_cancelled', body.reservationId, body.reason || '')

    return { ok: true }
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
