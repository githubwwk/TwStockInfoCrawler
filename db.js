var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/kStock');

var Schema = mongoose.Schema;

var stockSchema = new Schema({
  date: String,
  data: String  
});
  
var STOCK_DAILY_A02_INFO = mongoose.model('stockDaily_A02', stockSchema);
var STOCK_DAILY_A01_INFO = mongoose.model('stockDaily_A01', stockSchema);

exports.stockDailyInfoSave = function(dataObj)
{
 
    var newStockDailyInfo = STOCK_DAILY_A02_INFO(dataObj);
    
    newStockDailyInfo.save(function(err){
        console.log('STOCK_DAILY_A02_INFO Created Done');        
    });     
};

exports.stockDailyA02_IsExist = function(checkDate, saveDataObj)
{
   console.log("stockDailyA02_IsExist() Date:" + checkDate);
   STOCK_DAILY_A02_INFO.find({date : checkDate}, function (err, dataObj) {
        if (dataObj.length){
            console.log('stockDailyA02_IsExist already Exist:'+ checkDate);
        }else{
            var newStockDailyInfo = STOCK_DAILY_A02_INFO(saveDataObj);
            newStockDailyInfo.save(function(err){
                console.log('STOCK_DAILY_A02_INFO Created Done'); 
            });
        }
    });
};

exports.stockDailyA01_IsExist = function(checkDate, saveDataObj)
{
   console.log("stockDailyA01_IsExist() Date:" + checkDate);
   STOCK_DAILY_A01_INFO.find({date : checkDate}, function (err, dataObj) {
        if (dataObj.length){
            console.log('stockDailyA01_IsExist() already Exist:' + checkDate);
        }else{
            var newStockDailyInfo = STOCK_DAILY_A01_INFO(saveDataObj);
            newStockDailyInfo.save(function(err){
                console.log('STOCK_DAILY_A01_INFO Created Done'); 
            });
        }
    });
};