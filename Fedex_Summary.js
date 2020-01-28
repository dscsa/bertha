function checkFedexSummary(content, main_page,ss) {

  var tracking_nums = extractTrackingNums(content) //get all the tracking numbers out of the email body

  
  //go to the main page, and confirm that they're all their
  var page_data = main_page.getDataRange().getValues()
  
  var indexes = getMainPageIndexes()
  var index_tracking_number = indexes.indexTrackingNum
  
  for(var i = 0; i < page_data.length; i++){
    if(page_data[i][index_tracking_number].toString().trim().length == 0) continue;
    
    var tmp_ind = tracking_nums.indexOf(page_data[i][index_tracking_number].toString().trim())
    if(~ tmp_ind) tracking_nums.splice(tmp_ind,1)
  }
  
  //for any that aren't found, send an alert email
  if(tracking_nums.length > 0){
    page_data = ss.getSheetByName('Main Page Archive').getDataRange().getValues()
    
    for(var i = 0; i < page_data.length; i++){
      if(page_data[i][index_tracking_number].toString().trim().length == 0) continue;
      
      var tmp_ind = tracking_nums.indexOf(page_data[i][index_tracking_number].toString().trim())
      if(~ tmp_ind) tracking_nums.splice(tmp_ind,1)
    }
    
    if((tracking_nums.length > 0) && LIVE) debugEmail('[ACTION REQUIRED] Shipped Tracking Numbers We Missed!', 'Here they are:\n' + tracking_nums.join("\n"))
    //TODO: ping v1 for information about this tracking number & update manually, send out messages and everything
  }
}

function extractTrackingNums(content){
  var split_content = content.split("\n971")
  var res = []

  for(var i = 0; i < split_content.length; i++){
    var content_bit = "971" + split_content[i].trim()
    if(~ content_bit.toLowerCase().indexOf("better health")){
      var split_split = content_bit.split("\n")
      var tracking_num = split_split[0].trim()
      
      if(!(~ res.indexOf(tracking_num))) res.push(tracking_num)
      /*
      var rx = /<.*?=(9714242.*?)&.*?>/g
      var val = rx.exec(content)
      while(val != null){
        res.push(val[1])
        val = rx.exec(content)
      }*/
    }

  }
  
  return res
}