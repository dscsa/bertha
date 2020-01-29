



//----------------------------------------PICKUP-HANDLING-----------------------------------------------------------------------------------------------------




//pendPickups
//Will go through any faxes that have come in during the last two hours and pend them to
//the list of pickups to set. It will then send out an email about these pending pickups, and then
//later the setPickups function will be triggered to set pickups at all the facilities on that sheet.
//The latter could be done by email until it's set to autotrigger
//-----------------------------------------
function pend_pickups(start){
  start = start || 0
  var ss = SpreadsheetApp.openById(BERTHA_ID);
  var main_sheet = ss.getSheetByName("1 - Main Page")
  var contact_sheet = ss.getSheetByName("2 - Contacts")
  var pending_sheet = ss.getSheetByName("3 - Pickups");
  var data_val_sheet = ss.getSheetByName("Data Validation");
  var coleman_to_do_sheet = SpreadsheetApp.openById("1HglNrncAbiJgqOzned29dfQiEo9YUBFC1cXJ1fF_nEA").getSheetByName("To Do List")
  var coleman_exclude_arr = get_coleman_exclude(data_val_sheet);
  var existing_coleman_trackings = get_existing_coleman_trackings(coleman_to_do_sheet)
  var coleman_exclude_accounts = getPharmacyNames(data_val_sheet)
  var pended_facilities = [] //create an array of unique entries per facility that needs pickup
  var facilities_to_pend = {}
  
  
  var facility = ""
  var facility_id = ""
  var facility_issue = ""
  var pickup = ""
  var contact = ""
  var raw_fax = ""
  var fax_number = ""
  var pickup_scheduled_cell = ""
  var main_data = main_sheet.getDataRange().getValues();
  var contact_data = contact_sheet.getDataRange().getValues()

  //get pickup and issue from the main sheet, not contacts. Only get id from contacts.   
  var main_indexes = get_main_indexes()  
  
  var indexFacility = indexes.indexFacilityName
  var indexPickup = indexes.index_pickup
  var indexContact = indexes.indexContact
  var indexIssue = indexes.indexIssues
  var indexRawFax = indexes.indexRawFax
  var indexAction = indexes.indexPend
  var indexInSirum = indexes.indexInSirum

  
  var contact_indexes = get_contact_indexes()
  
  var contactsheet_index_faxnumber = contact_indexes.indexFaxnumber
  var contactsheet_index_facility = contact_indexes.indexFacility
  var contactsheet_index_state = contact_indexes.indexState
  var contactsheet_index_pickup = contact_indexes.indexPickup
  var contactsheet_index_issue = contact_indexes.indexIssue
  var contactsheet_index_contact = contact_indexes.indexContact
  var contactsheet_index_id = contact_indexes.indexId
  var contactsheet_index_last_donation_date = contact_indexes.indexLastDonationDate
  var contactsheet_index_supplies_notes = contact_indexes.indexSuppliesNotes
  var contactsheet_index_salesforce_contacts = contact_indexes.indexSalesforceContacts
  var contactsheet_index_import_format = contact_indexes.indexImportFormat
  var contactsheet_index_all_emails = contact_indexes.indexAllEmails

  
  for(var n=0;n<main_data.length;++n){           
    facility = main_data[n][indexFacility].toString()
    //comment out this coleman check once everything has been migrated to new v1_data format
    //if((facility != "Not Found") && (main_data[n][indexInSirum].toString().toLowerCase().indexOf("coleman sheet") == -1)){
      //THIS IS WHERE YOU CALL ADD TO COLEMAN SHEET
      //structured this way to keep updating the existing_coleman_trakcings after each row if necesary
      //existing_coleman_trackings = add_to_coleman_sheet(main_data[n], coleman_to_do_sheet,coleman_exclude_arr,n, main_sheet, existing_coleman_trackings, indexes, coleman_exclude_accounts);
    //}

    
    if((main_data[n][indexAction].toString().trim().length == 0) && (facility != "Not Found")){      //identifies the rows without a pickup scheduled yet, ignoring unfound lines
      facility = main_data[n][indexFacility].toString().trim()
      //this is where we'd extract anything from row main_data[n][index_of_whatever]
      

      var no_id_catch = "" //this value will be set to a string if there's no id so that they dont try to set a pickup and instead have to check with Adam/Omar
      
      if(facility in facilities_to_pend){
        var old_arr_facility = facilities_to_pend[facility].split(":")
        old_arr_facility[6] = parseInt(old_arr_facility[6],10) + 1
        facilities_to_pend[facility] = old_arr_facility.join(":")
      } else {
        facility_issue = main_data[n][indexIssue].toString().replace(":",";")
        if(facility_issue == "No") facility_issue = ""
        pickup = main_data[n][indexPickup]
        contact = main_data[n][indexContact].split("----------")[0].trim()
        
        raw_fax = main_data[n][indexRawFax]
        if(raw_fax.toLowerCase().indexOf("mail") == -1){
          fax_number = raw_fax.substring(raw_fax.indexOf("+")+1,raw_fax.indexOf("+")+17).trim()
        } else {
          fax_number = ""
        }
        
        facility_id = "" //initialize it so that it doesnt remember the past facility 
        for(i=0;i<contact_data.length;++i){
          if((contact_data[i][contactsheet_index_facility].toString().toLowerCase() == facility.toLowerCase()) && (contact_data[i][contactsheet_index_id].toString().length > 0)) facility_id = contact_data[i][contactsheet_index_id].toString()
        }
        
        if(facility_id.length == 0){  //If there's no facility ID anywhere in the database, then someone with DB access needs to look it up. This stops Bertha from setting pick up
                                      //and pings Omar (eventually Adam) about it so they can look it up and update the contact.
          no_id_catch = "No ID Found, please ask Adam/Omar or check SFax"
        }
        
        facilities_to_pend[facility] = facility_id + ":" + pickup + ":" + contact + ":" + no_id_catch + ":" + facility_issue + ":" + fax_number + ":" + "1"
      
      }
       
      pickup_scheduled_cell = "A" + (n+1)
      var pend_note = "PEND "
      pend_note += Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
      main_sheet.getRange((n+1), (indexAction+1)).setValue(pend_note) //make a note that I am going to pend a pickup here             
    }  
  }
  
  
  for(var fac in facilities_to_pend){
    var temp_arr = facilities_to_pend[fac].split(":")
    var fax_cleaned = temp_arr[5].replace("(","").replace(")","").replace(" ","").replace(" ","").replace("-","")
    if(/[0-9]{11}/.test(fax_cleaned)){
        fax_cleaned += "@metrofax.com"
    } else {
        fax_cleaned = ""
    }
    pending_sheet.appendRow([fac,temp_arr[0], temp_arr[1], temp_arr[2], temp_arr[3], "", temp_arr[4], "", temp_arr[6], "", fax_cleaned])
    var source_range = pending_sheet.getRange("L2:M2")
    var formulas = source_range.getValues()
    if(formulas[0].toString().trim().length == 0){
      debugEmail('ERROR COPYING DOWN THE FORMULAS IN PEND SHEET', source_range.getValue())
    }
    source_range.copyTo(pending_sheet.getRange("L" + (pending_sheet.getLastRow()) + ":M" + (pending_sheet.getLastRow())))
    
  }
  if(pended_facilities.length >= 1) send_alert_email(6, "", "", "", pended_facilities) 
}



