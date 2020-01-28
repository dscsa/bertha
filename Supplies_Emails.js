//Regex to see if an email subject is an Amazon shipment
function fromAmazon(subject){
  var rx = /Your Amazon(\S)* order ((\S)+|of (.* )*".+") has shipped/g
  var res = subject.match(rx)
  if(res){
    return true
  } else {
    return false
  }
}

function queueAmazonEmails(subject,content, supplies_email_sheet){

  var preLinkText = "Track your package at:"

  var indexStartLink = content.indexOf(preLinkText) + preLinkText.length
  var trim1 = content.substring(indexStartLink).trim()
  var link = trim1.substring(0,trim1.indexOf("\n"))

  var preContactText = "Shipped to:"
  
  var indexStartText = trim1.indexOf(preContactText) + preContactText.length
  var trim2 = trim1.substring(indexStartText).trim()
  var contact = trim2.substring(0,trim2.indexOf("\n"))
  contact = contact.replace("ATTN:","")

  var remaining = trim2.split("\n")
  var facility_maybe = remaining[1].trim().replace("...","") //this is not standardized across the contacts, but worth trying to pull if possible
  Logger.log(contact)
  Logger.log(facility_maybe)
  
  if((contact.trim() == "SIRUM") || (contact.trim().indexOf("Good Pill") > -1)) return
  
  supplies_email_sheet.appendRow(["AMAZON","Boxes",contact.trim(),facility_maybe,"","","","","","",link.trim()])
  
}


function archiveSupplyEmails(){
  var sh = SpreadsheetApp.openById(BERTHA_ID)
  var emails_page = sh.getSheetByName("Import from Shippo")
  var archive = SpreadsheetApp.openById(ARCHIVES_ID).getSheetByName("Supplies Email Archive")

  var data = emails_page.getDataRange().getValues()
  var today = new Date()
  
  var indexEmailAddr = data[0].indexOf("Email Addresses")
  var indexEmailDraft = data[0].indexOf("Email Drafts")
  
  for(var i = data.length-1; i > 1; i--){ //dont go to the second row either
    var row = data[i]
    if((row[indexEmailAddr].toString().indexOf("NO EMAILS FOUND") > -1) 
       || (row[indexEmailDraft].toString().indexOf("SENT") > -1) 
        || (row[indexEmailAddr].toString().indexOf("Grouped in other row") > -1)){
           if(LIVE) archive.appendRow(row)
           emails_page.deleteRow(i+1)
    }
  }
}


function collateSupplyPart(page){
  var data = page.getDataRange().getValues()
  var indexSupplies = data[0].indexOf("Item Name To Send")
  var indexFacility = data[0].indexOf("To Address Company")
  var indexCollatedSupplies = data[0].indexOf("Supplies")
  var indexCollatedTrackingNum = data[0].indexOf("Tracking URLs")
  var indexContact = data[0].indexOf("To Address Name")
  var total_obj = {} //key facilityname, value:{supplies_obj}
  var tracking_num_formula =  page.getRange(2,(indexCollatedTrackingNum+1)) //this will be copied down
  
  
  for(var i =2; i < data.length; i++){
    if((data[i][indexCollatedSupplies].toString().trim().length == 0)){
      var supplies_obj = (total_obj[data[i][indexContact]] || {})    
      var supply = data[i][indexSupplies].toString().trim().split(";")
      for(var n = 0; n < supply.length; n++){
        supplies_obj[supply[n]] = (supplies_obj[supply[n]] || 0) + 1
      }
      total_obj[data[i][indexContact]] = supplies_obj
    }
  }

  var drafted_contacts = [] //so we dont add duplicates unnecesarily
  
  for(var i =2; i < data.length; i++){
    if((data[i][indexCollatedSupplies].toString().trim().length == 0)){
      var supplies = total_obj[data[i][indexContact].toString().trim()] //an object
      var collated_str = ""
      for(var supply in supplies){
        if(supplies[supply] > 1){
          collated_str += supplies[supply] + " x " + supply + " ; "
        } else {
          collated_str += supply + " ; "
        }
      }
      if(drafted_contacts.indexOf(data[i][indexContact].toString().trim()) == -1){
        page.getRange((i+1),(indexCollatedSupplies+1)).setValue(collated_str.trim().slice(0,-1))
        tracking_num_formula.copyTo(page.getRange((i+1),(indexCollatedTrackingNum+1)))
        drafted_contacts.push(data[i][indexContact].toString().trim())
      } else {
        page.getRange((i+1),(indexCollatedSupplies+1),1,4).setValues([["Grouped in other row","Grouped in other row","Grouped in other row","Grouped in other row"]])
      }
    }
  }
  
  SpreadsheetApp.flush()
}


