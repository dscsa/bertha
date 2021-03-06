//----------------------------------HELPER FUNCTIONS----------------------------------------------------------------------------------------------

//compares a full trcking number with the sfax barcode filled field. helpful in matching rows if one exists for exactly that number already
function matched_row_by_tracking_number(sfax_number_field, shipped_email_number){
  var rx = /[0-9]{6}/
  var res = rx.exec(sfax_number_field)
  if(res !== null){
    Logger.log(~ shipped_email_number.indexOf(res[0]))
    return ~ shipped_email_number.indexOf(res[0])
  }
}


//Looks at shipped emails to extract the tracking number and facility that shipped.
//USed in tagging rows on the main page
function extractShippedText(content){
  var rx = /number ([0-9]{15}) from (.*?) was shipped/
  var res = rx.exec(content.replace(/(\r\n|\n|\r)/gm," ").replace(/ +(?= )/g,''," ")) 
  if(res == null){
    debugEmail('Error parsing shipped email', content)
    console.log('error parsing shipped email', content)
    return res
  }
  Logger.log(res)
  return [res[1], res[2]]
}




//Looks at the Data Validation sheet column J to see all the state fields to ignore
//when pending the coleman to-dos
function getPharmacyNames(data_val_sheet){
  var data = data_val_sheet.getDataRange().getValues() //.getRange("J2:J").getValues()//data_val_sheet.getDataRange().getValues();
  var first_row = data[0]
  var index_col = first_row.indexOf("DO NOT SEND TO COLEMAN - FACILITIES")

  if(index_col > -1){
    var res = []
    for(var i = 1; i < data.length; i++){
      if(data[i][index_col].toString().trim().length > 0){
        res.push(data[i][index_col].toString().toLowerCase().trim());
      }
    }
    return res
  } else {
    debugEmail("ERROR WITH DATA VAL", "Couldn't find the Pharmacy name column of Data Validation")
    return []
  }
}


//Given a template with variables formatted $(variable name)
//returns all the variable names, useful for gneerating email drafts
function extract_variables(template){
  var rx = /\$\(([a-zA-Z\s]*)\)/gm
  var res = []
  var last_match = rx.exec(template)
  
  while(last_match){
    res.push(last_match[1])
    last_match = rx.exec(template)
  }
  
  return res
}


//send_alert_email(error_code, phone_number, facility, message_to_fill, error_array)
//Handles sending an email out from this address to the relavant parties with relavant message. Can take message_to_fill from the 
//action required column of the contacts, or the phone_number of an unknown fax. Different error_codes create different kinds of emails
//and require different data. Considered a helper since both Auto-Log and the daily sweep use it, only the latter needs an error array
//-------------------------------------

function send_alert_email(error_code, phone_number, facility, message_to_fill, error_array){ //needs number for unknown cases, facility & message for action items, and could use
   //error codes in the future to determine severity of action, and who the email should go to
  var subject = "Auto-Logger Message"
  var message = "Hi y'all!\n\n" //for character ;)
  
  
  if(error_code==1){               //Then it couldn't match the facility
    subject = "Bertha: Fax received from Unknown Number"
    message += "You've received a fax from " + phone_number + ", which doesn't match up with my Contacts sheet. Could you please update me and enter this donation!\n\n"
    message += "Just so you know, when updating my contacts for this facility, please enter the name EXACTLY as it appears on sirum.org, or my other features won't work."
  } else if(error_code==2){               
    subject = "Bertha: Action Required Donation from " + facility
    message += message_to_fill
  } else if(error_code==3){                            //Then there was misuse of the API
    subject= "Bertha: Incorrect Use Of Email API for " + phone_number
    message += message_to_fill
  } else if(error_code==4){                           //Then it's the daily roundup of attention items
    subject = "Bertha: Daily Batch of Outstanding Issues"
    message += "I did a sweep of the records today, and there are some donation issues that need resolution. Here they are:\n"
    debugEmail("BUGGY ISSUE SWEEP", error_array)
    for(var i = 0; i < error_array.length; ++i){
      if(typeof error_array[i] !== "undefined"){
        message += "\n"
        message += error_array[i].toString()
      }
    }
  } else if(error_code == 5){ //then it's a shipped email we couldt match
    subject = "Bertha: Unmatchable Tracking Number"
    message += message_to_fill
  } else if(error_code == 6){ //Then it's about pending pickups to schedule
    subject = "Pending Pickups For Approval"
    message += "So these seem to be the facilities I should set a pickup for. Let me know if there's a mistake!\n"
    for(var i = 0; i < error_array.length; ++i){
      message += "\n"
      message += error_array[i].toString()
    }
  } else if(error_code == 7){
    subject= "Bertha: Pickups to cancel"
    message = "There are some pickups you need to cancel. I have an outstanding pickup scheduled but just saw a shipped email."
    message += "\n\n" + message_to_fill
  }
  
  message += "\n\nLove,\n\nBertha\n\nI live here: https://goo.gl/3Hi6ww"    //for character ;)
  
  teamEmail(subject, message)
}





