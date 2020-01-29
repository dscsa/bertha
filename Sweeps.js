//----------------------------------------ISSUE-SWEEP (FIND THE YELLOWS AND RESCHEDULE)-----------------------------------------------------------------------------------------------------


//dailyIssueSweep
//Will be triggered once a day to check on any cases that require attention:
// 1) If there is a donation that has been scheduled (a line is created), but it has not yet been picked up after X days, or since
// the last reschedule
// 2) If there is a donation that has been picked up but not delivered after X days
//Has its own boiler plate and utilizes some helper functions, but not triggered by the Auto-Log functionality

function issueSweep(start){
 
  //Boiler plate, same as Auto-Log, to get its bearings
  start = start || 0;
  
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var main_page = ss.getSheetByName("1 - Main Page")
  var pending_page = ss.getSheetByName("3 - Pickups")
  var data_val_page = ss.getSheetByName("Data Validation")
  
  var attention_items = []; //will be filled with any issues, and then passed to sendAlertEmail so they can be listed and sent
  var day = 1000*60*60*24 //since date arithmetic gives answers in milliseconds, declare this variable now
  custom_lock("issueSweep")


  var days_to_wait_for_pickup = 1  //could, down the road, pull from an extra variable sheet, so nobody needs to edit the script
  var days_to_wait_for_arrival = 7
    
  
  var main_indexes = getMainPageIndexes()
  var contact_indexes = getContactPageIndexes()
  
  var index_facility = main_indexes.indexFacilityName
  var index_action = main_indexes.indexPend
  var index_shipped = main_indexes.indexShippedEmail
  var index_received = main_indexes.indexReceivedEmail
  var indexRowID = main_indexes.indexRowID
  var index_notes = main_indexes.indexActualIssues
  var index_co = main_indexes.indexCOFwd
  var indexState = main_indexes.indexState
  var indexColemanTracking = main_indexes.indexColemanTracking
  var indexResolved = main_indexes.indexHumanIssues
  var indexInSirum = main_indexes.indexInSirum
  var indexContact = main_indexes.indexContact
  var indexRawFax = main_indexes.indexRawFax

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

  
  var pharmacy_list = getPharmacyNames(data_val_page)
  var exclude_list = getColemanExclude(data_val_page)

  main_page.getRange(1,(index_shipped+1),main_page.getMaxRows(),2).setNumberFormat("@STRING@")//set shipped & received columns to be pure strings so the dates are more easy to handle

  var rescheduled_facilities = []
  var current_sheet_data = main_page.getDataRange().getValues();
        
  for(var n=1;n<current_sheet_data.length;n++){  //loop through all the rows, checking for issues
    var issue_cell = main_page.getRange((n+1),(index_notes+1)) //the column where you make a mark of the issues so they can be filtered
    var range = main_page.getRange((n+1),1,1,main_page.getMaxColumns())    //use this for range.setBackground, which highlights
    var row_id = current_sheet_data[n][indexRowID]
    
    
    
    //rehighlight any issue
    if((current_sheet_data[n][index_notes].toString().trim.length > 0) && (current_sheet_data[n][indexResolved].toString().toLowerCase().indexOf("resolv") == -1)){
      range.setBackground("yellow")
    }
    
    if((current_sheet_data[n][index_notes].toString().indexOf("UNEXPECTED SHIPMENT") > -1) && (current_sheet_data[n][indexResolved].toString().toLowerCase().indexOf("resolved") == -1)){ //how we keep track of the unexpectedly shipped
      range.setBackground("yellow")
      var new_error = "There was an unexpected shipment from " + current_sheet_data[n][index_facility] + " that might be problematic. Row ID: " + row_id
      var text = new_error + ";" + current_sheet_data[n][index_notes]
      attention_items.push(new_error)
    }
    
    if((current_sheet_data[n][indexColemanTracking].toString().toLowerCase().indexOf("todo coleman") > -1)
                        //&& (pharmacy_list.indexOf(current_sheet_data[n][index_facility].toString().toLowerCase().trim()) == -1) // remove this
                        //&& (exclude_list.indexOf(current_sheet_data[n][indexState].toString().trim()) == -1)  // remove this
                        && (((current_sheet_data[n][index_notes].toString().trim().length > 0) && (current_sheet_data[n][indexResolved].toString().toLowerCase().indexOf("resolv") > -1)) 
                           || (current_sheet_data[n][index_notes].toString().trim().length == 0))
                        && ((current_sheet_data[n][index_co].toString().length == 0) || (current_sheet_data[n][index_co].toString().indexOf("ineligible") > -1))
                        && (current_sheet_data[n][index_shipped].toString().trim().length > 0) //must have been shipped already (this'll keep the flag from going off too early
                        && (current_sheet_data[n][indexRawFax].toString().indexOf("Sfax") > -1) //must have been an sfax
       ){
      var new_error = "Label whether this row is a Coleman To-Do. Row ID: " + row_id
      if(current_sheet_data[n][index_notes].toString().indexOf(new_error) == -1){ //if we haven't already labeled a row, then add it
        var text = new_error + ";\n" + current_sheet_data[n][index_notes]
        attention_items.push(new_error) //only send email with new errors
        issue_cell.setValue(text) //keep track of all errors here
        range.setBackground("yellow")
      }
    }
    
    if(current_sheet_data[n][indexState].toString().trim().length == 0){
      range.setBackground("yellow")
      var new_error = "No state field for " + current_sheet_data[n][index_facility] + " This will cause issues with archiving & Coleman. Row ID: " + row_id
      var text = new_error + ";\n" + current_sheet_data[n][index_notes]
      issue_cell.setValue(text)

    }
    
    if(current_sheet_data[n][index_co].toString().indexOf("FORWARD ME") > -1){
      range.setBackground("purple")
      var new_error = "There is a fax from " + current_sheet_data[n][index_facility] + ", which is a CO facility and hasn't been forwarded. Row ID: " + row_id
      var text = new_error + ";\n" + current_sheet_data[n][index_notes]
      issue_cell.setValue(text)
      attention_items.push(new_error)
    }

    if(current_sheet_data[n][index_shipped].toString().trim().length > 0){          //then it's been picked up. in which case it may still need delivery, or it may be ok
      
      if(current_sheet_data[n][index_received].toString().trim().length == 0){       //then it hasn't been received yet
        var pend_cell = current_sheet_data[n][index_action].toString()
        var num_time_rescheduled = (pend_cell.split(",").length)
        var string_date_pended = ""
        if(pend_cell.indexOf(",") == -1){ //then it has not yet been rescheduled
          string_date_pended = pend_cell.substring(5,15)
        } else { //then it's been rescheduled at least once and you need to check the most recent reschedule date
          string_date_pended = pend_cell.substring(pend_cell.lastIndexOf(",")+2).trim()
        }

        string_date_pended += " " //because the only way to currently do this is with a trailing space        
        var date_pended = getDateFromString(string_date_pended) //looks at first column and gets date pended
        
        var today = getDateFromString(Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy "))
        var supposed_received_date = businessDaysFromDate(date_pended,7)
        if(( ((today - supposed_received_date)/day) >= 0)){ //then there's some issue here with the pickup missing
          range.setBackground("yellow")
          var new_error = "A donation from " + current_sheet_data[n][index_facility] + " should have arrived. Row ID: " + row_id
          var text = new_error + ";\n" + current_sheet_data[n][index_notes]
          issue_cell.setValue(text)
          attention_items.push(new_error)
        }
      }                 

    } else {              //then it hasn't been picked up, and we need to know if that's cause for concern, and reschedule if necessary    
      
      if((current_sheet_data[n][index_action].toString().indexOf("PEND ") > -1 ) && (current_sheet_data[n][index_action].toString().indexOf("DO NOT PEND") == -1)){ //check that it's been pended (but is not a do not pend)
      
        //then need to check if it's on first pend or been rescheduled to get the last date it was pended (meaning the last day we 
        //tried to set a pickup)
        var pend_cell = current_sheet_data[n][index_action].toString()
        var num_time_rescheduled = (pend_cell.split(",").length)
        var cell_notation = "A" + (n+1)
        var string_date_pended = ""
        if(pend_cell.indexOf(",") == -1){ //then it has not yet been rescheduled
          string_date_pended = pend_cell.substring(5,15)
        } else { //then it's been rescheduled at least once and you need to check the most recent reschedule date
          string_date_pended = pend_cell.substring(pend_cell.lastIndexOf(",")+2).trim()
        }

        string_date_pended += " " //because the only way to currently do this is with a trailing space        
        var date_pended = getDateFromString(string_date_pended) //looks at first column and gets date pended
        
        var today = getDateFromString(Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy "))
        var supposed_pickup_date = businessDaysFromDate(date_pended,1)

        if(( ((today - supposed_pickup_date)/day) >= 0)){ //then it's needs to be rescheduled if its been more than 1 business day
          range.setBackground("yellow")
          var facility = current_sheet_data[n][index_facility].toString()
          
          
          
          if(num_time_rescheduled > 0) attention_items.push(message) //dont add it to the email if this is the first reschedule, Victoria's preference
          
          if(rescheduled_facilities.indexOf(facility) == -1){
            var rescheduled = reschedule(facility,string_date_pended,pending_page, today,ss)
            
            if(rescheduled == 'FEDEX'){
              pend_cell += ", " + Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy") //update the cell in column A to show we've set another pickup
              main_page.getRange((n+1),(index_action+1)).setValue(pend_cell) 
              var new_error = "A pickup from " + facility + " must be rescheduled via FEDEX.COM. Row ID: " + row_id
              var message = new_error + ";\n" + current_sheet_data[n][index_notes]
              issue_cell.setValue(message)
              attention_items.push(new_error)
              
            } else if(rescheduled == 'SUCCESS'){
              pend_cell += ", " + Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy") //update the cell in column A to show we've set another pickup
              main_page.getRange((n+1),(index_action+1)).setValue(pend_cell) 
              rescheduled_facilities.push(facility)
              var new_error = "A pickup from " + facility + " is going to be rescheduled. Row ID: " + row_id
              var message = new_error + ";\n" + current_sheet_data[n][index_notes]
              new_error += " This has happened " + num_time_rescheduled + " time(s)."
              if(num_time_rescheduled >= 3) new_error += "You may want to look into this"
          
              issue_cell.setValue(message)
              attention_items.push(new_error)

            } else {
            }
          }
        }   
      }
    }
  }
  
  if(attention_items.length > 0){ //sends an email of issues if there are any (essentially what Allison does right now)
    sendAlertEmail(4,"","","",attention_items)
  }  
  
  custom_unlock("issueSweep")
}





//reschedule
//For a given facility, will reschedule a pickup if this has been a missed pickup (will know by
//checking if a pickup has already been set). If it does succeed, will return true, otherwise
//it will return false
//-------------------
function reschedule(facility,date_pended, pending_page, today_date,ss){
     
  var date_column_cell_notation = "E:F"
   pending_page.getRange(date_column_cell_notation).setNumberFormat("@STRING@")

  var contact = "";
  var num_boxes = "";
  
   var data = pending_page.getDataRange().getValues();
   for(var i=1;i<data.length;++i){   
    var last_pend_cell = data[i][4].toString()
    Logger.log("HERE")
    Logger.log(last_pend_cell)
    var last_pend_date = ""
    if(last_pend_cell.indexOf(",") > -1){
      last_pend_date = last_pend_cell.substring(data[i][4].toString().lastIndexOf(",")+2)
    } else {
      last_pend_date = data[i][4].toString().substring(0,10)
      last_pend_date += " "
    }
     
    if((data[i][0].toString().trim() == facility) && (date_pended == last_pend_date)){ //then this is the one to reschedule
      
      if(~ data[i][6].toString().toLowerCase().indexOf('fedex.com')) return 'FEDEX'
      
      if(data[i][6].toString().length > 0) return 'EXISTING ERROR PREVENTED RESCHEDULE :' + data[i][6].toString() //dont reschedule if there was an issue
      
      var url = SIRUM_URL
      var id = data[i][1]
      url += id
      var url_end = "/09:00:00/"   
      var next_business_day = businessDaysFromDate(today_date,1)
      var next_day = Utilities.formatDate(next_business_day, "GMT-07:00", "yyyy-MM-dd") 
      url_end += next_day
      url += url_end
      var pickup = data[i][2].toString().trim().replace("(","").replace(")","").replace(/\n/g,"").replace(/'/g,"").replace(/\./g,"").replace(/\//g,"").replace(/,/g,"").replace(/#/g,"")
      contact = data[i][3].toString().trim().replace("(","").replace(")","").replace(/\n/g,"").replace(/'/g,"").replace(/\./g,"").replace(/\//g,"").replace(/,/g,"").replace(/#/g,"")
      if((data[i][8].toString().trim() != "NaN") && (data[i][8].toString().length > 0)){
          num_boxes = data[i][8].toString()
      }
      if(!pickup){
        pickup = "0"
      }
      if(!contact){
        contact = "0"
      }
      url += "/" + pickup + "/" + contact + "/" + num_boxes
      
      var res_obj = UrlFetchApp.fetch(url, {muteHttpExceptions:true})
      var response_code = res_obj.getResponseCode()
      if(response_code !== 200){
          debugEmail("ERROR IN V1 COMMUNICATION", "ERROR with \n" + url)
          var error = res_obj.getContentText()
          var issue_cell = "G" + (i+1)
          pending_page.getRange(issue_cell).setValue(error)         
          continue
      }
      var res = res_obj.getContentText()
      var lastLine = res.substring(res.lastIndexOf("\n")+1)      
      
      //Will need to update the pend and pickup cells to reflect that a reschedule has been attempted
      var pend_cell = "E" + (i+1)
      var pickup_cell = "F" + (i+1)
      var new_pickup_content = data[i][5] //get the content of these two cells, which will either be containing a success or error log
      var new_pend_content = data[i][4]
      new_pend_content += ", " + Utilities.formatDate(today_date, "GMT-07:00", "MM/dd/yyyy ")

      if(lastLine.indexOf("Pickup not scheduled for") > -1){ //Then it wasn't rescheduled
          var error = lastLine.substring(lastLine.indexOf(":")+2)
          var issue_cell = "G" + (i+1)
          pending_page.getRange(issue_cell).setValue(error)         
          pending_page.getRange(pickup_cell).setValue("NOT SET --> ")  
          new_pickup_content += ", " + "ERROR"
          debugEmail("Failure to reschedule", res)
      } else { //Then it was rescheduled
          var prev_conf = data[i][7].toString()
          var split_arr = prev_conf.split(",")
          
          //how many times has it been rescheduled?
          //currently this is repetitive code, but could be expanded to redefine what we count as an attempt
          var first_reschedule = false
          var second_reschedule = false
          if(split_arr.length == 1){
            first_reschedule = true
          } else if(split_arr.length == 2){
            second_reschedule = true
          }
          data[i][5] = new_pend_content
          if(first_reschedule){
            generateOutboundEmails("one",ss,data[i])
          } else if(second_reschedule){
            generateOutboundEmails("two",ss,data[i])
          }
          var confirmation_cell = "H" + (i+1)
          var confirmation_number = res.substring(res.indexOf("CPU"),res.indexOf("CPU")+13)
          var new_conf = prev_conf + ", " + confirmation_number
          pending_page.getRange(confirmation_cell).setValue(new_conf) //update to the latest confirmation number
          
          //Update the pickup row to show today's date and the new pickup date
          new_pickup_content += ", " + next_day
      }  
      
      pending_page.getRange(pend_cell).setValue(new_pend_content)         
      pending_page.getRange(pickup_cell).setValue(new_pickup_content)         
 
      return 'SUCCESS'
    }
  }
  return 'FAILURE' //in case it didn't actually reschedule because there was an issue, it should mark the main sheet correctly
}




//Sweep through the main sheet and look at the manual tracking column, for any unshipped boxes, and check if they're in the tracking DB
//because they won't be tracked so might as well handle now
function checkForDups(){
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var backend_sh = SpreadsheetApp.openById(BACKEND_ID)

  var tracking_db = backend_sh.getSheetByName("Tracking Number DB")
  var main_sheet = ss.getSheetByName("1 - Main Page")
  var main_sheet_data = main_sheet.getDataRange().getValues()
  var db_data = tracking_db.getDataRange().getValues()
  
  var indexes = getMainPageIndexes()
  
  var index_facility = indexes.indexFacilityName
  var index_action = indexes.indexPend
  var index_shipped = indexes.indexShippedEmail
  var indexRowID = indexes.indexRowID
  var index_notes = indexes.indexActualIssues
  var indexColemanTracking = indexes.indexColemanTracking
      
  for(var i = 0; i < main_sheet_data.length; i++){
      if(main_sheet_data[i][index_shipped].toString().length == 0){ //if reused, then this would never fill
        var tracking_nums = main_sheet_data[i][indexColemanTracking].toString().split(",") //get all tracking nums
        if(tracking_nums.length > 0){
          for(var j = 0; j < db_data.length; j++){
            if(db_data[j][0].toString() == main_sheet_data[i].toString().trim()){ //find the row
              for(var n = 0; n < tracking_nums.length; n++){
                if(db_data[j][1].toString().split(";").indexOf("971424215" + tracking_nums[n]) > -1){
                  //then it's a duplicate
                  debugEmail("DUPLICATE TRACKING NUMBER", "Found one:\n\n" + tracking_nums[n] + "\n\nRow ID: " + main_sheet_data[i][indexRowID])
                }
              }

            }
          }
        }
      }
  }
}