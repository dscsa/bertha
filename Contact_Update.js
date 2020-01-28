
//----------------------------------------CONTACT-UPDATE-----------------------------------------------------------------------------------------------------




//contactUpdate
//The idea here is that when there are cases that need manual intervention by the program
//associate, they should only have to do it in the Main Sheet, if possible.
//Case 1: Unknown fax number
   //Go through all the rows of the logging sheet. If the fax number was not found
   //then there is a note in Issues column O, which says "FAX NUMBER NOT FOUND: <<NUMBER>>". Then
   //create a new row in the contacts sheet if this has been updated. Then ADDED CONTACT TO DB is noted
//Case 2: Known fax number but need to change facility contact / pickup location
    //Only gonna notice this if there are issues, in which case you would update the contact sheet
    //and so this should sweep through the main sheet and make sure all the fields are in sync with
    //contact sheet. This shoudl not be common. 
//Case 3: The fax number is linked to the wrong account 
function contactUpdate(start) {
    start = start || 0;
    var ss = SpreadsheetApp.openById(BERTHA_ID);
    var main_page = ss.getSheetByName("1 - Main Page")
    var contact_sheet = ss.getSheetByName("2 - Contacts")
    
    
    var indexes = PropertiesService.getScriptProperties()  
    var indexIssues = parseInt(indexes.getProperty('indexMainPageUpdateCol'))
    var indexFacility = parseInt(indexes.getProperty('indexMainPageFacilityName'))
    var indexState = parseInt(indexes.getProperty('indexMainPageState'))
    var indexAction = parseInt(indexes.getProperty('indexMainPageHistoriceIssues'))
    var indexContact = parseInt(indexes.getProperty('indexMainPageContact'))
    var indexPickup =  parseInt(indexes.getProperty('indexMainPageLocation'))
    var indexRawFax = parseInt(indexes.getProperty('indexMainPageContactType'))
    var indexSuppliesNotes = parseInt(indexes.getProperty('indexMainPageSuppliesNotes'))
    var indexInSirum = parseInt(indexes.getProperty('indexMainPageInSirum'))

    var facility = ""
    var state = ""
    var action = ""
    var contact = ""
    var supplies = ""
    var pickup = ""
    var faxnumber = ""
    var supplies_notes = ""
    var v1_format = ""
    
    var last_facility = ""
    
    var contactsheet_index_faxnumber = parseInt(indexes.getProperty('indexContactPageFaxNumber'))
    var contactsheet_index_facility = parseInt(indexes.getProperty('indexContactPageFacility'))
    var contactsheet_index_state = parseInt(indexes.getProperty('indexContactPageState'))
    var contactsheet_index_pickup = parseInt(indexes.getProperty('indexContactPagePickup'))
    var contactsheet_index_issue = parseInt(indexes.getProperty('indexContactPageIssue'))
    var contactsheet_index_contact = parseInt(indexes.getProperty('indexContactPageContact'))
    var contactsheet_index_id = parseInt(indexes.getProperty('indexContactPageID'))
    var contactsheet_index_last_donation_date = parseInt(indexes.getProperty('indexContactPageLastDate'))
    var contactsheet_index_supplies_notes = parseInt(indexes.getProperty('indexContactPageSuppliesNote'))
    var contactsheet_index_salesforce_contacts = parseInt(indexes.getProperty('indexContactPageSalesforceContact'))
    var contactsheet_index_import_format = parseInt(indexes.getProperty('indexContactPageImportFormat'))
    var contactsheet_index_all_emails = parseInt(indexes.getProperty('indexContactPageFacilityEmails'))

    
    var data = main_page.getDataRange().getValues();      
    var contact_data = contact_sheet.getDataRange().getValues()
    
    for(var n=1;n<data.length;++n){   
      
      //Dont' process multiple rows from the same facility in same day, just use first row
      facility = data[n][indexFacility];
      if((n > 1) && (facility == last_facility)){
        main_page.getRange((n+1),(indexIssues+1)).setValue("")         
        continue; //then skip this row, only deal with first row
      }
      last_facility = facility //now keep track for next
      
      
      if(data[n][indexIssues].toString().indexOf("FAX NUMBER NOT FOUND") > -1){ //then it was unfound, needs to be updated in the main sheet
        
        var rx = /1 \(\d{3}\) \d{3}-\d{4}/
        var res = rx.exec(data[n][indexIssues])
        faxnumber = res ? res[0] : "N/A"
        
        facility = data[n][indexFacility].toString().trim()
        
        if(facility != "Not Found"){
          state = data[n][indexState]
          action = data[n][indexAction]
          contact = data[n][indexContact].split("----------")[0].trim()
          supplies_notes = data[n][indexSuppliesNotes]
        
          pickup = data[n][indexPickup]
          var found = false
          
          for(var i = 0; i < contact_data.length; i++){
            if(~ contact_data[i][contactsheet_index_facility].toString().trim().toLowerCase().indexOf(facility.toLowerCase())){
              if(faxnumber != "N/A") contact_sheet.getRange((i+1), (contactsheet_index_faxnumber+1)).setValue(contact_data[i][contactsheet_index_faxnumber].toString().trim() + "," + faxnumber)
              found = true
              break
            }
          }
      
          if(!found) contact_sheet.appendRow([faxnumber,facility,"",action,contact,pickup,supplies_notes,"","","",""]) 
          main_page.getRange((n+1),(indexIssues+1)).setValue("ADDED CONTACT TO DB")         
        }
      
      
      } else if (data[n][indexIssues].toString().indexOf("UPDATE") > -1){ //Then you need to update the info associated with this fax number
        facility = data[n][indexFacility]
        
        if(facility != "Not Found"){ //make sure the row has actually been updated so we don't add a dummy contact to the DB
            var rawFax = data[n][indexRawFax].toString()
            if(rawFax.trim().indexOf("Email-Log") > -1){
              faxnumber = "Pharmacy Contact No Number"
            } else {
              faxnumber = rawFax.substring(rawFax.indexOf("+")+1,rawFax.indexOf("+")+17).trim()
            }
            
            facility = data[n][indexFacility]
            state = data[n][indexState]
            action = data[n][indexAction]
            
            supplies_notes = data[n][indexSuppliesNotes]
            
            contact = data[n][indexContact]
            pickup = data[n][indexPickup]
                        
            main_page.getRange((n+1),(indexIssues+1)).setValue("MODIFIED CONTACT IN DB") 
            
            var contact_data = contact_sheet.getDataRange().getValues()
            var facility_id = ""
            
            for(var i = 0; i < contact_data.length; ++i){  //check if we already know the facility id
                if(contact_data[i][contactsheet_index_facility].toString() == facility){
                  var id_in_line = contact_data[i][contactsheet_index_id].toString()
                  if(id_in_line.length > 0) facility_id = id_in_line
                }
            }
            
            for(i = 0; i < contact_data.length; ++i){
                if(((contact_data[i][contactsheet_index_faxnumber].toString().indexOf(faxnumber) > -1)  && (faxnumber.trim().length > 0)) || (contact_data[i][contactsheet_index_facility].toString() == facility) ){
                  
                  if((contact_data[i][contactsheet_index_faxnumber].toString().indexOf(faxnumber) == -1) && (faxnumber.indexOf("No Number") == -1)){ //then facility is there, but with different number
                    var current_numbers = contact_data[i][contactsheet_index_faxnumber].toString()
                    var new_numbers = current_numbers + ", " + faxnumber
                    contact_sheet.getRange((i+1),(contactsheet_index_faxnumber+1)).setValue(new_numbers)         
                  }
    
                  contact_sheet.getRange((i+1),(contactsheet_index_facility+1)).setValue(facility)         
                  contact_sheet.getRange((i+1),(contactsheet_index_pickup+1)).setValue(pickup)         
                  contact_sheet.getRange((i+1),(contactsheet_index_issue+1)).setValue(action)         
                  contact_sheet.getRange((i+1),(contactsheet_index_contact+1)).setValue(contact)         
                  contact_sheet.getRange((i+1),(contactsheet_index_id+1)).setValue(facility_id)   
                  contact_sheet.getRange((i+1),(contactsheet_index_supplies_notes+1)).setValue(supplies_notes)         

    
                }
            }
        }
      }
    }
}



