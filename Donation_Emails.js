function manuallyGenerateEmails(){
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var highlighted_range_val = SpreadsheetApp.getActiveRange().setNumberFormat("@STRING@").getValues()[0] //this has to be a range of the pickups sheet, but it might not be, so act accordingly
  
  if(typeof highlighted_range_val[4] == 'undefined'){
      throw new Error( "Please highlight a row of the pickups sheet. Must correspond to a row on the main page (matched by last pend date & facility name). Will not match if main sheet row has tracking number." );
  }
  
  var pends = highlighted_range_val[4].toString()
  var code = "zero"
  if(pends.indexOf(",") > -1){
    var split_arr = pends.split(",")
    if(split_arr.length == 2){
      code = "one"
    } else if(split_arr.length == 3){
      code = "two"
    } else {
      throw new Error( "Please highlight a row of the pickups sheet. Must correspond to a row on the main page (matched by last pend date & facility name). Will not match if main sheet row has tracking number." );
      return
    }
  }
  
  generateOutboundEmails(code,ss,highlighted_range_val)
}



function sendEmailsFromMainSheet(){
  var data_val_data = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("Data Validation").getDataRange().getValues()
  var index_col = data_val_data[0].indexOf("SALESFORCE BCC ADDRESS")
  var bcc_email = data_val_data[1][index_col].toString() + "," + TEAM_EMAIL //bcc to salesforce and team email
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var main_page = ss.getSheetByName("1 - Main Page")
  var data = main_page.getDataRange().getValues()
  
  var today = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy hh:mm:ss").toString()

  var indexes = getMainPageIndexes()
  //TODO: don't need these variables to be declared, just access indexes directly
  var indexPend = indexes.indexPend
  var indexFacilityName = indexes.indexFacilityName
  var indexEmailAddr = indexes.indexEmailAddr   
  var indexEmailOne = indexes.indexEmailOne 
  var indexEmailTwo = indexes.indexEmailTwo 
  var indexEmailThree = indexes.indexEmailThree 
  var indexTrackingNum = indexes.indexTrackingNum 

  
  
  for(var i = 1; i < data.length; i++){
    if((data[i][indexPend].toString().indexOf("DO NOT PEND") == -1) && (data[i][indexPend].toString().indexOf("SUPPLY REQUEST") == -1)){ //just make sure
      if(data[i][indexTrackingNum].toString().trim().length == 0){ //triple check that it hasnt already shipped
        if(data[i][indexEmailAddr].toString().trim().length > 0){ //dont even bother with rows where theres no address
          if((data[i][indexEmailOne].toString().indexOf("SENT") == -1) && (data[i][indexEmailOne].toString().trim().length > 0)){ //do we need to send the first
               var addr_arr = data[i][indexEmailAddr].toString().split(",")
               var cont_arr = data[i][indexEmailOne].toString().split("|")
               var subj = cont_arr[0]
               var content = cont_arr[1].replace(/\n/g,"<br>")
               for(var j = 0; j < addr_arr.length; j++){
                 main_page.getRange((i+1), (indexEmailOne+1)).setValue("SENT " + today + "|" + data[i][indexEmailOne])
                 if(LIVE){
                   //MailApp.sendEmail(addr_arr[j], subj, "", {htmlBody: content, bcc: bcc_email})
                   try{
                     pendCommObj(addr_arr[j], subj, "", {htmlBody: content, bcc: bcc_email})
                   } catch(e){
                     debugEmail('Error pending to comm-cal', e)
                   }
                 }
               }
          } else if((data[i][indexEmailTwo].toString().indexOf("SENT") == -1) && (data[i][indexEmailTwo].toString().trim().length > 0)){
               var addr_arr = data[i][indexEmailAddr].split(",")
               var cont_arr = data[i][indexEmailTwo].split("|")
               var subj = cont_arr[0]
               var content = cont_arr[1].replace(/\n/g,"<br>")
               for(var j = 0; j < addr_arr.length; j++){
                 main_page.getRange((i+1), (indexEmailTwo+1)).setValue("SENT " + today + "|" + data[i][indexEmailTwo])
                 if(LIVE){
                   //MailApp.sendEmail(addr_arr[j], subj, "", {htmlBody: content, bcc: bcc_email})
                   try{
                     pendCommObj(addr_arr[j], subj, "", {htmlBody: content, bcc: bcc_email})
                   } catch(e){
                     debugEmail('Error pending to comm-cal', e)
                   }
                 }               
               }
          } else if((data[i][indexEmailThree].toString().indexOf("SENT") == -1) && (data[i][indexEmailThree].toString().trim().length > 0)){
               var addr_arr = data[i][indexEmailAddr].split(",")
               var cont_arr = data[i][indexEmailThree].split("|")
               var subj = cont_arr[0]
               var content = cont_arr[1].replace(/\n/g,"<br>")
               for(var j = 0; j < addr_arr.length; j++){
                 main_page.getRange((i+1), (indexEmailThree+1)).setValue("SENT " + today + "|" + data[i][indexEmailThree])
                 if(LIVE){
                   //MailApp.sendEmail(addr_arr[j], subj, "", {htmlBody: content, bcc: bcc_email}) //TODO delete 
                   try{
                     pendCommObj(addr_arr[j], subj, "", {htmlBody: content, bcc: bcc_email})
                   } catch(e){
                     debugEmail('Error pending to comm-cal', e)
                   }
                 }
               }
          }
        }
      }
    }
  }
}




