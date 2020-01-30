function testNewDealWithShipped(){
  var content = "Donation 13295 with tracking number 971424215287213 from Creekside Rehab & Behavioral Health - STP was shipped"
  
  alternative_deal_with_shipped(content,
                                SpreadsheetApp.openById('1QpoWk_0r3QoJswf75LmKYwQx8qRU5DOgZnvLTKz0njU').getSheetByName('1 - Main Page'),
                                SpreadsheetApp.openById('1QpoWk_0r3QoJswf75LmKYwQx8qRU5DOgZnvLTKz0njU').getSheetByName('3 - Pickups'),
                                                                SpreadsheetApp.openById('1QpoWk_0r3QoJswf75LmKYwQx8qRU5DOgZnvLTKz0njU').getSheetByName('2 - Contacts'),

                                null,
                                null)
}


function log_shipped_info(indexRowToAdd, main_page, main_page_data, main_indexes, tracking_number){
  main_page.getRange((indexRowToAdd+1), (main_indexes.indexTrackingNum+1)).setValue(tracking_number.trim())
  
  var shipped_date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss") //keeps track of when the pickup was set              
  main_page.getRange((indexRowToAdd+1), (main_indexes.indexShippedEmail+1)).setValue(shipped_date)
  
  if(main_page_data[indexRowToAdd][main_indexes.indexPend].toString().length == 0){ //then we never pended it, so it was unexpected but auto-resolved
     main_page.getRange((indexRowToAdd+1), (main_indexes.indexPend+1)).setValue("UNEXPECTED SHIPMENT")
     main_page.getRange((indexRowToAdd+1), (main_indexes.indexHumanIssues+1)).setValue("Auto-Resolved because shipped before pickup was pended.")
  }
  
  //addTrackingToDB(tracking_number.trim(), from_facility.trim(), tracking_db_sheet) //TODO uncomment
}

