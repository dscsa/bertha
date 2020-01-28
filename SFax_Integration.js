

function performMainPageTagging(obj_to_process, main_page){
  var completed = []
  
  var indexes = getMainPageIndexes()
  var indexSFaxInfo = indexes.indexRawFax
  var indexManualTrackingNum = indexes.indexColemanTracking
  var indexActualIssues = indexes.indexActualIssues 
  var indexInSirum = indexes.indexInSirum
  var indexFacilityName = indexes.indexFacilityName

  var page_data = main_page.getDataRange().getValues()
  for(var i = 1; i < page_data.length; i++){
    if(page_data[i][indexManualTrackingNum].toString().trim().length == 0){ //only checking if we haven't already (which essentialy happens if nothing in the manual tracking num column yet
      
      if(page_data[i][indexSFaxInfo].toString().indexOf("Sfax") > -1){ //only looking at sfax rows
        var sfax_id = page_data[i][indexSFaxInfo].toString().split("\n")[1].trim()

        if(sfax_id in obj_to_process){ //so its an sfax we wanna tag, that hasn't arleady been tagged, and we got the info, perfection
          var relavant_obj = obj_to_process[sfax_id]
          if((relavant_obj["faxPages"] == "1") || (relavant_obj["faxSuccess"] == "0")){ //then it might be buggy, so make a note in issues
            main_page.getRange((i+1),(indexActualIssues+1)).setValue("Fax may not be complete. " + page_data[i][indexActualIssues].toString())
          }
          //now, if they're labeled as TODO for coleman, then add facility name here. Otherwise don't
          var track_nums = makeSetStringOfArrayString(relavant_obj["tracking_nums"])
          
          if(track_nums.trim().length == 0){
            main_page.getRange((i+1),(indexActualIssues+1)).setValue("No tracking numbers found. " + page_data[i][indexActualIssues].toString())
          }
          
          if((page_data[i][indexFacilityName].indexOf("Not Found") == -1) && (track_nums.trim().length > 0)){
            var old_tracking_val = page_data[i][indexManualTrackingNum].toString().trim()
            if(old_tracking_val.trim().length > 0) old_tracking_val = "\n" + old_tracking_val
            
            var new_val = page_data[i][indexFacilityName] + " | " + track_nums + old_tracking_val
            main_page.getRange((i+1), (indexManualTrackingNum+1)).setValue(new_val)
          } else {
            main_page.getRange((i+1), (indexManualTrackingNum+1)).setValue(track_nums)
          }
          completed.push(sfax_id)
        }
      }
      
    }
  }
  return completed

}


function makeSetStringOfArrayString(arr_string){
  var arr = arr_string.split(",")
  var res = []
  for(var i = 0; i < arr.length; i++){
    var temp_contents = arr[i].trim().indexOf("9714242") > -1 ? arr[i].trim().substring(9) : arr[i].trim()
    if(res.indexOf(temp_contents) == -1){
      res.push(temp_contents)
    }
  }
  return res.join(", ")
}