//Manual setPickups
//The function that triggers the pickup setter. Will loop through all the rows in Pending
//That are not yet scheduled and do so. Identical to the above version that can be triggered by email
//But this can be triggered as a standalone within the script
//OR by clicking the button on the Pickups page. 
//-----------------------------
function set_pickups(start){
  start = start || 0
  var ss = SpreadsheetApp.openById(BERTHA_ID);
  var main_sheet = ss.getSheetByName("1 - Main Page");
  var pending_sheet = ss.getSheetByName("3 - Pickups");
  var data = pending_sheet.getDataRange().getValues();

  var url_start = SIRUM_URL
  var id = "" //uses the facility ID in sirum.org to match it up
  var pickup = ""
  var contact = ""
  var num_boxes = "1"

  var url_end = "/09:00:00/" 
  var CurrentDate    = new Date() ;  
  var next_business_day = businessDaysFromDate(CurrentDate,1)
  var next_day = Utilities.formatDate(next_business_day, "GMT-07:00", "yyyy-MM-dd") 
  url_end += next_day
  for(n=1;n<data.length;++n){ 
    if(data[n][4] == ""){
      id = data[n][1].toString().trim()
      if((data[n][6].toString().trim().length == 0) && (id.length > 0)){ //Dont set pickup unless the issue has been resolved, which Bertha knows when person clears the cell
        
        pickup = data[n][2].toString().trim().replace("(","").replace(")","").replace(/\n/g,"").replace(/'/g,"").replace(/\./g,"").replace(/\//g,"").replace(/,/g,"").replace(/#/g,"")
        contact = data[n][3].toString().trim().replace("(","").replace(")","").replace(/\n/g,"").replace(/'/g,"").replace(/\./g,"").replace(/\//g,"").replace(/,/g,"").replace(/#/g,"")
        if((data[n][8].toString().trim() != "NaN") && (data[n][8].toString().length > 0)){
          num_boxes = data[n][8].toString().trim()
        }
        
        if(!pickup){
          pickup = "0"
        }
        if(!contact){
          contact = "0"
        }
        var url = url_start + id + url_end + "/" + pickup + "/" + contact + "/" + num_boxes
        var today_cell = "E" + (n+1)
        
        
        var res_obj = UrlFetchApp.fetch(url, {muteHttpExceptions:true})
        
        var response_code = res_obj.getResponseCode()
        var issue_cell = "G" + (n+1)
        var pickup_date_cell = "F" + (n+1)

        if(response_code !== 200){
          //then try again
          var new_url = url.replace("09:00:00","13:00:00")
          res_obj = UrlFetchApp.fetch(new_url, {muteHttpExceptions:true})
          
          response_code = res_obj.getResponseCode()
          if(response_code !== 200){
          
            pending_sheet.getRange(issue_cell).setValue(res_obj.getContentText())         
            pending_sheet.getRange(pickup_date_cell).setValue("NOT SET --> ")     
            continue
          }
        }
        
        pending_sheet.getRange(today_cell).setValue(Utilities.formatDate(CurrentDate, "GMT-07:00", "MM/dd/yyyy "))         

        var res = res_obj.getContentText()
        var lastLine = res.substring(res.lastIndexOf("\n")+1)
        var facility = data[n][0].toString().trim()

        
        if(lastLine.indexOf("Pickup not scheduled for") > -1){ //Then it wasn't scheduled
          var error = lastLine.substring(lastLine.indexOf(":")+2)
          var issue_cell = "G" + (n+1)
          pending_sheet.getRange(issue_cell).setValue(error)         
          pending_sheet.getRange(pickup_date_cell).setValue("NOT SET --> ")         
        } else { //Then it was scheduled
          var confirmation_cell = "H" + (n+1)
          var confirmation_number = res.substring(res.indexOf("CPU"),res.indexOf("CPU")+13)
          Logger.log(confirmation_number)
          var pickup_date = Utilities.formatDate(next_business_day, "GMT-07:00", "MM/dd/yyyy") 
          pending_sheet.getRange(confirmation_cell).setValue(confirmation_number)
          pending_sheet.getRange(pickup_date_cell).setValue(pickup_date)
          data[n][4] = Utilities.formatDate(CurrentDate, "GMT-07:00", "MM/dd/yyyy ")
          data[n][5] = pickup_date
          generate_outbound_emails("zero",ss, data[n])
        }
     
      }
    }
  }

}