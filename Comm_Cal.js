
function debugEmail(subject, content) {
  var addr = DEV_EMAIL
  //MailApp.sendEmail(addr, subject, content)
}

function teamEmail(subject,content){
  var addr = TEAM_EMAIL
  //MailApp.sendEmail(addr, subject, content)
}

function testPend(){
  pendCommObj('omar@sirum.org', 'test from bertha', TESTBUILDSTR)
}

//Integrates with the comm-cal
//Either creates an email object, or a fax -- for now --muhaha
function pendCommObj(addr,subject,body,options){
  
  if(body.trim().length == 0) body = options.htmlBody
  if(body.trim().length == 0) return debugEmail("no body in pend email!", addr + "\n" + subject + "\n" + JSON.stringify(options))

  var comm_obj = {}
  console.log('starting to build comm obj')
  
  comm_obj.workHours = false //send whenever created, because of timezones
  
  if((~ addr.indexOf("@")) && (!(~ addr.indexOf("metrofax")))){ //then we're building an email-object
    
    comm_obj.email = addr
    comm_obj.subject = subject
    comm_obj.message = body
    comm_obj.from = SUPPORT_EMAIL
    
    if(options){
      if(options.cc) comm_obj.cc = options.cc
      if(options.bcc) comm_obj.bcc = options.bcc
    }
    
  } else {
    addr = addr.replace("@metrofax.com","") //for now, the draft geneations adds metrofax still, undo that
    comm_obj.fax = addr
    comm_obj.attachments = buildFax(addr,subject,body)
  }
  
  var comm_arr = [comm_obj]
  
  console.log('comm array built')
  
  var now = new Date()
  var end = new Date(now.getTime() + 1000*60*30)
  
  var cal_options = {
    'description': JSON.stringify(comm_arr,null," ")
  }
  
  console.log(cal_options)
  
  CalendarApp.getCalendarById(CAL_ID).createEvent(subject.replace("SIRUM:",""), now, end, cal_options)
  
}

var TESTBUILDSTR = "Hello, <br><br>Thank you for taking time to prepare your meds for shipment with SIRUM!  We received your donation information and scheduled a FedEx pick up for the following business day.  <br><br>Here’s what we let your FedEx driver know about your shipment.  <br><br>  - Package Location: Station 1 Med Rm<br> - Contact, if needed: Deborah<br><br>Thank you,<br>The SIRUM Team"

function testbuild(){
  Logger.log(buildFax("omar@sirum.org","TEST BUILD A DOC",TESTBUILDSTR))
}


function buildFax(addr,subject,message){

  var folder_dest = DriveApp.getFolderById(FAX_FOLDER_ID)
  var file = DriveApp.getFileById(FAX_TEMPLATE_ID).makeCopy(folder_dest).setName(addr + " | " + subject)
  var doc = DocumentApp.openById(file.getId())

  var body = doc.getBody();
  
  message = "<br><br><br><br><br><br>" + message //add some spacing
  message = message.replace(/<br>/g, "\n")

  body.insertParagraph(0, message)
  
  var file_iter =  file.getParents()
  
  if(file_iter.hasNext()){
    file_iter.next().removeFile(file)
  }
  folder_dest.addFile(file)
  
  return doc.getId();
}
