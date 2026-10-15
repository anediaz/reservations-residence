/**
 * Prems — backend V0 (Apps Script).
 * Une seule surface d'API, appelée en POST avec { action, ...payload }.
 * Contrôle de rôle toujours ici, jamais côté frontend.
 */

var RESIDENTS_SHEET = 'residents'

var ACTIONS = {
  authenticate: handleAuthenticate,
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
  if (!resident || resident.role !== 'manager' || resident.status !== 'active') {
    throw new Error('Ce compte n\'a pas les droits gestionnaire.')
  }

  return {
    email: email,
    name: payload.name || email,
    role: 'manager',
  }
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
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESIDENTS_SHEET)
  var values = sheet.getDataRange().getValues()
  var headers = values[0]
  var emailCol = headers.indexOf('email')
  var roleCol = headers.indexOf('role')
  var statusCol = headers.indexOf('status')

  for (var i = 1; i < values.length; i++) {
    var row = values[i]
    if (String(row[emailCol]).toLowerCase() === email) {
      return { role: row[roleCol], status: row[statusCol] }
    }
  }
  return null
}
