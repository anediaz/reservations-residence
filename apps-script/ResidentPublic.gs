  // --- Front-office (public, sans authentification) -----------------------

  /**
  * Ressources réservables, version publique : pas de calendar_id/lock_id
  * (détails internes), accessible sans idToken (webapp en accès anonyme).
  */
  function handleListResourcesPublic(body) {
    return readSheetAsObjects(RESOURCES_SHEET).map(function (r) {
      return {
        resource_id: r.resource_id,
        name: r.name,
        booking_unit: r.booking_unit,
        price_per_unit: r.price_per_unit,
        cleaning_fee: r.cleaning_fee,
        check_in_time: formatTimeValue(r.check_in_time),
        check_out_time: formatTimeValue(r.check_out_time),
        max_units: r.max_units,
        calendar_id: resolveCalendarId(r.calendar_id),
      }
    })
  }

  /**
  * Créneaux déjà pris pour une ressource (toute réservation à statut
  * bloquant), pour affichage en lecture seule côté résident avant soumission.
  */
  function handleGetAvailability(body) {
    var resourceId = String(body.resourceId || '').trim()
    if (!resourceId) {
      throw new Error('Ressource manquante.')
    }
    return readSheetAsObjects(RESERVATIONS_SHEET)
      .filter(function (r) { return r.resource_id === resourceId && isBlockingStatus(r.status) })
      .map(function (r) { return { start_at: r.start_at, end_at: r.end_at } })
  }

  function computePricing(resource, startAt, endAt) {
    var msPerDay = 24 * 60 * 60 * 1000
    var nights = Math.round((new Date(endAt) - new Date(startAt)) / msPerDay)
    if (!isFinite(nights) || nights < 1) {
      throw new Error('Dates invalides.')
    }
    var maxUnits = Number(resource.max_units)
    if (isFinite(maxUnits) && maxUnits > 0 && nights > maxUnits) {
      throw new Error('Durée maximale dépassée (' + maxUnits + ' nuits).')
    }
    var amountUnits = nights * Number(resource.price_per_unit || 0)
    var amountCleaning = Number(resource.cleaning_fee || 0)
    return {
      units: nights,
      amount_units: amountUnits,
      amount_cleaning: amountCleaning,
      amount_total: amountUnits + amountCleaning,
    }
  }

  function buildReservationReference(reservationId, startAt) {
    return Utilities.formatDate(new Date(startAt), Session.getScriptTimeZone(), 'yyMMdd') + '-' + reservationId.slice(0, 6).toUpperCase()
  }

  /**
  * Soumission d'une demande par un résident, sans authentification. Le
  * conflit de dates est revérifié ici (le frontend ne fait qu'une
  * pré-validation) : rejet direct si chevauchement, premier arrivé.
  */
  function handleSubmitReservationRequest(body) {
    var resourceId = String(body.resourceId || '').trim()
    var requesterEmail = String(body.requesterEmail || '').trim().toLowerCase()
    var requesterLot = String(body.requesterLot || '').trim()
    if (!resourceId) {
      throw new Error('Ressource manquante.')
    }
    if (!requesterEmail) {
      throw new Error('Email manquant.')
    }
    if (!requesterLot) {
      throw new Error("Numéro d'appartement manquant.")
    }
    if (!body.startAt || !body.endAt || new Date(body.startAt) >= new Date(body.endAt)) {
      throw new Error('Dates invalides.')
    }

    var resourceRow = findRowById(RESOURCES_SHEET, 'resource_id', resourceId)
    if (!resourceRow) {
      throw new Error('Ressource introuvable.')
    }

    var candidate = { start_at: new Date(body.startAt), end_at: new Date(body.endAt) }
    var hasConflict = readSheetAsObjects(RESERVATIONS_SHEET).some(function (r) {
      return r.resource_id === resourceId && isBlockingStatus(r.status) && datesOverlap(candidate, r)
    })
    if (hasConflict) {
      throw new Error('Ces dates ne sont plus disponibles pour cette ressource.')
    }

    var pricing = computePricing(resourceRow.record, body.startAt, body.endAt)
    var reservationId = Utilities.getUuid()
    var reference = buildReservationReference(reservationId, body.startAt)
    var resident = findResidentByEmail(requesterEmail)

    var record = {
      reservation_id: reservationId,
      reference: reference,
      resource_id: resourceId,
      resident_id: resident ? resident.resident_id : '',
      requester_email: requesterEmail,
      requester_lot: requesterLot,
      requester_contact: String(body.requesterContact || '').trim(),
      comment: String(body.comment || '').trim(),
      start_at: candidate.start_at,
      end_at: candidate.end_at,
      status: 'requested',
      units: pricing.units,
      amount_units: pricing.amount_units,
      amount_cleaning: pricing.amount_cleaning,
      amount_total: pricing.amount_total,
    }

    var eventId = upsertCalendarEventForReservation(record, 'requested')
    if (eventId) {
      record.calendar_event_id = eventId
    }

    appendRowByHeader(RESERVATIONS_SHEET, record)
    appendAuditLog(requesterEmail, 'request_submitted', reservationId, '')

    return { ok: true, reservation_id: reservationId, reference: reference }
  }