//row data is from the pending sheet, so use those indexes 
function generateOutboundEmails(code, ss, row_data){

  //gather the row's essentials
  var facility = row_data[0].toString().trim()
  var location = row_data[2].toString().trim()
  var original_contact = row_data[3].toString().trim()
  var pend_date = row_data[4].toString().trim()
  if(pend_date.indexOf(",") > -1){
    var pend_arr = pend_date.split(",")
    pend_date = pend_arr[pend_arr.length-1].trim()
  } //take the latest date
  var pickup_date = row_data[5].toString().trim()
  if(pickup_date.indexOf(",") > -1){
    var pickup_arr = pickup_date.split(",")
    pickup_date = pickup_arr[pickup_arr.length-1]
  } //take the latest date
  
  
  var all_emails = row_data[9].toString().trim() //this could be blank if we don't have any emails  
  var donation_leads_emails = row_data[11].toString().trim()

  if(all_emails.length == 0){
    all_emails = donation_leads_emails
  }
  var fax_email_addr = row_data[10].toString().trim()
  var donation_leads_names_raw = row_data[12].toString().trim()
  createDraftEmails(ss,code, facility,location,original_contact,pickup_date,pend_date,donation_leads_names_raw,all_emails, fax_email_addr)

}

function createDraftEmails(ss,code, facility,location,original_contact,pickup_date,pend_date,donation_leads_names_raw,all_emails, fax_email_addr){
  var main_page = ss.getSheetByName("1 - Main Page")
  var draft = ""
  var subject = ""
  var fax_addon = ""
  var emails_to_use = ""
  
  var indexes = getMainPageIndexes()
  //TODO: don't need these variables to be declared, just access indexes directly
  var indexPend = indexes.indexPend
  var indexFacilityName = indexes.indexFacilityName
  var indexEmailAddr = indexes.indexEmailAddr   
  var indexEmailOne = indexes.indexEmailOne 
  var indexEmailTwo = indexes.indexEmailTwo 
  var indexEmailThree = indexes.indexEmailThree 
  var indexTrackingNum = indexes.indexTrackingNum 

  var data_val_data = ss.getSheetByName("Data Validation").getDataRange().getValues()
  var index_one = data_val_data[0].indexOf("FIRST EMAIL INFO")
  var index_two = data_val_data[0].indexOf("SECOND EMAIL INFO")
  var index_three = data_val_data[0].indexOf("THIRD EMAIL INFO")

  
  if(code == "zero"){
    subject = data_val_data[1][index_one].toString().trim()
    draft = data_val_data[2][index_one].toString().trim()
    fax_addon = data_val_data[3][index_one].toString().trim()
  } else if(code == "one"){
    subject = data_val_data[1][index_two].toString().trim()
    draft = data_val_data[2][index_two].toString().trim()
    fax_addon = data_val_data[3][index_two].toString().trim()
  } else if(code == "two"){
    subject = data_val_data[1][index_three].toString().trim()
    draft = data_val_data[2][index_three].toString().trim()
    fax_addon = data_val_data[3][index_three].toString().trim()
  }
  
  var res = ""
  if(all_emails.length == 0){
    res = fax_addon
    emails_to_use = fax_email_addr
  } else {
    res = draft
    emails_to_use = all_emails
  }
  
  if(original_contact.length == 0){
    res = res.replace("$donation_contact","SIRUM Donation Lead")
  } else {
    res = res.replace("$donation_contact",original_contact)
  }
  res = res.replace("$facility", facility)
  res = res.replace("$location", location)
  res = res.replace("$pickup_date", pickup_date)
  var date_ = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy").toString()
  var filler = subject + "|" + res
  
  //now find the row in the main page to stick all this info
  var main_sheet_data = main_page.getDataRange().getValues()
  for(var i = 0; i < main_sheet_data.length; i++){
    if(main_sheet_data[i][indexFacilityName].toString().trim() == facility){
      if(main_sheet_data[i][indexTrackingNum].toString().length == 0){
        //match to the right row, this is the challenge
        var raw_pend = main_sheet_data[i][indexPend].toString().trim()
        var temp_arr = []
        if(raw_pend.indexOf(",") == -1){
          var temp_arr = raw_pend.split(" ") //so its PEND DATE
        } else {
            var temp_arr = raw_pend.split(",") //so its PEND x,...,DATE
        }
        Logger.log(temp_arr)
        if(temp_arr[temp_arr.length -1].trim() == pend_date){ //then this is our row
          if(code == "zero"){
            if(main_sheet_data[i][indexEmailOne].toString().trim().length == 0){
              main_page.getRange((i+1), (indexEmailAddr+1)).setValue(emails_to_use) //only put emails here if its the first one
              main_page.getRange((i+1), (indexEmailOne+1)).setValue(filler)
            }
          } else if(code == "one"){
            if(main_sheet_data[i][indexEmailTwo].toString().trim().length == 0){
              if(main_sheet_data[i][indexEmailAddr].toString().trim().length == 0){
                main_page.getRange((i+1), (indexEmailAddr+1)).setValue(emails_to_use)
              }
              main_page.getRange((i+1), (indexEmailTwo+1)).setValue(filler)
            }
          } else if(code == "two"){
            if(main_sheet_data[i][indexEmailThree].toString().trim().length == 0){
              if(main_sheet_data[i][indexEmailAddr].toString().trim().length == 0){
                main_page.getRange((i+1), (indexEmailAddr+1)).setValue(emails_to_use)
              }
              main_page.getRange((i+1), (indexEmailThree+1)).setValue(filler)
            }
          }
          return
        }
      }
    }
  }
}




//---------------------------------------------HELPERS----------------------------------------------------




//Calculates the Levenshtein distance between two strings https://en.wikipedia.org/wiki/Levenshtein_distance
function similarity(s1, s2) {
  var longer = s1;
  var shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  var longerLength = longer.length;
  if (longerLength == 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}


function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();

  var costs = new Array();
  for (var i = 0; i <= s1.length; i++) {
    var lastValue = i;
    for (var j = 0; j <= s2.length; j++) {
      if (i == 0)
        costs[j] = j;
      else {
        if (j > 0) {
          var newValue = costs[j - 1];
          if (s1.charAt(i - 1) != s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue),
              costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0)
      costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}