//function responsible for tagging rows to be archived (tags all facilities)
function tagForArchival(){
  
  var indexes = getMainPageIndexes()
  
  var sh = SpreadsheetApp.openById(BERTHA_ID)
  var main_page = sh.getSheetByName("1 - Main Page")
  var main_page_data = main_page.getDataRange().getValues()
  var today = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss")
  var data_val_page = sh.getSheetByName("Data Validation")
  
  custom_lock("tagForArchival")
  
  for(var i = 1; i < main_page_data.length; i++){  //go through all the main sheet rows
    if(main_page_data[i][indexes.indexArchived].toString().trim().indexOf(";ROW TO BE ARCHIVED") == -1){ //don't do anything to a row thats already tagged
         var row = main_page_data[i]
         Logger.log("checking row: " + row.join("\n"))
         console.log("checking row: " + row.join("\n"))
         if(meetsArchiveCriteria(row, indexes)){ //if row meets archive criteria (will tag any facility, but actual archiving only filters for Pharmerica)
           console.log('row met archiving criteria: \n' + row.join('\n'))
           main_page.getRange((i+1),1,1,main_page.getMaxColumns()).setBackground("pink")
           main_page.getRange(i+1, indexes.indexArchived +1).setValue(row[indexes.indexArchived].toString() + ";ROW TO BE ARCHIVED " + today) //make note in indexArchived column
           main_page_data[i][indexes.indexArchived] = main_page_data[i][indexes.indexArchived].toString() + ";ROW TO BE ARCHIVED " + today
         }
    }
  }
  
  custom_unlock("tagForArchival")
}



//Given a row from the main page, determines whether it is an archivable row. Returns boolean value
function meetsArchiveCriteria(row, indexes){

  if((row[indexes.indexPend].toString().trim().toLowerCase().indexOf("supply request") > -1) //handle supply requests a way
    && (row[indexes.indexArchived].toString().indexOf("SUPPLIES MOVED") > -1)){
    console.log("met condition 1")
    return true
  } else if((row[indexes.indexPend].toString().trim().toLowerCase().indexOf("do not pend") > -1)
      && ((row[indexes.indexHumanIssues].toString().trim().toLowerCase().indexOf("resolv") > -1) || (row[indexes.indexActualIssues].toString().trim().length == 0))){ //either empty or resolved
    console.log("met condition 2")
    return true
  } else {
    if(((row[indexes.indexIncompleteSupplies].toString().trim().length == 0) || (row[indexes.indexArchived].toString().indexOf("SUPPLIES") > -1))
        && (row[indexes.indexShippedEmail].toString().trim().length > 0) //must have a shipped email
        && (row[indexes.indexReceivedEmail].toString().trim().length > 0) //must have received email
          && (row[indexes.indexFacilityName].toString().trim() != "Not Found") //must have a faciity name
            && (row[indexes.indexState].toString().trim().length > 0) //must have a state value filled in, and can't be 'state unknown'
              && (row[indexes.indexTrackingNum].toString().trim().length > 0) //must have a tracking number
                && ((row[indexes.indexActualIssues].toString().trim().length == 0) || ((row[indexes.indexActualIssues].toString().trim().length > 0) && (row[indexes.indexHumanIssues].toString().toLowerCase().indexOf("resolv") > -1)) || (row[indexes.indexActualIssues].toString().trim().toLowerCase().indexOf("communication with v1 failed") > -1)) //must have no issues, or they're resolved or they're just v1 comm errors
                  && ((row[indexes.indexCOFwd].toString().trim().length == 0) || ( (row[indexes.indexCOFwd].toString().trim().toLowerCase().indexOf("eligible") > -1) || (row[indexes.indexCOFwd].toString().trim().toLowerCase().indexOf("dsr") > -1))) //must have no issues, or they're resolved or they're just v1 comm errors
                   &&(row[indexes.indexInSirum].toString().toLowerCase().indexOf("v2") == -1)
                    && ((row[indexes.indexInSirum].toString().toLowerCase().indexOf("todo") == -1) 
                        || (row[indexes.indexColemanTracking].toString().toLowerCase().indexOf("#no") > -1) 
                        || ((row[indexes.indexInSirum].toString().toLowerCase().indexOf("coleman sheet") > -1) || (row[indexes.indexInSirum].toString().toLowerCase().indexOf("adlr") > -1))))
                        { //must either be donotpend or have a marking that its in sirum.org
                          console.log("met condition 3")
                          return true
                        }
  }
                  
  return false

}


