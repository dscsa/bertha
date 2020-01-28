function updateDonorIds() {
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var pickup_sheet = ss.getSheetByName("3 - Pickups")
  var contact_sheet = ss.getSheetByName("2 - Contacts")
  var pickup_data = pickup_sheet.getDataRange().getValues()
  

  var facility_arr = []
  var id_arr = []
  
  for(var i = pickup_data.length -1; i >= (pickup_data.length - 30); i--){
    var fac = pickup_data[i][0].toString().trim()
    var id = pickup_data[i][1].toString().trim()
    if(id.length > 0){
      facility_arr.push(fac)
      id_arr.push(id)
    }
  }
  
  
  
  var contact_data = contact_sheet.getDataRange().getValues()
  var body = "I updated the donor id's for the following facility rows\n"
  
  var indexes = PropertiesService.getScriptProperties()  
  var contactsheet_index_facility = parseInt(indexes.getProperty('indexContactPageFacility'))
  var contactsheet_index_id = parseInt(indexes.getProperty('indexContactPageID'))

  for(var i = 0; i < contact_data.length; i++){
    var row_fac = contact_data[i][contactsheet_index_facility].toString().trim()
    var ind = facility_arr.indexOf(row_fac)
    if(ind > -1){
      var contact_sheet_id = contact_data[i][contactsheet_index_id].toString().trim()
      if(contact_sheet_id.length == 0){
        body += "\n Facility: " + row_fac + "; New Id: " + id_arr[ind]
        contact_sheet.getRange((i+1),(contactsheet_index_id + 1)).setValue(id_arr[ind])
      }
    }
  }

  //Send an email to OS so we have a record of changed values
  debugEmail("UPDATED DONOR IDS", body)

}
