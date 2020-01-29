//Auto-Logger: Bertha
//See documentation at the README https://docs.google.com/document/d/1rEQmdKTt_K1MXfLvZx3-IiK9pe8EfsYZkDreYQWRBn4/edit
//Goal is to totally automate and manage the drug donation process for SIRUM

function auto_log(start) { //Handles the GMail boilerplate and delagates necessary tasks
 
//--------------------------Beginning of boiler plate------------------------------------------------------------
  start = start || 0;
  
  var ss = SpreadsheetApp.openById(BERTHA_ID);
  var backend_sh = SpreadsheetApp.openById(BACKEND_ID)
  var date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss")
  var cache = CacheService.getUserCache();
  var locked = cache.get("lock");
  
  if(locked) return;
  
  custom_lock("auto_log") //this shouldn't wait because we just checked
  
  var main_page = ss.getSheetByName("1 - Main Page");
  var contact_sheet = ss.getSheetByName("2 - Contacts");
  var pickup_sheet = ss.getSheetByName("3 - Pickups")
  var data_val_sheet = ss.getSheetByName("Data Validation")
  var tracking_db_sheet = backend_sh.getSheetByName("Tracking Number DB")
  var supplies_email_sheet = ss.getSheetByName("Import from Shippo")
  var label = GmailApp.getUserLabelByName(LABEL_NAME); //A label set up in the GMail account and is applied to all incoming emails that we'd need to look at
  var threads = label.getThreads(0,100); //get all the matched threads
  
  for (var i = 0; i < threads.length; i++) { //loops through all the threads with the label, which will be removed when it's processed
    
    var messages = threads[i].getMessages(); //get an array of messages if there are multiple in the thread
    
    for (var j = 0; j < messages.length; j++){ //iterate through every message in the thread (since donation shipped/received emails tend to come in batched threads
      var message = messages[j]
      var subject = message.getSubject()
      var content = message.getPlainBody()
    
      //------------------------Parse out where to send this email--------------------------------------------------------------   
      if (content) {
        if(subject.indexOf("Summary of failures for Google Apps Script: Bertha") > -1){ //check if its a crash email
          console.log("Dealing with crcash")
          if(j == messages.length - 1) deal_with_crash(content)
          //j = messages.length; //since with sfax it will do duplicates because of forwarding to info, and all that, here you can short circuit the for-loop

        } else if(subject.indexOf("Sfax received") > -1){ //check if its an SFax email
          console.log("Sfax")
          if(j == messages.length - 1) deal_with_sfax(subject, contact_sheet, main_page, content) //only look at most recent, so this should control for getting a new fax_id everytime
          //j = messages.length; //since with sfax it will do duplicates because of forwarding to info, and all that, here you can short circuit the for-loop
      
        } else if((subject.indexOf("Donation Shipped") > -1) && (message.getFrom().indexOf("donations@sirum.org") > -1)){  //Then its reading a Donation Shipped email, and will update the row for that facility with the tracking number
          console.log("Shipped email")
          deal_with_shipped(content, main_page,pickup_sheet, contact_sheet,data_val_sheet, tracking_db_sheet);                
      
        } else if(subject.indexOf("Donation Received") > -1){ //Then it's reading a Donation Received email, and will update the row for that donation
          console.log("Received email")
          deal_with_received(content, main_page);
          
        } else if (~ subject.indexOf('Tracking: Tendered to FedEx Summary Outbound')){
          check_fedex_summary(content, main_page,ss)
          
        } else if(subject.indexOf("#Bertha") > -1){ //based off #Bertha in the subject, and tge ints col1: cxxxx | col2: fnnnn | col3: gbbb | col5:bg
          console.log("Berth Email API")
          log_email_api(subject, contact_sheet, main_page)
          j = messages.length;
          
        } else if(subject.indexOf("Pickup Missed") > -1){
          console.log("Dealing with missed pickup email")
          deal_with_missed_pickups(content, main_page)
          j = messages.length;

        } else if(from_amazon(subject)){
          queue_amazon_emails(subject,content, supplies_email_sheet)
          
        } else if(subject.indexOf("Auto-Log API: ") > -1){ //Then it's an API request. Could be to log a donation by email (e.g. for Pharmerica), cancel a pickup
          if(subject.indexOf("Log Donation") > -1){
             log_donation_by_email(content, contact_sheet, main_page)
          //Have not yet used either of these   
          } else if(subject.indexOf("Cancel Pickup") > -1){
            cancel_pickup(content, main_page)
          } else if (subject.indexOf("Set Pickups") > -1){
          }
        }
      }
    }
    label.removeFromThread(threads[i]) //removes the label on the thread, and at this point all the messages within it have been processed
  }
  
  tag_sfax_rows(ss,date,main_page)

  custom_unlock("auto_log")
}



