  // --- Ressources (CRUD gestionnaire) -------------------------------------

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
