  // --- Authentification / autorisation ---------------------------------

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
  * Préfixe AUTH_SESSION: les erreurs sont reconnues côté frontend pour
  * déconnecter automatiquement le gestionnaire (jeton expiré/invalide,
  * compte révoqué...), sans dépendre du texte exact du message.
  */
  function requireManager(body) {
    var idToken = body.idToken
    if (!idToken) {
      throw new Error('AUTH_SESSION: idToken manquant.')
    }

    var payload = verifyGoogleIdToken(idToken)
    var email = String(payload.email || '').toLowerCase()
    if (!payload.email_verified || !email) {
      throw new Error('AUTH_SESSION: Email Google non vérifié.')
    }

    var resident = findResidentByEmail(email)
    var hasManagerRole = resident && (resident.role === 'admin' || resident.role === 'super_admin')
    if (!resident || !hasManagerRole || resident.status !== 'active') {
      throw new Error('AUTH_SESSION: Ce compte n\'a pas les droits gestionnaire.')
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
      throw new Error('La connexion a échoué, merci de réessayer.')
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
