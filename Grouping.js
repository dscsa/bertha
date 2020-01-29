
//Triggered by button, useful for supply requests
function manual_group(){
    
  var indexes = get_main_indexes()
  
  var indexFacilityName = indexes.indexFacilityName
  var indexLogger = indexes.indexLogger
  
  var sh = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("1 - Main Page")
  
  var data = sh.getDataRange().getValues()
  var name = data[data.length -1][indexFacilityName].toString().trim() //get from last row
  var last_row_index = -1
  var store_arr = [] 
  var num_deleted = 0
  
  //if a row has the same name, add that whole row to store_arr
  //keep track of index of the last one in last_row_index
  for(var i = data.length-1; i >= 0; i--){ //in REVERSE because if we're deleting rows, we'd mess up the ordering
    if(data[i][indexFacilityName].toString().trim() == name){
      if(last_row_index < 0){ //the last row doesnt need to be copied & deleted
        last_row_index = i
      } else {
        store_arr.push(data[i]) //keep track of the whole row
        sh.getRange((i+1), (indexLogger+1)).setValue("DELETE FOR GROUPING") //make a note in col B
      }
    }
  }
  
  store_arr.reverse() //because it went up the sheet, rows were added reverse chronological, reverse it back
  
  if(store_arr.length > 0){ 
   sh.insertRowsBefore(last_row_index+1, store_arr.length) //add enough space for the new rows in store_arr
   var range_to_fill = sh.getRange((last_row_index+1),1,store_arr.length, store_arr[0].length) //dont do +1 for the second part of this range because we also want to fill the original row
   range_to_fill.clearDataValidations()
   range_to_fill.setValues(store_arr) //copy them in, the order of pushing should maintain chronological ordering
  }
  
  //then go through and delete
  data = sh.getDataRange().getValues() //refresh this variable
  for(var i = data.length-1; i >= 0; i--){ //in REVERSE because if we're deleting rows, we'd mess up the ordering
    if(data[i][indexLogger].toString().indexOf("DELETE") > -1){
      sh.deleteRow(i+1) //delete that row
    }
  }
}


//called at the end of the appendRow function.
//Given a facility name, it'll find all the rows with that name still in the main page
//and move them down to group with the new row (they'll appear right chronologically before the new row & maintain their ordering)
function auto_group(name){
  
  var indexes = get_main_indexes()
  var indexFacilityName = indexes.indexFacilityName
  var indexLogger = indexes.indexLogger
  
  var sh = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("1 - Main Page")

  var data = sh.getDataRange().getValues()
  var last_row_index = -1
  var store_arr = [] 
  var num_deleted = 0
  
  //if a row has the same name, add that whole row to store_arr
  //keep track of index of the last one in last_row_index
  for(var i = data.length-1; i >= 0; i--){ //in REVERSE because if we're deleting rows, we'd mess up the ordering
    if(data[i][indexFacilityName].toString().trim() == name){
      if(last_row_index < 0){ //the last row doesnt need to be copied & deleted
        last_row_index = i
      } else {
        store_arr.push(data[i]) //keep track of the whole row
        sh.getRange((i+1), (indexLogger+1)).setValue("DELETE FOR GROUPING") //make a note in col B
      }
    }
  }
  
  store_arr.reverse() //because it went up the sheet, rows were added reverse chronological, reverse it back
  
  if(store_arr.length > 0){ 
   sh.insertRowsBefore(last_row_index+1, store_arr.length) //add enough space for the new rows in store_arr
   var range_to_fill = sh.getRange((last_row_index+1),1,store_arr.length, store_arr[0].length) //dont do +1 for the second part of this range because we also want to fill the original row
   if(sh.getMaxColumns() != store_arr[0].length){
   }
   range_to_fill.clearDataValidations()
   range_to_fill.setValues(store_arr) //copy them in, the order of pushing should maintain chronological ordering
  }
  
  //then go through and delete
  data = sh.getDataRange().getValues() //refresh this variable
  for(var i = data.length-1; i >= 0; i--){ //in REVERSE because if we're deleting rows, we'd mess up the ordering
    if(data[i][indexLogger].toString().indexOf("DELETE") > -1){
      sh.deleteRow(i+1) //delete that row
    }
  }
}





//called at the end of the appendRow function.
//Given a facility name, it'll find all the rows with that name still in the main page
//and move them down to group with the new row (they'll appear right chronologically before the new row & maintain their ordering)
function auto_group_supplies(name){
  
  var indexes = get_main_indexes()
  var indexFacilityName = indexes.indexFacilityName
  var indexLogger = indexes.indexLogger
  
  var sh = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("Supplies Page")
  var data = sh.getDataRange().getValues()
  
  var last_row_index = -1
  var store_arr = [] 
  var num_deleted = 0
  
  //if a row has the same name, add that whole row to store_arr
  //keep track of index of the last one in last_row_index
  for(var i = data.length-1; i >= 0; i--){ //in REVERSE because if we're deleting rows, we'd mess up the ordering
    if(data[i][indexFacilityName].toString().trim() == name){
      if(last_row_index < 0){ //the last row doesnt need to be copied & deleted
        last_row_index = i
      } else {
        store_arr.push(data[i]) //keep track of the whole row
        sh.deleteRow(i+1) //delete that row
        num_deleted += 1
      }
    }
  }
  
  last_row_index -= num_deleted
  store_arr.reverse() //because it went up the sheet, rows were added reverse chronological, reverse it back
  
  if(store_arr.length > 0){ 
   sh.insertRowsBefore(last_row_index+1, store_arr.length) //add enough space for the new rows in store_arr
   
   var range_to_fill = sh.getRange((last_row_index+1),1,store_arr.length, sh.getMaxColumns())//dont do +1 for the second part of this range because we also want to fill the original row
   range_to_fill.setValues(store_arr) //copy them in, the order of pushing should maintain chronological ordering
  }
}