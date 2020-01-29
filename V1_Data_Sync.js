function run_data_sync(){
  var sh = SpreadsheetApp.openById(BERTHA_ID)
  var main_page = sh.getSheetByName("1 - Main Page")
  var data_val_page = sh.getSheetByName("Data Validation")
  var main_data = main_page.getDataRange().getValues()
  
  var indexes = get_main_indexes()
  var indexInSirum = indexes.indexInSirum //this is where we have the way we get data to V1 for each row

  
  var coleman_to_do_sheet = SpreadsheetApp.openById("1HglNrncAbiJgqOzned29dfQiEo9YUBFC1cXJ1fF_nEA").getSheetByName("To Do List")
  var existing_coleman_trackings = get_existing_coleman_trackings(coleman_to_do_sheet)
  var batch_to_do_sheet = SpreadsheetApp.openById("1EMOdZDGBIwTVkIsrkODB3tBzBpkS6-u432GrsOY84d4").getSheetByName("V2 UI")

  var indexState = indexes.indexState
  var indexFacility = indexes.indexFacilityName
  
  var coleman_exclude_states = get_coleman_exclude(data_val_page);
  var coleman_exclude_accounts = getPharmacyNames(data_val_page)
  
  var V2PullFacilities = get_contacts_requiring_v2_to_v1(sh)
  
  custom_lock("runDataSync")
  
  //go through every row of hte main page, checking 
  for(var i = 1; i < main_data.length; i++){
  
    if(main_data[i][indexInSirum].toString().toLowerCase().indexOf("todo coleman") > -1){
     
      existing_coleman_trackings = new_add_to_coleman_sheet(main_data[i], coleman_to_do_sheet,i, main_page, existing_coleman_trackings, indexes) //then move to the coleman sheet if it meets all the other criteria
      
    } else if(main_data[i][indexInSirum].toString().toLowerCase().indexOf("v2") > -1){
      //then move to V1 Upload batch generator if it meets all the criteria
    
      add_to_batch_generator(main_data[i],batch_to_do_sheet,i, main_page,indexes, V2PullFacilities)
    
    } else if(main_data[i][indexInSirum].toString().length == 0){
    
      //check if it should have been tagged for coleman before
      if((coleman_exclude_states.indexOf(main_data[i][indexState].toString().trim()) == -1) && (coleman_exclude_accounts.indexOf(main_data[i][indexFacility].toString().trim()) == -1)){
        //then process anyway --> it shouldve been tagged as coleman todo
        existing_coleman_trackings = new_add_to_coleman_sheet(main_data[i], coleman_to_do_sheet,i, main_page, existing_coleman_trackings, indexes) //then move to the coleman sheet if it meets all the other criteria
      }

    }

  }
  
  custom_unlock("runDataSync")

}


//TODO: change this function
function add_to_batch_generator(data_row,batch_to_do_sheet,row_index, main_sheet,indexes, V2PullFacilities){
  

  var indexActualIssues = indexes.indexActualIssues
  var indexInSirum = indexes.indexInSirum
  var indexResolved = indexes.indexHumanIssues
  var indexColoradElig = indexes.indexCOFwd
  var indexState = indexes.indexState
  var indexFacility = indexes.indexFacilityName
  var index_tracking_number = indexes.indexTrackingNum
  var index_received = indexes.indexReceivedEmail
  var date_string = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
  
  if((data_row[index_tracking_number].toString().trim().length > 0) //there is a tracking number because it shipped (wait for at least this)
      && (data_row[index_received].toString().length > 0) //no point even moving it over until it's been received
      && (((data_row[indexActualIssues].toString().trim().length > 0) && (data_row[indexResolved].toString().toLowerCase().indexOf("resolv") > -1)) 
         || (data_row[indexActualIssues].toString().trim().length == 0))
      && ((data_row[indexColoradElig].toString().length == 0) || (data_row[indexColoradElig].toString().indexOf("ineligible") > -1))){
    
    var facility = data_row[indexFacility].toString().trim()
    var tracking_num = data_row[index_tracking_number].toString().trim()

    
    batch_to_do_sheet.appendRow([tracking_num,facility,date_string])
    main_sheet.getRange((row_index+1), (indexInSirum+1)).setValue("On Batch Generator to-do sheet " + date_string)

  }
  

}