//if there's a crash, make sure to release the lock so that we don't destroy all the workflow
function deal_with_crash(content){
  var cache = CacheService.getDocumentCache()
  var text_to_search = "StartFunctionError MessageTriggerEnd" //the header of the table in the email that stores the function name
  var index_start_of_chart = content.indexOf(text_to_search) + text_to_search.length
  var new_content = content.substring(index_start_of_chart)
  var index_end_time = new_content.indexOf(" AM")
  if(index_end_time == -1) index_end_time = new_content.indexOf(" PM")
  var extracted_function_name = new_content.substring(index_end_time + 3).trim().split(" ")[0].trim()
  
  var cached_func_name =  cache.get("function_name");
  if(cached_func_name){ //must exist for this to be relavant
    if(extracted_function_name == cached_func_name){ //then we need to unlock
      custom_unlock(cached_func_name);
    }
  }
  debugEmail("Dealt with crash email!", "Extracted name: " + extracted_function_name + "; Cached name: " + cached_func_name)
}



//Made to catch the cases (so far just one), where v1 was tracking and rescheduling something too many times and because the 
//item wasn't in bertha, it just kept rescheduling for years. oof.
function deal_with_missed_pickups(content, main_page){
  var tracking_num = content.substring(content.indexOf("tracking number")+16, content.indexOf("tracking number") + 31)
  var current_sheet_data = main_page.getDataRange().getValues();
  var facility = content.substring(content.indexOf("from ")+5,content.indexOf(" was not picked up")).replace(/(\r\n|\n|\r)/gm," ").trim()
  
  var indexes = get_main_indexes()  
  var index_tracking_number = indexes.indexTrackingNum
  var index_facility = indexes.indexFacilityName
  var found = false
    
  for(var n=0;n<current_sheet_data.length;++n){  //find the row of this donation by finding tracking number      
    if(current_sheet_data[n][index_facility].toString().trim() == facility){
      console.log("Found facility")
       if(current_sheet_data[n][index_tracking_number].toString().trim().length == 0){ //just a safeguard, shouldnt update fields that already have a date
         console.log("we're tracking")
         found = true
       }
    }
  }
  
  if(!found){
    console.log("not tracking: " + facility + "\n" + tracking_num)
  }
    
}


//dealWithSFax
//Takes the sfax received email and matches the number to a contact
//-----------------------------------------

function deal_with_sfax(subject, contact_sheet, main_page, content){   
   var fax_number = subject.substring(subject.indexOf("+")+1,subject.indexOf("+")+17)  //Main identifier, extracted from subject
   var fax_id = content.substring(content.indexOf("*ID:* ")+6,content.indexOf("*To:*")-2)
   var recipient_number = content.substring(content.indexOf("*To:* ")+6,content.indexOf("*From:*")-2).trim()
   
   var recipients_to_ignore = RECIPIENTS_TO_IGNORE
   if(recipients_to_ignore.indexOf(recipient_number) > -1){
     console.log("received fax from facility to ignore");
   } else {
     subject += "\n" + fax_id + "\n" + Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
     add_donation_row(subject, fax_number, "Not Found", contact_sheet, main_page,"")
   }
}



//dealWithShipped
//In charge of updating tracking numbers using the Donation Shipped emails 
//and creating new rows if they dont match a fax. 
//--------------------------------

