  // --- Accès générique aux feuilles ---------------------------------------

  function appendAuditLog(actor, action, target, detail) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_LOG_SHEET)
    sheet.appendRow([new Date(), actor, action, target, detail])
  }

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

  function appendRowByHeader(sheetName, record) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName)
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    var row = headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : ''
    })
    sheet.appendRow(row)
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