//handles actually copying & deleting rows that have been tagged
function archive(){
  var indexes = getMainPageIndexes()

  var sh = SpreadsheetApp.openById(BERTHA_ID)
  var main_page = sh.getSheetByName("1 - Main Page")
  var supplies_page = sh.getSheetByName("Supplies Page")
  var archive = sh.getSheetByName("Main Page Archive")
  var main_page_data = main_page.getDataRange().getValues()
  var today = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss")
  
  custom_lock("archive")

  for(var i = main_page_data.length -1; i >= 0; i--){  //go through all the main sheet rows in REVERSE because we're gonna be deleting stuff
    //: Currently will only do the archiving for Pharmericas, remove the second condition
    if((main_page_data[i][indexes.indexArchived].toString().trim().indexOf(";ROW TO BE ARCHIVED") > -1)){ //then archive the row

    //if( (main_page_data[i][indexFacilityName].toString().toLowerCase().indexOf("pharmerica") > -1) && (main_page_data[i][indexArchived].toString().trim().indexOf(";ROW TO BE ARCHIVED") > -1)){ //then archive the row
      //then actually archive the row
      var row = main_page_data[i]
      archive.appendRow(row) //copy row to the archive sheet
      //delete the original row from main sheet
      main_page.deleteRow(i+1)
    }
  }
  custom_unlock("archive")

}


//TODO: Use this sme pproach to auto-archive the Pickups sheet for rows > 2 months old
function archiveTheArchive(){
  var archive = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("Main Page Archive")
  var final_archive = SpreadsheetApp.openById(ARCHIVES_ID).getSheetByName("Main Page Final Archive")
  
  //go through archive and find lowest row with a date earlier than 2 months ago
  var indexes = getMainPageIndexes()
  var indexPend = indexes.indexPend
  var last_row_to_index = -1;
  
  var data = archive.getDataRange().getValues()
  var now = new Date()
  for(var i = 1; i < data.length; i++){
    var temp_date_obj = extractDate(data[i][indexPend])
    
    if(temp_date_obj == null) continue;

    if(temp_date_obj.getTime() < (now.getTime() - (1000*60*60*24*30*3))){ //check if its older than 3 months
      last_row_to_index = i;
    } else {
      break; //stop as soon as you hit a row with a date < 2 months back
    }
  }
  
  //everything above gets archived
  custom_lock("archiveTheArchive");
  
  for(var i = last_row_to_index; i > 0; i--){ //don't look at last row
    var row = data[i]
    //archive.getRange("A" + (i+1) + ":E" + (i+1)).setBackground("red")
    if(LIVE) final_archive.appendRow(row)
    archive.deleteRow((i+1))
  }
  
  custom_unlock("archiveTheArchive");
}



function archiveSFaxIntegration(){
  var backend_sh = SpreadsheetApp.openById(BACKEND_ID)
  var sfax_sheet = backend_sh.getSheetByName("SFax Integration")
  var archive = backend_sh.getSheetByName("SFax Integration Archive")
  
  var data = sfax_sheet.getDataRange().getValues()
  var start_row = data.length - 200
  if(start_row < 1) return //don't do anything if there's less than 200 rows, no point
  
  for(var i = start_row; i >= 1; i--){
    var row = data[i]
    archive.appendRow(row)
    sfax_sheet.deleteRow((i+1))
  }
  

}




//archive the supplies page if there's an intials and date completed >2 days ago
//triggered to run daily
function archiveSupplies(){
  var sh = SpreadsheetApp.openById(BERTHA_ID)
  var supplies_page = sh.getSheetByName("Supplies Page")
  supplies_page.getRange("A:M").setNumberFormat("@STRING@")
  var supplies_archive = SpreadsheetApp.openById(ARCHIVES_ID).getSheetByName("Supplies Archive")
  var indexInitials = 10
  var indexDate = 11
  var day = 1000*60*60*24 //since date arithmetic gives answers in milliseconds, declare this variable now
  var data = supplies_page.getDataRange().getValues()
  var today = new Date()
  
  for(var i = data.length-1; i > 1; i--){
    var row = data[i]
    if((row[indexInitials].toString().trim().length > 0) && (row[indexDate].toString().trim().length > 0)){
      var date_arr = row[indexDate].toString().trim().split("/")
      var date_obj = new Date(today.getYear(), parseInt(date_arr[0], 10) -1, date_arr[1])
      var date_diff = (today - date_obj)/day
      if((date_diff > 2) || (date_diff < 0)){ //it would be less than zero if we're looking at a date that's in a past year
        if(LIVE){
          supplies_archive.appendRow(row)
          supplies_page.deleteRow(i+1)
        }
      }
    }
  }
}



