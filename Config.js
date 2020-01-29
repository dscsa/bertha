var LIVE = true
var LABEL_NAME = "Bertha"


function testIndexes(){
  Logger.log(get_main_indexes())
  Logger.log(get_contact_indexes())

}


//TODO: add indexes to property and build this out
function get_pickup_sheet_indexes(){
  var indexes = PropertiesService.getScriptProperties()  

  var res_obj = {
    //TODO here
  }
  
  return res_obj

}


//Indexes are stored in the script properties, so they're more editable.
//Calling this function returns an object that can be used for indexing
//Shouldn't be any magic numbers in any file.
//Also allows for column headers to be user-editable. Only ordering matters

//TODO: turn these into global variables e.g. MAIN_INDEX_ARCHIVED
//and store the numbers right here, instead of using the scriptProperties 
function get_main_indexes(){
  var indexes = PropertiesService.getScriptProperties()  

  var res_obj = {
    indexArchived : parseInt(indexes.getProperty('indexMainPageArchive')),
    indexPend : parseInt(indexes.getProperty('indexMainPageAction')),
    indexFacilityName : parseInt(indexes.getProperty('indexMainPageFacilityName')),
    indexState : parseInt(indexes.getProperty('indexMainPageState')),
    indexIssues : parseInt(indexes.getProperty('indexMainPageHistoriceIssues')),
    indexContact : parseInt(indexes.getProperty('indexMainPageContact')),
    indexTrackingNum : parseInt(indexes.getProperty('indexMainPageAutoTrackingNum')),
    indexCOFwd : parseInt(indexes.getProperty('indexMainPageCOFWD')),
    indexShippedEmail : parseInt(indexes.getProperty('indexMainPageShippedEmail')),
    indexReceivedEmail : parseInt(indexes.getProperty('indexMainPageReceivedEmail')),
    indexInSirum : parseInt(indexes.getProperty('indexMainPageInSirum')),
    indexColemanTracking : parseInt(indexes.getProperty('indexMainPageManualTrackingNum')),
    indexHumanIssues : parseInt(indexes.getProperty('indexMainPageResolved')),
    indexSuppliesNotes : parseInt(indexes.getProperty('indexMainPageSuppliesNotes')),
    indexIncompleteSupplies : parseInt(indexes.getProperty('indexMainPageSuppliesRequested')),
    indexActualIssues : parseInt(indexes.getProperty('indexMainPageIssues')),
    index_pickup : parseInt(indexes.getProperty('indexMainPageLocation')),
    indexRawFax : parseInt(indexes.getProperty('indexMainPageContactType')),
    indexEmailOne : parseInt(indexes.getProperty('indexMainPageEmailOne')),
    indexEmailTwo : parseInt(indexes.getProperty('indexMainPageEmailTwo')),
    indexEmailThree : parseInt(indexes.getProperty('indexMainPageEmailThree')),
    indexLogger : parseInt(indexes.getProperty('indexMainPageLogger')),
    indexRowID : parseInt(indexes.getProperty('indexMainPageRowID')),
    indexIssues : parseInt(indexes.getProperty('indexMainPageUpdateCol')),
    indexEmailAddr : parseInt(indexes.getProperty('indexMainPageEmailAddresses'))

   }
  
  return res_obj
}

//Same as contact page
function get_contact_indexes(){
  var indexes = PropertiesService.getScriptProperties()  

  var res_obj = {
    indexFaxnumber : parseInt(indexes.getProperty('indexContactPageFaxNumber')),
    indexFacility : parseInt(indexes.getProperty('indexContactPageFacility')),
    indexState : parseInt(indexes.getProperty('indexContactPageState')),
    indexPickup : parseInt(indexes.getProperty('indexContactPagePickup')),
    indexIssue : parseInt(indexes.getProperty('indexContactPageIssue')),
    indexContact : parseInt(indexes.getProperty('indexContactPageContact')),
    indexId : parseInt(indexes.getProperty('indexContactPageID')),
    indexLastDonationDate : parseInt(indexes.getProperty('indexContactPageLastDate')),
    indexSuppliesNotes : parseInt(indexes.getProperty('indexContactPageSuppliesNote')),
    indexSalesforceContacts : parseInt(indexes.getProperty('indexContactPageSalesforceContact')),
    indexImportFormat : parseInt(indexes.getProperty('indexContactPageImportFormat')),
    indexAllEmails : parseInt(indexes.getProperty('indexContactPageFacilityEmails')),

  }
  
  return res_obj

}