//getDateFromString(date)
//This takes a string "MM/DD/YYYY " and spits back a date object, for times when programmatically checking on dates
//--------------------------------------------
function getDateFromString(just_date){
  var year = just_date.substring(nthIndex(just_date,"/",2)+1,just_date.indexOf(" "))
  var day = parseInt(just_date.substring(0,nthIndex(just_date,"/",1)),10)-1 //the month is zero-indexed in the Date Object
  var month = just_date.substring(nthIndex(just_date,"/",1)+1,nthIndex(just_date,"/",2))
  return new Date(year,day,month) //splits up the string into a new date object
}




//duplicate_row_below(page,n)
//Duplicates row n right below itself, copying over the non-unique values and the date shipped. Used for creating a new row if 
//there are more tracking numbers than rows, and we receive "Donation Shipped" emails for more tracking numbers than
//there is space. This is how we account for an Sfax with multiple coversheets.
//---------------------------------------------
function duplicate_row_below(page,n){
     page.insertRowAfter(n+1)
     var data = page.getDataRange().getValues();

     var indexes = get_main_indexes()
     var index_action = indexes.indexPend
     var index_logger = indexes.indexLogger
     var index_facility_name = indexes.indexFacilityName
     var index_state = indexes.indexState
     var index_historic_issues = indexes.indexIssues
     var index_contact = indexes.indexContact
     var index_pickup = indexes.index_pickup
     var index_shipped = indexes.indexShippedEmail
     var index_in_sirum = indexes.indexInSirum
     var indexColemanTracking = indexes.indexColemanTracking

     page.getRange((n+2),(indexColemanTracking+1)).setValue("autopopulated #NO b/c multiple boxes shipped with 1 fax")
     page.getRange((n+2),(index_action+1)).setValue(data[n][index_action].trim())
     page.getRange((n+2),(index_logger+1)).setValue("Bertha")
     page.getRange((n+2),(index_facility_name+1)).setValue(data[n][index_facility_name].trim())
     page.getRange((n+2),(index_state+1)).setValue(data[n][index_state].trim())
     page.getRange((n+2),(index_historic_issues+1)).setValue(data[n][index_historic_issues].trim())   
     page.getRange((n+2),(index_contact+1)).setValue(data[n][index_contact].trim())
     page.getRange((n+2),(index_pickup+1)).setValue(data[n][index_pickup].trim())
     page.getRange((n+2),(index_shipped+1)).setValue(data[n][index_shipped].trim())
     page.getRange((n+2),(index_in_sirum+1)).setValue(data[n][index_in_sirum].trim())

}





//nthIndex
//Finds the index of nth occurence of a given character in a string. str is string, pat is the character, n is the n-th occurence
//e.g. nthIndex("a/b/c/d","/",2) = 3 , having found the second forward slash
//----------------------------
function nthIndex(str, pat, n){
    var L= str.length, i= -1;
    while(n-- && i++<L){
        i= str.indexOf(pat, i);
        if (i < 0) break;
    }
    return i;
}