//MANUALLY TRIGGERED
function storeSupplies(){
  var indexes = PropertiesService.getScriptProperties()  
  
  var indexArchived = parseInt(indexes.getProperty('indexMainPageArchive'))
  var indexPend = parseInt(indexes.getProperty('indexMainPageAction'))
  var indexFacilityName = parseInt(indexes.getProperty('indexMainPageFacilityName'))
  var indexState = parseInt(indexes.getProperty('indexMainPageState'))
  var indexIssues = parseInt(indexes.getProperty('indexMainPageHistoriceIssues'))
  var indexContact = parseInt(indexes.getProperty('indexMainPageContact'))
  var indexTrackingNum = parseInt(indexes.getProperty('indexMainPageAutoTrackingNum'))
  var indexCOFwd = parseInt(indexes.getProperty('indexMainPageCOFWD'))
  var indexShippedEmail = parseInt(indexes.getProperty('indexMainPageShippedEmail'))
  var indexReceivedEmail = parseInt(indexes.getProperty('indexMainPageReceivedEmail'))
  var indexInSirum = parseInt(indexes.getProperty('indexMainPageInSirum'))
  var indexColemanTracking = parseInt(indexes.getProperty('indexMainPageManualTrackingNum'))
  var indexHumanIssues = parseInt(indexes.getProperty('indexMainPageResolved'))
  var indexSuppliesNotes = parseInt(indexes.getProperty('indexMainPageSuppliesNotes'))
  var indexIncompleteSupplies = parseInt(indexes.getProperty('indexMainPageSuppliesRequested'))
  
  var sh = SpreadsheetApp.openById(BERTHA_ID)
  var main_page = sh.getSheetByName("1 - Main Page")
  var supplies_page = sh.getSheetByName("Supplies Page")
  var main_page_data = main_page.getDataRange().getValues()
  var today = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss")
  
  for(var i = 1; i < main_page_data.length; i++){  
      //check that this row hasnt been pre-archived or actually archived for supplies, and there are actual supplies
     if((main_page_data[i][indexArchived].toString().trim().indexOf(";SUPPLIES") == -1) && (main_page_data[i][indexIncompleteSupplies].toString().trim().length > 0)){//if col U filled out and not already supplies archived
           
           var row = main_page_data[i]
           main_page.getRange(i+1, indexArchived+1).setValue(row[indexArchived].toString() + ";SUPPLIES MOVED TO SUPPLIES PAGE " + today)
           main_page_data[i][indexArchived] = main_page_data[i][indexArchived].toString() + ";SUPPLIES MOVED TO SUPPLIES PAGE " + today
           
           var num_rows = parseRequest(row[indexIncompleteSupplies]) //look for boxes out of GA that we want to parse out further

           if(num_rows[0] == -1){ //then its not that type of request
             supplies_page.appendRow([today,row[indexPend],row[indexFacilityName], row[indexState], row[indexIssues], row[indexContact].split("----------")[0].trim(), row[indexSuppliesNotes], row[indexIncompleteSupplies]])
           
           } else {
             var first_row = num_rows[1] //will have replaced num of boxes with six
             var remainder_rows = first_row.split(";")[0] //remove any other supplies so we don't repeat

             supplies_page.appendRow([today,row[indexPend],row[indexFacilityName], row[indexState], row[indexIssues], row[indexContact].split("----------")[0].trim(), row[indexSuppliesNotes], first_row])

             for(var i = 0; i < (num_rows[0]-1); i++){
               supplies_page.appendRow([today,row[indexPend],row[indexFacilityName], row[indexState], row[indexIssues], row[indexContact].split("----------")[0].trim(), row[indexSuppliesNotes], remainder_rows])
             }
             
           }
           autoGroupSupplies(row[indexFacilityName])
     }
  }
}



function parseRequest(raw_str){
  var regex = /(\d*) Medium Boxes \(.*\).*/
  var parsed = regex.exec(raw_str)
  
  if((parsed) && (parsed.length == 2)){
    var num_boxes = parseInt(parsed[1])
    if(num_boxes % 6 == 0){
      Logger.log(num_boxes)
      var process_str = raw_str.replace(parsed[1],6)
      return [(num_boxes/6),process_str]
    }
  } 

  return [-1]
}

function extractDate(str) {
  var m = str.match(/.*(\d{1,2})\/(\d{1,2})\/(\d{4}).*/);
  return (m) ? new Date(m[3], m[1]-1, m[2]) : null;
}