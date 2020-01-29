
//use this for issuesweep and tagforarchive, they need to wait.
//for autolog, just check if locked, if so, return
function custom_lock(func_name){
  console.log("trying to run lock for:" + func_name)
  
  var cache = CacheService.getDocumentCache();
  var locked = cache.get("lock");
  var count = 0
  if(locked){ //then wait
    while(locked){ //check every now and then
      Utilities.sleep(10000) //wait ten seconds
      locked = cache.get("lock") //try again
    }
    if(count > 30){ //then bad
      debugEmail("LOCK IS RUNNING TOO MANY TIMES", "no body")
    }
  }
  //you only get out of this when someone else has removed the lock from cache, then you quickly put it in
  cache.put("lock", true, 1200) //either way, put your lock in then do your work. It'll expire in 30 minutes, so that means if the script dies, it dies
  cache.put("function_name",func_name,1200)
}

//use this to 'unlock' by removing the cache lock
function custom_unlock(func_name){
  //func_name = 'auto_log' //if you need to manually unlock, add the function name here
  console.log("trying to unlock for:" + func_name)
  
  var cache = CacheService.getDocumentCache();
  cache.remove("lock") //then lyft your lock on the spreadsheet
  cache.remove("function_name")
}



function is_locked(){
  Logger.log(CacheService.getDocumentCache().get("lock") ? "YES" : "NO")
  Logger.log(CacheService.getDocumentCache().get("function_name"))

}


