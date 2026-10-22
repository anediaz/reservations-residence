  // --- Agenda Google -------------------------------------------------------

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
