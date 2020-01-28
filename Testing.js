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


