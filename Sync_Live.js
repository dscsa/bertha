//LIVE SIDE CODE

//Any functions useful in keeping the Test Server synced up
//On it's side, there are a lot of mirror functions


//Run, and copy the string into updateProperties on Test server
function printProperties() {
  Logger.log(JSON.stringify(PropertiesService.getScriptProperties().getProperties()))
}



//Used to propagate changes through to the Test sheet if they meet certain criteria
function syncTest(e){
  Logger.log("herererer")
  var user = e.user.toString()
  Logger.log(user)
  //if(~ TRACKING_USERS.indexOf(user)){ //only track certain users, don't try copying over changes 
    var range = e.range
    var new_val = e.value
    Logger.log(range.getA1Notation())
    Logger.log(user)
  //}
  

  
}


