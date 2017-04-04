var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/kStock');

var Schema = mongoose.Schema;

var stockSchema = new Schema({
  date: String,
  data: String  
});
  
var STOCK_DAILY_INFO = mongoose.model('stockSchema', stockSchema);

exports.stockDailyInfoSave = function(dataObj)
{
 
    var newStockDailyInfo = STOCK_DAILY_INFO(dataObj);
    
    newStockDailyInfo.save(function(err){
        console.log('STOCK_DAILY_INFO Created Done');        
    });     
};

exports.stockDailyInfoIsExist = function(checkDate, saveDataObj)
{
   console.log("stockDailyInfoIsExist() Date:" + checkDate);
   STOCK_DAILY_INFO.find({date : checkDate}, function (err, dataObj) {
        if (dataObj.length){
            console.log('Stock Infor already Exist:',null);
        }else{
            var newStockDailyInfo = STOCK_DAILY_INFO(saveDataObj);
            newStockDailyInfo.save(function(err){
                console.log('STOCK_DAILY_INFO Created Done'); 
            });
        }
    });
};