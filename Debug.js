//when the archiving functionality labeled a bunch of rows even though they were incomplete on 4/21/20
function debugOverEagerArchive() {
  
  var indexes = getMainPageIndexes()

  var sh = SpreadsheetApp.getActiveSpreadsheet()
  var archive = sh.getSheetByName("Main Page Archive")
  var main_page = sh.getSheetByName("1 - Main Page")
  var data = archive.getDataRange().getValues()
  
  for(var i = 1; i < data.length; i++){
    if(!meetsArchiveCriteria(data[i], indexes)){
      Logger.log(data[i][data[i].length-1].toString())
      archive.getRange((i+1),1,1,archive.getMaxColumns()).setBackground("red")
      //main_page.appendRow(data[i])
      //autoGroup(data[i][2].toString().trim())
    }
  }
  
}

/*
Timestamps found on erroneously tagged rows
14:15:33
18:15:32
List as of 1/24/20
//the issue of the CO-Fwd is still there
[20-01-24 13:04:58:635 EST] 149699
[20-01-24 13:04:58:670 EST] 494359
[20-01-24 13:04:58:674 EST] 335890
[20-01-24 13:04:58:677 EST] 129977
[20-01-24 13:04:58:679 EST] 140410
[20-01-24 13:04:58:681 EST] 292584
[20-01-24 13:04:58:685 EST] 484940
[20-01-24 13:04:58:694 EST] 78540
[20-01-24 13:04:58:696 EST] 123213
[20-01-24 13:04:58:735 EST] 96770
[20-01-24 13:04:58:738 EST] 494359


*/