function deal_with_shipped(content, main_page, pending_page, contact_sheet,data_val_sheet, tracking_db_sheet){ 
  console.log(content.length)
  
  if((content.indexOf("out of office") > -1)) return; //shortcuts the reply emails we might get
  
  //TODO: these are from bertha 1.0, switch this to more robust RegExs
  var tracking_number = content.substring(content.indexOf("number")+7, content.indexOf("number")+22)
  var from_facility = content.substring(content.indexOf("from")+5, content.indexOf("was")).replace(/(\r\n|\n|\r)/gm," ").replace(/ +(?= )/g,''," ").trim() //has to remove magic newline characters for some reason
  var current_sheet_data = main_page.getDataRange().getValues();
  
  var main_indexes = get_main_indexes()
  var index_tracking_number = main_indexes.indexTrackingNum
  var index_shipped = main_indexes.indexShippedEmail
  var index_facility = main_indexes.indexFacilityName
  var index_action = main_indexes.indexPend
  var index_resolved =  main_indexes.indexHumanIssues

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


  
  var coleman_exclude_accounts = getPharmacyNames(data_val_sheet)
  var date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy ")    

  console.log("HERE NOW")
  console.log(tracking_number)
  console.log(from_facility)
  
  var found_row = 0
  var need_dup = true
  var match_facility = false
  
  for(var n=0;n<current_sheet_data.length;n++){  //find the row of this facility   
    
    if(current_sheet_data[n][index_facility].toString().trim().toUpperCase() == from_facility.trim().toUpperCase()){
      match_facility = true
      
      if(current_sheet_data[n][index_tracking_number].toString().trim() == tracking_number.trim()){ //since one email for donation shipped is sent to a bunch of people form that facility, there will be copies of the tracking, but since you insert top-bottom then you will see a copy this way, and then ignore the email
        n = current_sheet_data.length
        need_dup = false    

      } else if((current_sheet_data[n][index_tracking_number].toString().length == 0) && (current_sheet_data[n][index_action].toString().indexOf("DO NOT PEND") == -1) && (current_sheet_data[n][index_action].toString().indexOf("SUPPLY REQUEST") == -1) && (current_sheet_data[n][index_action].toString().indexOf("EMAIL") == -1)){      //identifies the first row from this facility that is without tracking # and which does not say "DO NOT PEND" or isn't a supply request
        
        main_page.getRange((n+1), (index_tracking_number+1)).setValue(tracking_number.trim())
        var shipped_contents = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss") //keeps track of when the pickup was set              
        main_page.getRange((n+1), (index_shipped+1)).setValue(shipped_contents)
        if(current_sheet_data[n][index_action].toString().length == 0){ //then we never pended it, so it was unexpected but auto-resolved
          main_page.getRange((n+1), (index_action+1)).setValue("UNEXPECTED SHIPMENT")
          main_page.getRange((n+1), (index_resolved+1)).setValue("Auto-Resolved because shipped before pickup was pended.")
        }
        addTrackingToDB(tracking_number.trim(), from_facility.trim(), tracking_db_sheet)
        n = current_sheet_data.length  //so that it doesnt update all fields, stop after the first one
        need_dup = false
        
      } else { //then its a row with a donation from this facility, but already linked to one tracking number. Want to check the date stamps
        //Here want to distinguish between if, for example, you had a bunch of boxes in one shipment you should
        //group together, or if its just a box that shipped without your knowledge. In the case where you get a
        //shipment without a fax, you need to create a row at the bottom, not lose it up in the sheet.
        //So you check column 11, the shipped one and look for the date, and only set found_row = n if the date is today
        //since that means that in this same batch, there were other boxes shipped today that we knew to expect
        var shipped_cell = current_sheet_data[n][index_shipped].toString()
        var date_shipped = shipped_cell.substring(0,10)
        var today = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
        if(date_shipped == today){
          found_row = n
        }
      }
    }          
   }  
   
   //If you get here and the following fields are both tru, there was no row to link to a tracking number but there were others 
   //from the facility. So it's probably that the fax had more than one coversheet inside of it, and you need to create a new row
   //just like the last one used, and input the new tracking number.
   
   if(need_dup && (found_row > 0)){
     duplicateRowBelow(main_page,found_row) //a helper function that duplicates the last row of this facility (which will be in the same shipment
     main_page.getRange((found_row+2),(index_tracking_number+1)).setValue(tracking_number.trim())
     addTrackingToDB(tracking_number.trim(), from_facility.trim(), tracking_db_sheet)     
   } 
   
   //If you get here, then we've got no instance of that facility showing up in the sheet OR there are no other rows/boxes from today.
   //It might be that we don't have it in my contacts list, which might depend on someone in the future correcting the spelling of a facility name
   //and we don't want to lose the tracking info in that case. So we need to keep a log of unlinked tracking numbers 
   //and their facilities, since there shouldnt be any mysterious shipped emails. So we will directly add a row with the name
   //and the tracking number. And send an email about this. So we ALWAYS keep track of the shipped emails.
   //The second logic test here accounts for the case where the row is found elsewhere but it's not from today, but dont want to lose a 
   //shipped email from today if you can't match it with any other emails from today. This happens a lot with Worthington
   if((!match_facility) || (match_facility && (found_row == 0) && (need_dup))){
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
       if(data[i][contactsheet_index_facility].toString().toLowerCase().indexOf(from_facility.trim().toLowerCase()) > -1){ //then we have the contact, just didn't have a fax. So it's a different situation
         state = data[i][contactsheet_index_state].toString()
         action = data[i][contactsheet_index_issue].toString()
         contact = data[i][contactsheet_index_contact].toString()
         data_format = data[i][contactsheet_index_import_format].toString()
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
     addTrackingToDB(tracking_number.trim(), from_facility.trim(), tracking_db_sheet)
     
     auto_group(from_facility)
    
     
     send_alert_email(5,"","",message,"")
   }
   
   
   //Check the pickups page for any outstanding pickups to this facility and cancel them! 
   check_for_pickups_to_cancel(pending_page,from_facility)
}







//checkForPickupsToCancel
//Will check for any pickups that are outstanding but should be cancelled since we got a 
//shipped email from one of those facilities already. Currently will send out an email about
//these facilities, but in the future it should be able to cancel them automatically through
//sirum.org itself.
//--------------------------------

function check_for_pickups_to_cancel(pending_page,from_facility){
   var pending_data = pending_page.getDataRange().getValues();
   for(var n = 0; n < pending_data.length; ++n){
     if(pending_data[n][0].toString() == from_facility.trim()){
        var pickup = pending_data[n][4].toString()
        var pickup_date = ""
        if(pickup.indexOf(",") == -1){ //then it was never rescheduled
          pickup_date = pickup
        } else { //then it's been rescheduled at least once and you need to check the most recent reschedule date
          pickup_date = pickup.substring(pickup.lastIndexOf(",")+2)
        }

        var date_obj_pickup = getDateFromString(pickup_date) //looks at first column and gets date pended       
        var today = getDateFromString(Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy "))
        var message = from_facility
        message += " " + "with confirmation number " + pending_data[n][6].toString()
        if( ((date_obj_pickup - today)) > 0){ //then you need to cancel this. at them moment no way to cleanly do this, but can send email
            send_alert_email(7,"","",message)
        }     
     }
   }  
}






//dealWithReceived
//In charge of updating tracking numbers using the Donation Received emails. Matches by tracking number at this point.
//--------------------------------

function deal_with_received(content, main_page){
    content = content.replace(/(\r\n|\n|\r)/gm," ").replace(/ +(?= )/g,''," ")
    var tracking_number = content.substring(content.indexOf("number")+7, content.indexOf("number")+22)
    var current_sheet_data = main_page.getDataRange().getValues();
    var facility = content.substring(content.indexOf(",")+2,content.indexOf("'s"))
    
    var indexes = get_main_indexes()  
    var index_tracking_number = indexes.indexTrackingNum
    var index_received = indexes.indexReceivedEmail
    //var indexColemanTracking = indexes.indexColemanTracking

    var found = 0
    
    for(var n=0;n<current_sheet_data.length;++n){  //find the row of this donation by finding tracking number      
      if(current_sheet_data[n][index_tracking_number].toString().trim() == tracking_number){
        if(current_sheet_data[n][index_received].toString().length == 0){ //just a safeguard, shouldnt update fields that already have a date
          found = 1
          main_page.getRange((n+1),(index_received+1)).setValue(Utilities.formatDate(new Date(),"GMT-07:00","MM/dd/yyyy"))
        }
      } //else if(tracking_number.indexOf(current_sheet_data[n][indexColemanTracking].toString().trim()) > -1){ //then this is the row, but never shipped email
     // }
    }
}










//logDonationByEmail
//When Email API is used to log donations (for example, from Pharmerica), then this function handles that.
//---------------------

function log_donation_by_email(content, contact_sheet, main_page){

  var facility = content.substring(content.indexOf("Facility: ")+10, content.indexOf("Number Of")-1)
  var number_boxes = content.substring(content.indexOf("Number Of Boxes: ")+17, content.indexOf("Contact")-1)
  var contact = content.substring(content.indexOf("Contact: ")+8, content.indexOf("Supplies")-1)
  
  var supplies = ""
  var upload_name = ""
  
  if(content.indexOf("Records Filename:") > -1){
    var supplies_requested = (content.indexOf("Supplies:")+9) != (content.indexOf("Records Filename:")-2)
    if(supplies_requested) supplies = content.substring(content.indexOf("Supplies:")+9, content.indexOf("Records Filename:")).trim()
    upload_name = content.substring(content.indexOf("Records Filename:")+17,content.indexOf("END"))
    
  } else {
    var supplies_requested = (content.indexOf("Supplies:")+9) != (content.indexOf("END")-2)
    if(supplies_requested) supplies = content.substring(content.indexOf("Supplies:")+9, content.indexOf("END")).trim()
  }  
  
  var indexes = get_main_indexes()  
  var index_contact = indexes.indexContact
  
  var res = 1;
  var fake_number = "Email-Log"
  if(upload_name.length > 0) fake_number += "\nRecord Uploaded Filename: " + upload_name

  if(number_boxes.trim() == '0'){
    Logger.log("adding supply request row")
    res = add_donation_row("Email-Log-Supply", fake_number,facility.trim(), contact_sheet, main_page, supplies)  //the return value is 0 if there was a typo in the name
    var last_row = main_page.getLastRow()
    main_page.getRange(last_row, index_contact+1).setValue(contact) //override contact sheet  
  }
    
  for(var i=0;i<parseInt(number_boxes,10);i++){   //has to do this for each box, as per the email specs
    res = add_donation_row("Email-Log", fake_number,facility.trim(), contact_sheet, main_page, supplies)  //the return value is 0 if there was a typo in the name
    var last_row = main_page.getLastRow()
    main_page.getRange(last_row, index_contact+1).setValue(contact) //override contact sheet
    
    if(res == 0) i = parseInt(number_boxes,10)
  } 
}


//logEmailAPI
//When an email is sent with our log api subject formatting. For now, just through Cognito
//Added 10/2018
//redon 11/2018
//---------------

function log_email_api(subject, contact_sheet, main_page){
  var trimmed_subject = subject.replace("#Bertha","")
  if(trimmed_subject.toLowerCase().indexOf("donation contact not found") > -1){ //then it's a special not-pre-entered value
    debugEmail("[Action Required]: Cognito Contact Not Found","Received email from Cognito with subject: " + subject)
  }
  
  var subj_arr = trimmed_subject.split("|")
  var key_vals = []
  for(var i = 0; i < subj_arr.length; i++){
    var element_arr = subj_arr[i].trim().split(":")
    if(element_arr.length > 1){ //this should be two,but not catching it caused the super long error that one time
      var column = element_arr[0].substring(3)
      var content = element_arr[1].trim()
      key_vals.push([column,content])
    } else{
      return
    }
  }
  
  new_addDonationRow(key_vals, main_page, contact_sheet)
}







//function: cancelPickup
//Since the script will set pick ups automatically, if we check a fax and realize it shouldnt have been set
//we can send an email to Bertha to cancel it, and do so in bulk if necessary for whatever reason, easier than using
//sirum.org and going account to account
//-----------------------------

function cancel_pickup(content, main_page){
  var facilities = []
  var lines = content.replace( /\n/g, "," ).split( "," )
  for (var i = 0; i < lines.length; i++){
    var facility = lines[i].trim()

    //Interact with the API or script Adam writes to do the meat of the operation here
    //should also go through and find any rows that DO have this facility and DO NOT have a shipped email, which will be crossed through or removed
    
  }
}




//returns [state,issue,pickup_loc,supp_notes, v1_format]
function name_contact_lookup(name, contact_sheet){
  var res = []
  var data = contact_sheet.getDataRange().getValues()
  
  var indexes = get_contact_indexes()  

  var contactsheet_index_faxnumber = indexes.indexFaxnumber
  var contactsheet_index_facility = indexes.indexFacility
  var contactsheet_index_state = indexes.indexState
  var contactsheet_index_pickup = indexes.indexPickup
  var contactsheet_index_issue = indexes.indexIssue
  var contactsheet_index_contact = indexes.indexContact
  var contactsheet_index_id = indexes.indexId
  var contactsheet_index_last_donation_date = indexes.indexLastDonationDate
  var contactsheet_index_supplies_notes = indexes.indexSuppliesNotes
  var contactsheet_index_salesforce_contacts = indexes.indexSalesforceContacts
  var contactsheet_index_import_format = indexes.indexImportFormat
  var contactsheet_index_all_emails = indexes.indexAllEmails

  
  for(var i = 0; i < data.length; i++){
    if(data[i][contactsheet_index_facility].toString().trim() == name){
      return [data[i][contactsheet_index_state] + " ",data[i][contactsheet_index_issue] + " ",data[i][contactsheet_index_pickup] + " ",data[i][contactsheet_index_supplies_notes] + " ", data[i][contactsheet_index_import_format] + " "]
    }
  }
  return []
}


//Given just the column letters, and the contents to put in those columns
//key_vals = [["C","Name"],["U","Supplies"]]
function new_addDonationRow(key_vals, main_sheet, contact_sheet){
  main_sheet.appendRow(["","Bertha","","","","","","","","","","","","","","","","#BERTHA EMAIL API"])
  var row_num = main_sheet.getLastRow()
  for(var i = 0; i < key_vals.length; i++){
    var curr_range = main_sheet.getRange(key_vals[i][0] + row_num)
    curr_range.setDataValidation(null)
    curr_range.setValue(key_vals[i][1])
  }
  var date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy ")    

  var indexes = get_main_indexes()
  var indexState = indexes.indexState
  var indexIssues = indexes.indexIssues
  var indexSuppliesNotes = indexes.indexSuppliesNotes
  var indexPickup = indexes.index_pickup
  var indexInSirum = indexes.indexInSirum

  var contact_info = name_contact_lookup(main_sheet.getRange("C"+row_num).getValue(), contact_sheet) //returns [state,issue,pickup_loc,supp_notes, v1_import_format]

  if(contact_info.length > 0){
    main_sheet.getRange(row_num,(indexState+1)).setDataValidation(null).setValue(contact_info[0])
    main_sheet.getRange(row_num,(indexIssues+1)).setDataValidation(null).setValue(contact_info[1])
    main_sheet.getRange(row_num,(indexPickup+1)).setDataValidation(null).setValue(contact_info[2])
    main_sheet.getRange(row_num,(indexSuppliesNotes+1)).setDataValidation(null).setValue(contact_info[3])
    main_sheet.getRange(row_num,(indexInSirum+1)).setDataValidation(null).setValue(contact_info[4].length > 0 ? contact_info[4] + " " + date : "")
  }
}



//addDonationRow
//The mechanics of adding a row to the donations sheet, used for faxes or emails, and with error checking. So nobody actually 
//needs to hard code something into the sheet.
//-------------------
//for pharmacies: res = addDonationRow("Email-Log","Email-Log" + filename,, facility.trim(), contact_sheet, main_page, supplies)  //the return value is 0 if there was a typo in the name

function add_donation_row(subject, fax_number, facility, contact_sheet, main_page, supplies){ //pass the fields of a row and it will add it. be used both for fax and email requests
  console.log('adding donation row: ' + subject)
      
  var state = "State Unknown" //all the default values
  var pickup = ""
  var attention_req = "No"
  var salesforce_contacts = ""
  var supplies_notes = ""
  var v1_format = ""
  var facility_lead = ""
  var data = contact_sheet.getDataRange().getValues(); // read all data in the sheet
  var found_contact = "False"
  var colorado_forward_req = "" //will put a FORWARD in the CO Fax cell so that someone can make a note of whether they forwarded the CO Fax
  var issueAutoPop = ""

  var indexes = get_contact_indexes()  

  var contactsheet_index_faxnumber = indexes.indexFaxnumber
  var contactsheet_index_facility = indexes.indexFacility
  var contactsheet_index_state = indexes.indexState
  var contactsheet_index_pickup = indexes.indexPickup
  var contactsheet_index_issue = indexes.indexIssue
  var contactsheet_index_contact = indexes.indexContact
  var contactsheet_index_id = indexes.indexId
  var contactsheet_index_last_donation_date = indexes.indexLastDonationDate
  var contactsheet_index_supplies_notes = indexes.indexSuppliesNotes
  var contactsheet_index_salesforce_contacts = indexes.indexSalesforceContacts
  var contactsheet_index_import_format = indexes.indexImportFormat
  var contactsheet_index_all_emails = indexes.indexAllEmails

  
  
  //For updating the last donation date
  var CurrentDate    = new Date() ;  
  var date = Utilities.formatDate(CurrentDate, "GMT-07:00", "MM/dd/yyyy ")    
  date += " " //could, down the road, contain more information
      
  if(facility.indexOf("PHARMACY FORM ENTERED:") > -1){
      issueAutoPop = "New user submitted pharmacy form. Used the email that is stored in contacts column here - add to Salesforce and check the way name is entered here."
      facility =  facility.replace("PHARMACY FORM ENTERED:","").trim()
  }
  
  //interacting with teh contact sheet in this loop
  for(var n=0;n<data.length;++n){ // iterate row by row and examine data in column A of contact sheet, looking for a matching contact
    
    if((data[n][contactsheet_index_faxnumber].toString().trim().indexOf(fax_number) > -1)|| (data[n][contactsheet_index_facility].toString().trim().toLowerCase() == facility.toLowerCase())){  //can match for either a known number (from sfax) or known name (from email)
      
      if(facility == "Not Found"){ //only need facility name if its not actually an email
        facility = data[n][contactsheet_index_facility].toString().trim()
      }
      state = data[n][contactsheet_index_state] //find all the associated information necessary here and below
      pickup = data[n][contactsheet_index_pickup]
      attention_req = data[n][contactsheet_index_issue]
      salesforce_contacts = data[n][contactsheet_index_salesforce_contacts]
      supplies_notes = data[n][contactsheet_index_supplies_notes]
      v1_format = data[n][contactsheet_index_import_format]
      facility_lead = data[n][contactsheet_index_contact]
      found_contact = "True"
     
      contact_sheet.getRange((n+1),(contactsheet_index_last_donation_date+1)).setValue(date)          //Update last donation date   
      
    }
  }
      
 if(state.toString().trim().length == 0){
    issueAutoPop += " ; DOES NOT HAVE STATE IN SALESFORCE"
 }
 
 var do_not_set_pickup = ""
  //Send emails if theres any required action  
 if(attention_req != "No"){ //Then there is required action, could further stratify by type of action with error_code and who to send the email to
      if(attention_req.indexOf("DO NOT PEND") > -1){
        do_not_set_pickup = "DO NOT PEND"  //dont set a pickup or make a line for a fax that isnt a donatio
      } else {
          send_alert_email(2,fax_number,facility,attention_req)//dont send email if it's a do-not-set-pick-up or a reminder
      }
 }
  
  var color = "white"
  var issueToAdd = ""
  
  if(state.length > 0){
    var split_arr = state.split(";")
    var recipient = split_arr.length == 2 ? split_arr[1] : ''
    
    if(recipient.toLowerCase().indexOf("open bible") > -1){ //we're still gonna set the pickup, but need to send an email about CO facility
      colorado_forward_req = "FORWARD ME"
      color = "purple" //color the whole row purple
      send_alert_email(2,fax_number,facility,"My records show this is a Colorado facility")
    }
  }
        
      
  //If theres any issues that prevent scheduling, check here. Either we dont have the number of couldnt read the email.  
  if(facility=="Not Found"){ //Then contact not found and appropriate email must be sent
      issueToAdd = " FAX NUMBER NOT FOUND: "
      issueToAdd += fax_number
      send_alert_email(1, fax_number, "","");
    
  }  else if(facility.indexOf("DELETE") > -1){ //this short circuit keeps it from adding 
      return 0
      
  } else if(found_contact == "False" && fax_number == "Email-Log"){ //then you need an error message for the api log. can be expanded to further error checking
      //issueAutoPop = "New user submitted pharmacy form. Used the email that is stored in contacts column here - add to Salesforce and check the way name is entered here."
      //facility =  facility.replace("PHARMACY FORM ENTERED:","").trim()
      //send_alert_email(3, fax_number, facility,"Pharmacy form submitted with an email that didn't match our records, entered facility name as:     ")
      /*if((facility.indexOf("PharMerica") > -1) || (facility.toLowerCase().indexOf("polaris") > -1) || (facility.indexOf("Consonus") > -1) || (facility.indexOf("Gayco") > -1)){
        issueToAdd = " FAX NUMBER NOT FOUND: "
        issueToAdd += facility
      }*/
      //return 0  //use to short circuit any more work if theres an unfound contact
  } else {        
      //Interact with API or script Adam creates to set the actual pickup   
  }
      
  //supplies = updateSupplies(facility, supplies, contact_sheet)
  var v1_notekeeping = ""
  
  if((v1_format.toString().trim().length == 0) && (facility !== "Not Found")){
    issueAutoPop += "\nContact doesn't have a specific V1 import format in Salesforce. Double check Donor is in 2-Contacts Sheet"
  } else {
    if(v1_format.toLowerCase().indexOf("coleman") == -1){
      v1_notekeeping = "#NO"
    }
  }

   if(~ subject.indexOf('Supply')){
    do_not_set_pickup = 'SUPPLY REQUEST'
  } 


  if(salesforce_contacts.toString().trim().length > 0){
    facility_lead += "\n----------\n" + salesforce_contacts
  }
  
  //Regardless of issues, still create a row for each fax from a donor, which a user can edit manually for future use
  if(v1_format.length > 0) v1_format += " " + date
  
  if(subject.indexOf("Email-Log") > -1){
    if(fax_number.indexOf("<NO FOLDER ID>") > -1){
      issueAutoPop += "\nThe facility does not have a designated folder ID on the liver server's drop folders"
    }
    subject = fax_number.trim() + "\n" + date
    v1_notekeeping += "\n" + fax_number.trim().replace("Email-Log","").replace("<NO FOLDER ID>","").trim()
  }
  


  main_page.appendRow([do_not_set_pickup, "Bertha", facility, state, attention_req,facility_lead,pickup, colorado_forward_req, supplies_notes, supplies, v1_format, v1_notekeeping.trim(), issueAutoPop, "", "", "","",subject, "","","","", "",issueToAdd,Math.floor(Math.random() * 500000)]);
  var last_row = main_page.getLastRow()
  main_page.getRange(last_row, 1, 1, main_page.getMaxColumns()).setBackground(color) //so it doesn't drag down the green of a supply request, or yellow or purple or something

  if(facility != "Not Found"){
    auto_group(facility)
  }
  
  return 1 
}