function tagSFaxRows(ss,date,main_page){
  var backend_sh = SpreadsheetApp.openById(BACKEND_ID)

   //Then look at the SFax pings and process any new ones to add tracking nums to the main_page
  var sfax_sheet = backend_sh.getSheetByName("SFax Integration")
  var sfax_sheet_data = sfax_sheet.getDataRange().getValues()
  
  var index_sfax_tag = 6
  var index_sfax_id = 3
  var index_sfax_obj = 2
  
  var new_todos = {}
  
  for(var i = 1; i < sfax_sheet_data.length; i++){
    if(sfax_sheet_data[i][index_sfax_tag].toString().trim().length == 0){ //make sure it's not a row we've already processed
      
      var fax_id = sfax_sheet_data[i][index_sfax_id].toString()
      var obj_raw = sfax_sheet_data[i][index_sfax_obj].toString()
      
      if(obj_raw.indexOf('{"') == 0){ //then its an object, otherwise do nothing
        var full_resp_obj = JSON.parse(obj_raw)
        if(!("isSuccess" in full_resp_obj)){ //make sure its not an error object
          new_todos[fax_id] = full_resp_obj
        } else {
          sfax_sheet.getRange((i+1), (index_sfax_tag+1)).setValue(date) //tag a row
        }
      } else {
        sfax_sheet.getRange((i+1), (index_sfax_tag+1)).setValue(date) //tag a row

      }
      
    }
  }
  
  //new_todos is now an object with fax_ids as keys, and all the info we need for the fax in the object itself. 
  //go to the main_page and perform relavant tagging
  var completed_ids = performMainPageTagging(new_todos,main_page)
  var sfax_sheet_data = sfax_sheet.getDataRange().getValues()
  for(var i = 1; i < sfax_sheet_data.length; i++){
    if(completed_ids.indexOf(sfax_sheet_data[i][index_sfax_id].toString()) > -1){
      sfax_sheet.getRange((i+1), (index_sfax_tag+1)).setValue(date) //tag a row
    }
  }
}


//Currently not working: Integration with SFax to use their barcode reading functionality
function getToken(){
  var enc_key = ENC_KEY
  var USERNAME = "omarsow"
  var APIKEY = API_KEY
  var timestr = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd HH:mm:ss").replace(" ","T") + "Z"
  var raw = "Username="+USERNAME+"&ApiKey="+APIKEY+"&GenDT="+timestr+"&"
  Logger.log(raw)
  //use Cipher-Block Chaining (CBC) to encrypt
  Logger.log(sjcl.encrypt(enc_key,raw))
}



function doGet(e) { //Sfax should be sending GETs
  var date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss")
  var params = e.parameter
  var api_key = params['apikey']
  var token = params['token']
  var fax_id = params['faxid']
  
  //debugEmail('GOT a request from SFAX', JSON.stringify(params))
  
  var full_info = (typeof fax_id === 'undefined') ? 'Not a real callback' : getBarcodeInfo(fax_id,api_key,token)
  if(!full_info) full_info = "Failed to call SFax"
  
  //debugEmail('Full Info for Inbound Fax returned value', JSON.stringify(full_info))
  
  var backend_sh = SpreadsheetApp.openById(BACKEND_ID)

  var page = backend_sh.getSheetByName("SFax Integration")
 
  var column_notation = "A:G"
  page.getRange(column_notation).setNumberFormat("@STRING@")
  
  if(typeof full_info['faxSuccess'] === 'undefined'){
    page.appendRow([date,params,JSON.stringify(full_info)])
  } else {
    page.appendRow([date,params,JSON.stringify(full_info),fax_id,params['infromfaxnumber'],params['intofaxnumber']])
  }
  
  return HtmlService.createHtmlOutput("<div>SUCCESS</div>")
}

function doPost(e){
  var date = Utilities.formatDate(new Date(), "GMT-07:00", "MM/dd/yyyy HH:mm:ss")
  var params = e.parameter
  var api_key = params['apikey']
  var token = params['token']
  var fax_id = params['faxid']
  
  var full_info = (typeof fax_id === 'undefined') ? 'Not a real callback' : getBarcodeInfo(fax_id,api_key,token)
  if(!full_info) full_info = "Failed to call SFax"
  var backend_sh = SpreadsheetApp.openById(BACKEND_ID)

  var page = backend_sh.getSheetByName("SFax Integration")
 
  var column_notation = "A:G"
  page.getRange(column_notation).setNumberFormat("@STRING@")
  
  if(typeof full_info['faxSuccess'] === 'undefined'){
    page.appendRow([date,params,JSON.stringify(full_info)])
  } else {
    page.appendRow([date,params,JSON.stringify(full_info),fax_id,params['infromfaxnumber'],params['intofaxnumber']])
  }
  
  return HtmlService.createHtmlOutput("<div>SUCCESS</div>")
}






