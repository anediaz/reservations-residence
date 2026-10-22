  /**
  * Prems — backend V0 (Apps Script).
  * Une seule surface d'API, appelée en POST avec { action, ...payload }.
  * Contrôle de rôle toujours ici, jamais côté frontend.
  *
  * Fichiers : Auth.gs (authentification/autorisation), Reservations.gs
  * (cycle de vie réservation côté gestionnaire), ResidentPublic.gs
  * (front-office anonyme), Residents.gs / Resources.gs (CRUD),
  * Calendar.gs (agenda Google), Notifications.gs (mails), Sheets.gs
  * (accès générique aux feuilles). Un seul projet Apps Script : tous les
  * fichiers partagent le même espace de noms global, l'ordre n'importe pas.
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
    listResourcesPublic: handleListResourcesPublic,
    getAvailability: handleGetAvailability,
    submitReservationRequest: handleSubmitReservationRequest,
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