//businessDaysFromDate
//Calculates and returns a date object for the business day that is x days from the input parameter. Used for setting the pickups
//to be one business day from current date. Could theoretically keep track of any major holidays as well, and not set 
//pickups on those days.
//----------------------------
function businessDaysFromDate(date,businessDays) {
  var counter = 1, tmp = new Date(date);
  tmp.setTime(date.getTime() - 7200000) //subtract two hours from right now so that it can still set pickups for tomorrow about 5PM
  while( businessDays>0 ) {
    tmp.setTime( date.getTime() + counter * 86400000 );
    if(isBusinessDay (tmp)) {
      --businessDays;
    }
    ++counter;
  }
  return tmp;
}



//isBusinessDay
//Keeps in memory a list of days that are Federal holidays, and weekends, to determine
//if a date object passed to it is a business day. Returns a boolean.
//----------------------------
function isBusinessDay (date) {
  var dayOfWeek = date.getDay();
  Logger.log(dayOfWeek)
  if(dayOfWeek === 0 || dayOfWeek === 6) {
    // Weekend
    return false;
  }

  holidays = [
    '12/31+5', // New Year's Day on a saturday celebrated on previous friday
    '1/1',     // New Year's Day
    '1/2+1',   // New Year's Day on a sunday celebrated on next monday
    '1-3/1',   // Birthday of Martin Luther King, third Monday in January
    '2-3/1',   // Washington's Birthday, third Monday in February
    '5~1/1',   // Memorial Day, last Monday in May
    '7/3+5',   // Independence Day
    '7/4',     // Independence Day
    '7/5+1',   // Independence Day
    '9-1/1',   // Labor Day, first Monday in September
    '10-2/1',  // Columbus Day, second Monday in October
    '11/10+5', // Veterans Day
    '11/11',   // Veterans Day
    '11/12+1', // Veterans Day
    '11-4/4',  // Thanksgiving Day, fourth Thursday in November
    '12/24+5', // Christmas Day
    '12/25',   // Christmas Day
    '12/26+1',  // Christmas Day
  ];

  var dayOfMonth = date.getDate(),
  month = date.getMonth() + 1,
  monthDay = month + '/' + dayOfMonth;

  if(holidays.indexOf(monthDay)>-1){
    return false;
  }

  var monthDayDay = monthDay + '+' + dayOfWeek;
  if(holidays.indexOf(monthDayDay)>-1){
    return false;
  }

  var weekOfMonth = Math.floor((dayOfMonth - 1) / 7) + 1,
      monthWeekDay = month + '-' + weekOfMonth + '/' + dayOfWeek;
  if(holidays.indexOf(monthWeekDay)>-1){
    return false;
  }

  var lastDayOfMonth = new Date(date);
  lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1);
  lastDayOfMonth.setDate(0);
  var negWeekOfMonth = Math.floor((lastDayOfMonth.getDate() - dayOfMonth - 1) / 7) + 1,
      monthNegWeekDay = month + '~' + negWeekOfMonth + '/' + dayOfWeek;
  if(holidays.indexOf(monthNegWeekDay)>-1){
    return false;
  }

  return true;
}



//Adds trakcing number to db, which can be periodically checked for duplicates
function addTrackingToDB(tracking_number, from_facility, tracking_db_sheet){
  var data = tracking_db_sheet.getDataRange().getValues()
  for(var i = 0; i < data.length; i++){
    if(data[i][0].toString().trim() == from_facility){ //look for the facility's row
      var existing_nums = data[i][1].toString().split(";") //an array
      existing_nums.push(tracking_number)
      tracking_db_sheet.getRange((i+1), 2).setValue(existing_nums.join(";"))
      return
    }
  }
  //if you get here, then the facility wasn't there, so add it
  tracking_db_sheet.appendRow([from_facility, tracking_number])
}