//Given the info from an SFax ping, puts together an API request to them, and process the full info
//for a given fax
function getBarcodeInfo(fax_id,api_key,token){
  var url = "https://api.sfaxme.com/api/InboundFaxInfo?token=" + encodeURIComponent(token) + "&apikey=" + encodeURIComponent(api_key) + "&FaxId=" + encodeURIComponent(fax_id)
  try{
    var res = JSON.parse(UrlFetchApp.fetch(url).getContentText())
    return extractFaxInfo(res)
  } catch(err){
    return err
  }
}

//Given the response object from SFax's InboundFaxInfo call, returns an object with relavant pieces
//and especially tracking numbers extracted
function extractFaxInfo(sfax_response_obj){
  //var sfax_response_obj = JSON.parse('{"inboundFaxItem":{"FaxId":"2190401201000980691","Pages":"4","ToFaxNumber":"18557916085","FromFaxNumber":"5302731333","FromCSID":"2731333","FaxDateUtc":"4/1/2019 8:10:18 PM","FaxSuccess":"1","Barcodes":{"FirstBarcodePage":1,"TotalPagesWithBarcodes":1,"PagesWithBarcodes":[1],"BarcodeItems":[{"BarcodeSpacingXAxis":0,"BarcodeSpacingYAxis":0,"BarcodeType":0,"BarcodeMode":1,"BarcodeData":"9612019971424215517488","BarcodeX":157,"BarcodeY":1773,"BarcodePage":1,"BarcodeScale":0,"BarcodeWidth":684,"BarcodeHeight":303},{"BarcodeSpacingXAxis":0,"BarcodeSpacingYAxis":0,"BarcodeType":0,"BarcodeMode":1,"BarcodeData":"[)>010295112840019971424215517488FDEB97142420501/12.0LBN725 E. Santa Clara Street, Ste 202San JoseCA 0610ZGD00811ZBetter Health Pharmacy12Z650488743423ZN22ZN20Z 028Z97142421551748831Z                                  33Z  34Z019KD261R818T33379P26Z1891","BarcodeX":116,"BarcodeY":1455,"BarcodePage":1,"BarcodeScale":0,"BarcodeWidth":556,"BarcodeHeight":245}]},"InboundFaxId":"2190401201000980691","FaxPages":"4","FaxDateIso":"2019-04-01T20:10:18Z","WatermarkId":"2190401201018997198","CreateDateIso":"2019-04-01T20:10:18.1207720Z"},"isSuccess":true,"message":null}')

  var res = {}
  
  if(!sfax_response_obj['inboundFaxItem']) return sfax_response_obj //if it's an error, then just return original content
  
  //debugEmail('SFax Response to Query about Inbound details', JSON.stringify(sfax_response_obj))
  
  res['faxPages'] = sfax_response_obj['inboundFaxItem']['FaxPages']
  res['faxSuccess'] = sfax_response_obj['inboundFaxItem']['FaxSuccess']
  var barcodes = sfax_response_obj['inboundFaxItem']['Barcodes']['BarcodeItems']
  var tracking_nums = []
  var rx = /971424215(\d{6})/
  for(var i = 0; i < barcodes.length; i++){
    var parsed = barcodes[i]['BarcodeData'].toString().match(rx)
    if(parsed) tracking_nums.push(parsed[0].toString())
  }
  res['tracking_nums'] = "" + tracking_nums
  Logger.log(res)
  return res
}



function getV1Info(tracking_num) {
  var raw_info_url = TRACKING_URL
  var url = raw_info_url + tracking_num
  var res = UrlFetchApp.fetch(url, {muteHttpExceptions:true}).getContentText()
  if(res == "[]"){
    return "No donation matched"
  } else if(res.toString().toLowerCase().indexOf("error") > -1){
    return res
  } else {
    var obj_res = JSON.parse(res)[0]
    return res
  }
}