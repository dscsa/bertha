//POTENTIALLY CURRENTLY DEPRACATED
function clearBlanks(){
  var sh = SpreadsheetApp.openById(BERTHA_ID).getSheetByName("Reports Sheet")
  var data = sh.getDataRange().getValues()
  var targetData = new Array();
  for(n=0;n<data.length;++n){
    if((data[n].join().replace(/,/g,'')!='') && (data[n][0].toString() != "#VALUE!")){
      targetData.push(data[n])
    };
    Logger.log(data[n].join().replace(/,/g,''))
  }
  sh.getRange("A3:D").clear();
  sh.getRange(1,1,targetData.length,targetData[0].length).setValues(targetData);
}

function create_reports() {

  var ss = SpreadsheetApp.openById(BERTHA_ID)
  var data_val_sheet = ss.getSheetByName("Data Validation")
  var data_val_data = data_val_sheet.getDataRange().getValues()
  var report_sheet = ss.getSheetByName("Reports Sheet")
  if(report_sheet.getLastRow() >= 3){
    report_sheet.deleteRows(3,report_sheet.getLastRow()-2)
  }
  var report_num = report_sheet.getRange("B1").getValue().toString().trim()
  var index = -1
  for(var i = 0; i < data_val_data[0].length; i++){
    var tmp_str = data_val_data[0][i].toString().trim()
    if(tmp_str.indexOf("#REPORT") > -1){
      if(tmp_str.split(":")[0].split(" ")[1] == report_num){
        index = i
      }
    }
  }
  
  if(index > -1){
    var num_formulas = 0
    for(var i = 1; i < data_val_data.length; i++){
      if(data_val_data[i][index].toString().trim().length > 0){
        num_formulas += 1
      } else {
        break
      }
    }
    var titles = []
    var formulas = []
    var is_array_formula = []
    for(var i = 0; i < num_formulas; i++){
      var formula_cell = data_val_data[i+1][index].split(";")
      var column_title = formula_cell[0]
      var formula = formula_cell[1]
      titles.push(column_title)
      formulas.push("=" + formula)
      is_array_formula.push(formula.indexOf("ARRAYFORMULA")>-1)
    }
    Logger.log(titles)
    Logger.log(formulas)
    report_sheet.appendRow(titles)
    report_sheet.appendRow(formulas)
    Utilities.sleep(5000) //pause for it to fill in arrays
    clearBlanks()
    
    
  }
  
  
}