//Integrates with the coleman to-do sheet to auto-populate it with donations that
//need to be logged. Does some checking on whetehr a row corresponds to a coleman donation
//and makes a note whne complete in bertha's mainsheet
function new_add_to_coleman_sheet(data_row, coleman_to_do_sheet,row_index, main_sheet, existing_tracking_nums, indexes){


  var indexActualIssues = indexes.indexActualIssues
  var indexInSirum = indexes.indexInSirum
  var indexColemanTracking = indexes.indexColemanTracking
  var indexResolved = indexes.indexHumanIssues
  var indexColoradElig = indexes.indexCOFwd
  var indexState = indexes.indexState
  var indexFacility = indexes.indexFacilityName
  var colorado_tag = "Log NDC: CO eligible donation"
  
  var date_string = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
  
  if((data_row[indexColemanTracking].toString().trim().length > 0) //there is a tracking number populated in column R
      && (((data_row[indexActualIssues].toString().trim().length > 0) && (data_row[indexResolved].toString().toLowerCase().indexOf("resolv") > -1)) 
         || (data_row[indexActualIssues].toString().trim().length == 0))
      && (data_row[indexColoradElig].toString().indexOf("FORWARD ME") == -1) //either empty or already been forwarded
    
    ){
    
    //if eligible, add note: "Log NDCS" in one of the coleman columns
    
    var facility = data_row[indexFacility]
    var tracking_nums = data_row[indexColemanTracking].toString().trim()
    var coleman_note = "" //may become the tag if eligible
    
    if((data_row[indexColoradElig].toString().indexOf("eligible") > -1) && (data_row[indexColoradElig].toString().indexOf("ineligible") == -1)){
      coleman_note = colorado_tag
    }
    
    if(tracking_nums.length < 6){
      tracking_nums = ("000000"+tracking_nums).slice(-6);
    }
    
    var full_name = facility + " " + tracking_nums //assume you need to do this
    
    if(tracking_nums.indexOf("|") > -1){  //if facility name here, extract number, but also still use the setup
      full_name = "" + tracking_nums
      var split_arr = tracking_nums.split("|") //extract tracking nums still
      tracking_nums = split_arr[1].trim()
    }

    
    if(existing_tracking_nums.indexOf(tracking_nums) == -1){
        coleman_to_do_sheet.appendRow(["","","","",coleman_note,full_name,facility,tracking_nums])
        main_sheet.getRange((row_index+1), (indexInSirum+1)).setValue("On coleman sheet " + date_string)
        existing_tracking_nums.push(tracking_nums)
    } else {
        main_sheet.getRange((row_index+1), (indexInSirum+1)).setValue("ALREADY ON COLEMAN SHEET")
    }
  }
  
  return existing_tracking_nums
}



//get_coleman_exclude
//Looks at the Data Validation sheet column J to see all the state fields to ignore
//when pending the coleman to-dos
function get_coleman_exclude(data_val_sheet){
  var data = data_val_sheet.getDataRange().getValues() //.getRange("J2:J").getValues()//data_val_sheet.getDataRange().getValues();
  var first_row = data[0]
  var index_col = first_row.indexOf("DO NOT SEND TO COLEMAN - STATES")
  Logger.log(index_col)
  if(index_col > -1){
    var res = []
    for(var i = 1; i < data.length; i++){
      if(data[i][index_col].toString().trim().length > 0){
        res.push(data[i][index_col].toString().trim());
      }
    }
    return res
  } else {
    debugEmail("ERROR WITH DATA VAL", "Couldn't find the Coleman Exclude column of Data Validation")
    return []
  }
}


//look at the coleman todo sheet and build an array of the tracking numbers already there, to make sure we're not repeating anything
function get_existing_coleman_trackings(coleman_todo_sheet){
    var raw_data = coleman_todo_sheet.getRange("H2:H").getValues()
    var data = raw_data.filter(function(el){
      return el.toString().trim().length > 0
    })
    
    var res = []
    
    for(var i = data.length - 1; i > data.length - 100 ; i--){
      res.push(data[i].toString().trim())
    }
    return res
}


