  // --- Résidents (CRUD gestionnaire) --------------------------------------

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