function generateSupplyEmailDrafts() {
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var supplies_page = ss.getSheetByName('Import from Shippo')
  
  collateSupplyPart(supplies_page)
  
  var supplies_page_data = supplies_page.getDataRange().getValues()
  
  var data_val_data = ss.getSheetByName("Data Validation").getDataRange().getValues()
  var email_data = ss.getSheetByName("Donation Contact Emails").getDataRange().getValues()
  
  var draftEmailSubject = data_val_data[1][data_val_data[0].indexOf("SUPPLIES EMAIL INFO")].toString()
  var draftEmailTemplate = data_val_data[2][data_val_data[0].indexOf("SUPPLIES EMAIL INFO")].toString()
  
  var templateIndices = extractVariables(draftEmailTemplate)
  
  var indexFacility = supplies_page_data[0].indexOf("To Address Company")
  var indexEmailAddr = supplies_page_data[0].indexOf("Email Addresses")
  var indexEmailDraft = supplies_page_data[0].indexOf("Email Drafts")
  var indexContact = supplies_page_data[0].indexOf("To Address Name")
  var facilities_to_process = []
  var individuals_to_check = [] //for Amazon rows
  
  
  //get a list of facilities we're emailing
  for(var i = 2; i < supplies_page_data.length; i++){
    if(supplies_page_data[i][indexEmailDraft].toString().trim().length == 0){
        individuals_to_check.push(supplies_page_data[i][indexContact].toString().toLowerCase().replace(/\/.*/g,"").trim())
        facilities_to_process.push(supplies_page_data[i][indexFacility].toString().trim().toLowerCase())
      
    }
  }
  
  if((facilities_to_process.length == 0) && (individuals_to_check.length == 0)) return;
  
  Logger.log(individuals_to_check)
  Logger.log(facilities_to_process)
  
  //get their emails
  var email_addresses = {}
  for(var i = 1; i < email_data.length; i++){
    if((email_data[i][11].toString().trim().length > 0) //if there's an email item
       && (email_data[i][6].toString().trim().toLowerCase().indexOf("true") > -1)) //if they're a donation lead
    {   
      //check against facilities list
      if((facilities_to_process.indexOf(email_data[i][0].toString().trim().toLowerCase()) > -1)  
        && !(email_data[i][0].toString().trim().toLowerCase() in email_addresses))
      {
          email_addresses[email_data[i][0].toString().trim().toLowerCase()] = email_data[i][11]
      } else if((individuals_to_check.indexOf(email_data[i][1].toString().trim().toLowerCase()) > -1)
        && !(email_data[i][1].toString().trim().toLowerCase() in email_addresses))
      {
          email_addresses[email_data[i][1].toString().trim().toLowerCase()] = email_data[i][11]
      }
    } 
  }
  
  Logger.log(email_addresses)
  
  //go through and generate drafts
  for(var i = 2; i < supplies_page_data.length; i++){
    if(supplies_page_data[i][indexEmailDraft].toString().trim().length == 0){
      
        var email = email_addresses[supplies_page_data[i][indexFacility].toString().trim().toLowerCase()]

        if(!email) email = email_addresses[supplies_page_data[i][indexContact].toString().replace(/\/.*/g,"").toLowerCase().trim()]

        if(!email) email = "NO EMAILS FOUND"
        
        supplies_page.getRange((i+1), (indexEmailAddr+1)).setValue(email) //add the address

        var draft = draftEmailTemplate.slice()
        for(var n = 0; n < templateIndices.length; n++){
          var current_index = supplies_page_data[0].indexOf(templateIndices[n])
          draft = draft.replace("$(" + templateIndices[n] + ")",supplies_page_data[i][current_index].toString().trim())
        }
        
        supplies_page.getRange((i+1), (indexEmailDraft+1)).setValue(draftEmailSubject + "|" + draft) //add the address

    }
  }
}



function sendSupplyEmails(){
  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var supplies_page = ss.getSheetByName('Import from Shippo')
  var supplies_page_data = supplies_page.getDataRange().getValues()

  var indexFacility = supplies_page_data[0].indexOf("To Address Company")
  var indexEmailAddr = supplies_page_data[0].indexOf("Email Addresses")
  var indexEmailDraft = supplies_page_data[0].indexOf("Email Drafts")
  
  var data_val_data = ss.getSheetByName("Data Validation").getDataRange().getValues()
  var index_col = data_val_data[0].indexOf("SALESFORCE BCC ADDRESS")
  var bcc_email = data_val_data[1][index_col].toString() + "," + TEAM_EMAIL + "," + MANAGER_EMAIL //we always want to bcc salesforce, the team, and the manager

  var sent_emails = []
  
  for(var i = 2; i < supplies_page_data.length; i++){
    if((supplies_page_data[i][indexEmailDraft].toString().length > 0) && (supplies_page_data[i][indexEmailDraft].toString().indexOf("SENT") == -1) && (supplies_page_data[i][indexEmailDraft].toString().indexOf("Grouped in other row") == -1)){
      //then they should be sent
      var rawDraft = supplies_page_data[i][indexEmailDraft].toString()
      var rawArr = rawDraft.split("|")
      var subject = rawArr[0]
      var message = rawArr[1].replace(/\n/g,"<br>")
      var addresses = supplies_page_data[i][indexEmailAddr].split(",")
      for(var n = 0; n < addresses.length; n++){
        if(sent_emails.indexOf(addresses[n]) == -1){
          pendCommObj(addresses[n], subject, "", {htmlBody: message, bcc: bcc_email})
          sent_emails.push(addresses[n])
        }
      }
      supplies_page.getRange((i+1),(indexEmailDraft+1)).setValue("SENT|" + rawDraft)
    }
  }
  Logger.log(sent_emails)
}