function log_unexpected_shipment_info(contact_sheet, tracking_number, from_facility, contact_indexes, main_page, date){
  Logger.log("unexpected!")
  
  //check if it's a facility we even have, in which case update some info, otherwise make a note
  var note = "NOT MATCHED TO A ROW & NOT IN DB"
  var data = contact_sheet.getDataRange().getValues();
  var state = "?"
  var action = "?"
  var contact = "?"
  var message = "Could not match " + from_facility + "with how any contact is written. I put their donation with tracking number " + tracking_number + " in a dummy row. Please sort this all out."
  var issue = ""
  var data_format = ""
  var update_command = "  FAX NUMBER NOT FOUND: " + from_facility
   
  for(var i = 0; i < data.length; ++i){
    Logger.log(data[i][contact_indexes.indexFacility].toString().toLowerCase())
   if(data[i][contact_indexes.indexFacility].toString().toLowerCase().indexOf(from_facility.trim().toLowerCase()) > -1){ //then we have the contact, just didn't have a fax. So it's a different situation
     state = data[i][contact_indexes.indexState].toString()
     action = data[i][contact_indexes.indexIssue].toString()
     contact = data[i][contact_indexes.indexContact].toString()
     data_format = data[i][contact_indexes.indexImportFormat].toString()
     note = "UNEXPECTED SHIPMENT"
     issue = "UNEXPECTED SHIPMENT"
     message = "Got a shipped email from " + from_facility + "but I wasn't expecting it, so I had to create a new row. Check it out."
     update_command = ""
   }
  }
   
   var auto_res = ""
   var auto_no = ""
   
   if(data_format.length == 0){
     if(note.indexOf('NOT IN DB') == -1){
       issue += " Contact doesn't have a specific V1 import format on Salesforce. Double check Donor is in 2-Contacts Sheet";
     }
   } else {
     data_format += " " + date
     if(data_format.toLowerCase().indexOf("coleman") == -1) {
       auto_res = "Auto-Resolved because facility data format is " + data_format
       auto_no = "#NO"
     }
   }
   
   main_page.appendRow([note, "Bertha", from_facility, state, action,contact,"","","","",data_format,auto_no,issue,auto_res,tracking_number,Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss"), "", "Shipped Email","","","","","",update_command,Math.floor(Math.random() * 500000)]) //creates a sort of dummy row for a shipped email taht didn't match any faxes
   //addTrackingToDB(tracking_number.trim(), from_facility.trim(), tracking_db_sheet) //TODO uncomment
   
   auto_group(from_facility)
   send_alert_email(5,"","",message,"")
}


//todo for this function:
//use regexes to extract  tracking num and from_facility
//on the first sweep of the main_page data, don't actually do anything, that way it won't 
function alternative_deal_with_shipped(content, main_page, pending_page, contact_sheet,data_val_sheet, tracking_db_sheet){ 
    
  if((content.indexOf("out of office") > -1)) return; //shortcuts the reply emails we might get
  
  var extraction_result = extractShippedText(content)
  if(extraction_result == null) return
  var [tracking_number, from_facility] = extraction_result
  
  var current_sheet_data = main_page.getDataRange().getValues();
  
  var main_indexes = get_main_indexes()
  var contact_indexes = get_contact_indexes()
  
  var date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy ")    

  var found_row_from_facility_today = -1
  var need_dup = true
  var match_facility = false
  var indexRowToAdd = -1
  
  //Sweep the main page for a few different scenarios
  
  for(var n=1;n<current_sheet_data.length;n++){  //find the row of this facility   
    
    if(current_sheet_data[n][main_indexes.indexFacilityName].toString().trim().toUpperCase() == from_facility.trim().toUpperCase()){
      
      match_facility = true
      
      if(current_sheet_data[n][main_indexes.indexTrackingNum].toString().trim() == tracking_number.trim()){ //since one email for donation shipped is sent to a bunch of people form that facility, there will be copies of the tracking, but since you insert top-bottom then you will see a copy this way, and then ignore the email
        return //then don't wanna make any edits

      } else if((current_sheet_data[n][main_indexes.indexTrackingNum].toString().length == 0) && (current_sheet_data[n][main_indexes.indexPend].toString().indexOf("DO NOT PEND") == -1) && (current_sheet_data[n][main_indexes.indexPend].toString().indexOf("SUPPLY REQUEST") == -1) && (current_sheet_data[n][main_indexes.indexPend].toString().indexOf("EMAIL") == -1)){      //identifies the first row from this facility that is without tracking # and which does not say "DO NOT PEND" or isn't a supply request
        if(matched_row_by_tracking_number(current_sheet_data[n][main_indexes.indexColemanTracking].toString().trim(), tracking_number) //either its the exact row, in which case overwrite indexRowToAdd, or its the first row from this facility, which we keep
           || (indexRowToAdd == -1)){
          indexRowToAdd = n 
        }
        need_dup = false
        
      } else { //then its a row with a donation from this facility, but already linked to one tracking number. Want to check the date stamps
        //Here want to distinguish between if, for example, you had a bunch of boxes in one shipment you should
        //group together, or if its just a box that shipped without your knowledge. In the case where you get a
        //shipment without a fax, you need to create a row at the bottom, not lose it up in the sheet.
        //So you check column 11, the shipped one and look for the date, and only set found_row_from_facility_today = n if the date is today
        //since that means that in this same batch, there were other boxes shipped today that we knew to expect
        var shipped_cell = current_sheet_data[n][main_indexes.indexShippedEmail].toString()
        var date_shipped = shipped_cell.substring(0,10)
        var today = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
        if(date_shipped == today) found_row_from_facility_today = n
      }
    }   
   }
   
  
  //Now that we've checked the main page, there's a few different scenarios we need to be able to handle
  
  if(indexRowToAdd > -1){
     //In this case, you simply found a row where we can store that tracking number. Either the first/only row from that facility, or the one that matches the Sfax barcode
     log_shipped_info(indexRowToAdd, main_page, current_sheet_data, main_indexes, tracking_number)
  
  } else if(need_dup && (found_row_from_facility_today > -1)){
     //If you get here and the following fields are both tru, there was no row to link to a tracking number but there were others 
     //from the facility. So it's probably that the fax had more than one coversheet inside of it, and you need to create a new row
     //just like the last one used, and input the new tracking number.
     
     duplicateRowBelow(main_page,found_row_from_facility_today) //a helper function that duplicates the last row of this facility (which will be in the same shipment
     main_page.getRange((found_row_from_facility_today+2),(main_indexes.indexTrackingNum+1)).setValue(tracking_number.trim())
     //addTrackingToDB(tracking_number.trim(), from_facility.trim(), tracking_db_sheet)    //TODO uncomment  
  
  } else if((!match_facility) || (match_facility && (found_row_from_facility_today == -1) && (need_dup))){
     //If you get here, then we've got no instance of that facility showing up in the sheet OR there are no other rows/boxes from today.
     //It might be that we don't have it in my contacts list, which might depend on someone in the future correcting the spelling of a facility name
     //and we don't want to lose the tracking info in that case. So we need to keep a log of unlinked tracking numbers 
     //and their facilities, since there shouldnt be any mysterious shipped emails. So we will directly add a row with the name
     //and the tracking number. And send an email about this. So we ALWAYS keep track of the shipped emails.
     //The second logic test here accounts for the case where the row is found elsewhere but it's not from today, but dont want to lose a 
     //shipped email from today if you can't match it with any other emails from today. This happens a lot with Worthington
    
    log_unexpected_shipment_info(contact_sheet, tracking_number, from_facility, contact_indexes, main_page, date)
  }
   
   check_for_pickups_to_cancel(pending_page,from_facility) //Check the pickups page for any outstanding pickups to this facility and cancel them! 
}




//-------------------------------------------------------------------------------------------------
function testExtract(){
  var content = "Donation 13295 with tracking number 971424215287213 from Creekside Rehab & Behavioral Health - STP was shipped"
  
  var extraction_result = extractShippedText(content)
  
  if(extraction_result){
    var [tracking_number, from_facility] = extraction_result
    Logger.log(tracking_number)
    Logger.log(from_facility)
  } else {
    Logger.log('Error!')
    debugEmail('Error parsing shipped email', content)
    console.log('error parsing shipped email', content)
  }
 
}



//Builds an email from an HTML Template
//needs to have pointer to the template_sheet
//An object with all keys that match the variables in the vars-list for that email
//Code specifies which type of email, can be: SHIPPED_EMAIL
function buildEmail(templates_sheet,obj,code){
  //TODO: delete
  code = 'SHIPPED_EMAIL'
  templates_sheet = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("OS DEV - Email HTTP Templates")
  obj = {
    "<DONEE_NAME>":"Omar Sow",
    "<DONATION_NUMBER>": "1111111",
    "<TRACKING_NUMBER>": "979797",
    "<DONOR_FACILITY>" : "George's Spot"
  }
  //TODO: delete above
  
  var var_range = ""
  var template_range = ""
  
  if(code == 'SHIPPED_EMAIL'){
    var_range = 'A2'
    template_range = 'B2'
  } else if(code == 'SUPPLIES_ZERO'){
    
  }
  
  var email_vars = templates_sheet.getRange(var_range).getValue().split("\n").splice(2)
  var email_template = templates_sheet.getRange(template_range).getValue()
  
  var email_body_html = email_template.slice(1)
  
  for(var i = 0; i < email_vars.length; i++){
    email_body_html = email_body_html.replace(email_vars[i],obj[email_vars[i]])
  }
  
  MailApp.sendEmail("omar@sirum.org", "Test", '', {htmlBody:email_body_html})
  
}