//Integrates with the coleman to-do sheet to auto-populate it with donations that
//need to be logged. Does some checking on whetehr a row corresponds to a coleman donation
//and makes a note whne complete in bertha's mainsheet
function add_to_coleman_sheet(data_row, coleman_to_do_sheet, coleman_exclude_arr,row_index, main_sheet, existing_tracking_nums, indexes, coleman_exclude_accounts){


  var indexActualIssues = indexes.indexActualIssues
  var indexInSirum = indexes.indexInSirum
  var indexColemanTracking = indexes.indexColemanTracking
  var indexResolved = indexes.indexHumanIssues
  var indexColoradElig = indexes.indexCOFwd
  var indexState = indexes.indexState
  var indexFacility = indexes.indexFacilityName
  
  
  var date_string = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy")
  
  if(((data_row[indexInSirum].toString().toLowerCase().indexOf("coleman sheet") == -1) && (data_row[indexInSirum].toString().indexOf("AdlR") == -1)) //not already there
      && (data_row[indexColemanTracking].toString().trim().length > 0) //there is a tracking number populated in column R
      && (data_row[indexColemanTracking].toString().toLowerCase().indexOf("#no") == -1) //there is a tracking number populated in column R
      && (data_row[indexColemanTracking].toString().toLowerCase().indexOf("#crnorecord") == -1) //this note is not in column R
      && (coleman_exclude_arr.indexOf(data_row[indexState].toString().trim()) == -1)  //not a state we want to exclude 
      && (coleman_exclude_accounts.indexOf(data_row[indexFacility].toString().toLowerCase().trim()) == -1)  //not a facility we don't wanna include
      && (((data_row[indexActualIssues].toString().trim().length > 0) && (data_row[indexResolved].toString().toLowerCase().indexOf("resolv") > -1)) 
         || (data_row[indexActualIssues].toString().replace(/;This should have gone to Coleman. Row ID: \d{0,9}/g,"").trim().length == 0))
      && ((data_row[indexColoradElig].toString().length == 0) || (data_row[indexColoradElig].toString().indexOf("ineligible") > -1))){
    Logger.log("PASSED TESTS")
    var facility = data_row[indexFacility]
    var tracking_nums = data_row[indexColemanTracking].toString().trim()
    if(tracking_nums.length < 6){
      tracking_nums = ("000000"+tracking_nums).slice(-6);
    }
    
    if(existing_tracking_nums.indexOf(tracking_nums) == -1){
        coleman_to_do_sheet.appendRow(["","","","","",facility + " " + tracking_nums,facility,tracking_nums])
        main_sheet.getRange((row_index+1), (indexInSirum+1)).setValue("On coleman sheet " + date_string)
        existing_tracking_nums.push(tracking_nums)
    } else {
        main_sheet.getRange((row_index+1), (indexInSirum+1)).setValue("ALREADY ON COLEMAN SHEET")
    }
  }
  
  return existing_tracking_nums
}




//build a list of all facilities for which we'd need tracking #s checked
function get_contacts_requiring_v2_to_v1(sh){
  
  sh = SpreadsheetApp.getActiveSpreadsheet() //TODO delete after full integration
  var contact_sheet = sh.getSheetByName('2 - Contacts')
  var data = contact_sheet.getDataRange().getValues()
  var res = []
  for(var i = 0; i < data.length; i++){
    if(data[i][10].toString().indexOf("V2") > -1) res.push(data[i][1])
  }
  return res
  
}


//In case we get out of whack, and miss values, use this to do a one-time sweep of numbers
function sweep_for_numbers(){
  var sh = SpreadsheetApp.getActiveSpreadsheet()
  var archive = SpreadsheetApp.openById('11fpKJAaOB080HRK0WO7Ekt0l_nsNAse7eNT5xSjsCr8')
  var old_archive = SpreadsheetApp.openById('1bCU7891nSDDb9VHhotTs09vyKfUK_hsRPsJ6x6EH9IY')
  
  var facilities = get_contacts_requiring_v2_to_v1()
  
  var main_page = sh.getSheetByName('1 - Main Page')
  var main_page_archive = sh.getSheetByName('Main Page Archive')
  var main_page_final_archive = archive.getSheetByName('Main Page Final Archive')
  var old_final_archive = old_archive.getSheetByName('DEP FORMAT 2-17-19 - Main Page Archive')
  
  var data = main_page.getDataRange().getValues()
  
  var numbers = []
  
  for(var i = 0; i < data.length; i++){
    if(facilities.indexOf(data[i][2].toString().trim()) > -1){
      if(data[i][14].toString().trim().length > 0){
        numbers.push(data[i][14].toString().trim())
      }
    }
  }
  
  Logger.log(numbers.length)
  //Logger.log(numbers)
  
  data = main_page_archive.getDataRange().getValues()
  for(var i = 0; i < data.length; i++){
    if(facilities.indexOf(data[i][2].toString().trim()) > -1){
      if(data[i][14].toString().trim().length > 0){
        numbers.push(data[i][14].toString().trim())
      }
    }
  }

  Logger.log(numbers.length)
  
  data = main_page_final_archive.getDataRange().getValues()
  for(var i = 0; i < data.length; i++){
    if(facilities.indexOf(data[i][2].toString().trim()) > -1){
      if(data[i][14].toString().trim().length > 0){
        numbers.push(data[i][14].toString().trim())
      }
    }
  }

  Logger.log(numbers.length)
  
  data = old_final_archive.getDataRange().getValues()
  for(var i = 0; i < data.length; i++){
    if(facilities.indexOf(data[i][2].toString().trim()) > -1){
      if(data[i][8].toString().trim().length > 0){
        if(data[i][14].toString().toLowerCase().indexOf('coleman') == -1) numbers.push(data[i][8].toString().trim())
      }
    }
  }

  Logger.log(numbers.join("\n"))
  
}


