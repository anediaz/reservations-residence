  // --- Réservations (gestionnaire) ----------------------------------------

  /**
  * Demandes en attente de décision, avec conflits de dates et adresses
  * inconnues signalés — le gestionnaire tranche, il n'a pas à chercher.
  */
  function handleListRequests(body) {
    requireManager(body)

    var all = readSheetAsObjects(RESERVATIONS_SHEET)
    var residentsByEmail = {}
    readSheetAsObjects(RESIDENTS_SHEET).forEach(function (r) {
      residentsByEmail[String(r.email || '').toLowerCase()] = r
    })
    var blocking = all.filter(function (r) {
      return isBlockingStatus(r.status)
    })

    var requests = all.filter(function (r) {
      return r.status === 'requested'
    })

    return requests.map(function (r) {
      var resident = residentsByEmail[String(r.requester_email || '').toLowerCase()]
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
          return other.reservation_id !== r.reservation_id && other.resource_id === r.resource_id && datesOverlap(r, other)
        }),
        unknownAddress: !resident,
        lotMismatch: !!resident && String(resident.lot || '').trim() !== '' && String(resident.lot || '').trim() !== String(r.requester_lot || '').trim(),
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
    var cancellableStatuses = ['pending_payment', 'confirmed', 'blocked']
    if (!found || cancellableStatuses.indexOf(found.record.status) === -1) {
      throw new Error('Réservation introuvable ou déjà annulée.')
    }

    deleteCalendarEventForReservation(found.record)
    updateRow(RESERVATIONS_SHEET, found.rowNumber, { status: 'cancelled' })
    appendAuditLog(manager.email, 'reservation_cancelled', body.reservationId, body.reason || '')

    var info = getResourceInfo(found.record.resource_id)
    notifyReservationStatusChange(found.record, 'cancelled', info.name, info.calendarId, '', body.reason || '')

    return { ok: true }
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

  // --- Aide-cycle réservation --------------------------------------------

  function datesOverlap(a, b) {
    return new Date(a.start_at) < new Date(b.end_at) && new Date(b.start_at) < new Date(a.end_at)
  }

  function isBlockingStatus(status) {
    return status === 'requested' || status === 'pending_payment' || status === 'confirmed' || status === 'blocked'
  }
