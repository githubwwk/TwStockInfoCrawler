
"use strict"
var request = require('request');
var htmlparser = require('htmlparser2');
var fs = require('fs');
var moment = require('moment');
var wait = require('wait.for');
var cheerio = require('cheerio');
var cheerioTableparser = require('cheerio-tableparser');
var merge = require('merge');
var Semaphore = require("node-semaphore");

var pool = Semaphore(1);

//******************************************
// stock_data_reconstruct()
//******************************************
function stock_data_reconstruct(raw_data_list)
{
    let stock_data_dict = {};

    for (let i=2 ; i < raw_data_list[0].length ; i ++)
    {
       let row_data_list = [];
       let stock_data = {};

       for (let j=0; j<raw_data_list.length ; j++) 
       {
           //console.log(i + '-' + j + ' '+ raw_data_list[j][i]);
           row_data_list.push(raw_data_list[j][i]);
       }    
       //console.dir(row_data_list);

       try {
            stock_data.date = row_data_list[0];
            stock_data.TV = parseInt(row_data_list[1].replace(/,/g, '')); /* Trading Volume ?�交?�數 */
            stock_data.TO =  parseInt(row_data_list[2].replace(/,/g, '')); /* TurnOver in value ?�交?��?	*/
            stock_data.OP = row_data_list[3]; /* Open Price ?�盤??*/
            stock_data.DH = row_data_list[4]; /* Day High ?�高價 */ 
            stock_data.DL = row_data_list[5]; /* Day Low ?�低價 */ 
            stock_data.CP = parseFloat(row_data_list[6]); /* Closing Price ?�盤??*/ 
            stock_data.GS = parseFloat(row_data_list[7]); /* Gross Spread:漲�??�差 */ 
            stock_data.GSP =  (stock_data.GS/(stock_data.CP-stock_data.GS)*100).toFixed(1); /* Gross Spread percentage */ 
            stock_data.NT = row_data_list[8]; /* Number of Transactions ?�交筆數 */
       }catch(err){
            console.log("ERROR get raw data fail!" + err)
       } /* try-catch */
       
       row_data_list = [];
       stock_data_dict[stock_data.date] = stock_data;  /* DATE Key */       
       //console.dir(stock_data);
    } /* for i */
    
    return stock_data_dict;

} /* function - stock_data_reconstruct */

//******************************************
// getDatafromWeb()
//******************************************
function getDatafromWeb(options, callback_web)
{
   let stock_data_dict = {};
   request( options, function (error, response, body) {
        
        if (!error && response.statusCode == 200) {
            //console.log(body)
            let table_html = body.match(/\<table.*\<\/table\>/g);
            
            try {
                let $ = cheerio.load(table_html[0]);
                cheerioTableparser($);
                let data = $("table").parsetable(false, false, true);   
                stock_data_dict = stock_data_reconstruct(data); 
            } catch  (err) {
                console.log("ERROR - Get HTML table error!" + err);              
            }
        }else{
            console.log("ERROR - getDatafromWeb() response!!!" + response);
            console.dir(options);
            return callback_web('getDatafromWeb - Invalid response, please retrys');
        }


        if (Object.keys(stock_data_dict).length == 0)
        {
            console.log("ERROR - getDatafromWeb() body!!!" + body);    
            console.log("ERROR - getDatafromWeb() response!!!" + response);  
            console.dir(options);
        }
        return callback_web(null, stock_data_dict);
    });
}

//******************************************
// calMA()
//******************************************
function calMA(stock_id, posi, date_key_list, data_dict)
{

    let result = {};
    let price_MA60 = 0;
    let price_MA20 = 0;
    let price_MA10 = 0;
    let price_MA5 = 0;
    let check_days = 60

    if (date_key_list.length < (check_days-1))
    {
           /* W/o valid data over 60 */ 
           console.log("ERROR calMA() - StockId:" + stock_id);
           console.log("ERROR calMA() - date_key_list.length:" + date_key_list.length);
           return undefined; 
    }

    for(let i=0 ; i<check_days ; i++)
    {
        try {
            let price = data_dict[date_key_list[posi+i]].CP;
            price_MA60 += price;    

            if (i < 20) {
                price_MA20 += price;
            }
            if (i < 10) {    
                price_MA10 += price;
            }
            if (i < 5) {
                price_MA5 += price;
            }
        } catch (err) {
            console.log("ERROR calMA() - Error:" + err);
            console.log("ERROR calMA() - posi:" + posi + ' i:' + i);
            console.log("ERROR calMA() - StockObj:" + date_key_list[posi+i]);
            console.log("ERROR calMA() - Dict Length:" + date_key_list.length);
            //return result;
        }/* try-catch */
    } /* for */    
    
    result.MA60 = (price_MA60/60).toFixed(2);
    result.MA20 = (price_MA20/20).toFixed(2);
    result.MA10 = (price_MA10/10).toFixed(2);
    result.MA5 = (price_MA5/5).toFixed(2);
    return result;
} /* calMA */

//******************************************
// stockAnalyze()
//******************************************

var TO_TIMES_CONDITION = 1.4;

function stockAnalyze_01(stock_id, data_dict, callback_analyze)
{
    
    var key_list = Object.keys(data_dict);
    key_list.sort();
    key_list.reverse(); /* recently to far date */
    let i=0;
    let keyMoment = false;
    let keyDate = '';

    for (let key of key_list)
    {                 
        try {
                let TOMA_05 = Math.round((data_dict[key_list[i+1]].TO + 
                            data_dict[key_list[i+2]].TO +
                            data_dict[key_list[i+3]].TO + 
                            data_dict[key_list[i+4]].TO +  
                            data_dict[key_list[i+5]].TO)/5);  

                if (data_dict[key_list[i]].TO > TOMA_05)
                {                            
                    let TO_times = (data_dict[key_list[i]].TO / TOMA_05).toFixed(1);     

                    if (TO_times > TO_TIMES_CONDITION)
                    {        
                        let result_MA = calMA(stock_id, i, key_list, data_dict);    
                        if (result_MA == undefined){
                            console.log("ERROR - "); 
                            return callback_analyze(null);
                        }

                        if (data_dict[key_list[i]].CP > result_MA.MA60)
                        {
                            console.log(key);   
                            console.log(data_dict[key].CP);      
                            console.log(data_dict[key].GS);  
                            //console.log(data_dict[key].TV); 
                            //console.log(TOMA_05); 
                            console.log(data_dict[key].GSP + '%'); 
                            console.log(TO_times); 
                            console.log(result_MA);
                            keyMoment = true;
                            keyDate = key;
                            
                        }
                    }/* if */    
                }/* if */
        } catch(err) {
            console.log("ERROR - " + err);               
        }
        i++;
        if (i > 60)
        {
            /* Just analyze  one quarter (60 Days) */ 
            break;               
        }/* if */ 
    }/* for */

    let result = {};
    result.stockInfo = data_dict[keyDate];
    result.keyMoment = keyMoment;

    return callback_analyze(null, result);
}

function check_TO_times(i, data_dict, key_list)
{
    try {
         var TOMA_05 = Math.round((data_dict[key_list[i+1]].TO + 
                                   data_dict[key_list[i+2]].TO +
                                   data_dict[key_list[i+3]].TO + 
                                   data_dict[key_list[i+4]].TO +  
                                   data_dict[key_list[i+5]].TO)/5);  

         //if (data_dict[key_list[i]].TO > TOMA_05)
         {                            
            var TO_times = (data_dict[key_list[i]].TO / TOMA_05).toFixed(1);                  
            var result = {};
            result.TO_times = TO_times;            
            result.TOMA_05 = TOMA_05;
            result.TO = data_dict[key_list[i]].TO;          
            return result;            
         }/* if */
    } catch(err){
          return {};
    }
    return {};
      
}

function stockAnalyze_02(stock_id, data_dict, only_check_today)
{
    
    let key_list = Object.keys(data_dict);
    if(key_list.indexOf("查無資料！") > -1)
    {
       key_list.splice( key_list.indexOf("查無資料！"), 1 );
    }
    key_list.sort();
    key_list.reverse(); /* recently to far date */
    let i=0;
    let stage = 0;  /* 0=init value -1=smaller 1=bigger */
    let keyMoment = false;
    let keyDate = '';

    for (let key of key_list)
    {   
        console.log("DEBUG - stockAnalyze_02() id:" + stock_id);
        let result_MA = calMA(stock_id, i, key_list, data_dict);  
        if (result_MA == undefined){
            /* Invalid data, don't need to analyze */ 
            console.log("ERROR - result is undefined! stockId:" + stock_id);  
            console.log("ERROR - key_list len:" + key_list.length);
            console.dir(result_MA);
            console.dir(data_dict);
            console.dir(key_list);
            keyMoment = false;         
            break;
        }

        data_dict[key].MA = result_MA;            
        var temp_CP = data_dict[key].CP;
        var temp_GS =  data_dict[key].GS;
        if ((temp_CP > result_MA.MA60) && ((temp_CP - temp_GS) < result_MA.MA60)) {                        
             console.log("[Key Date][N->P]:" + key);                   
             console.log("[CP]" + data_dict[key].CP);      
             console.log("[GS]" + data_dict[key].GS); 
             console.log("[GSP]" + data_dict[key].GSP + '%'); 
             console.log(result_MA);         
             let result_times = check_TO_times(i, data_dict, key_list);                   
             console.log("[TO Times]:" + result_times.TO_times);
             keyMoment = true;
             data_dict[key].type = 'N->P';
             keyDate = key;
        }
        else if((temp_CP < result_MA.MA60) && ((temp_CP - temp_GS) > result_MA.MA60))  {                   
             console.log("[Key Date][P->N]:" + key);                                        
             console.log("[CP]" + data_dict[key].CP);      
             console.log("[GS]" + data_dict[key].GS); 
             console.log("[GSP]" + data_dict[key].GSP + '%'); 
             console.log(result_MA);
             let result_times = check_TO_times(i, data_dict, key_list);      
             console.log("[TO Times]:" + result_times.TO_times);             
             keyMoment = true;
             data_dict[key].type = 'P->N';
             keyDate = key;
        }/* if-else */        

        if (only_check_today == true)
        {
            //console.log("[MA60]" + result_MA.MA60 + " [GPP]" + data_dict[key].GSP + " [CP]" + data_dict[key].CP); 
            /* 2017.3.30 Konrad Debug */
            if (key != '106/03/31' && key != '查無資料！')
            {
                 console.log('ERROR - stock_id:' + stock_id);
                 console.log('ERROR - key:' + key);
                 console.dir(key_list);
                 console.dir(data_dict);
                 process.exit(1);
            }
            
            data_dict[key].MA = result_MA;            
            break;
        }

        i++;
        if (i > 60)
        {
            /* Just analyze  one quarter (60 Days) */ 
            break;               
        }/* if */ 
    } /* for */
    
    let result = {};
    result.stockDailyInfo = data_dict[keyDate];
    result.keyMoment = keyMoment;

    return result;
}

//******************************************
// readDataDbFile()
//******************************************
function readDataDbFile(file_name)
{
	console.log('readDataDbFile()+++');
	var content = fs.readFileSync(file_name);
	//console.log(content);
	var db = JSON.parse(content.toString());
	return db;	
}

//******************************************
// writeDataDbFile()
//******************************************
function writeDataDbFile(stockId, data_dict, callback_wrtdb)
{
	var db_dir = './db/';
    if (!fs.existsSync(db_dir)) {
    	fs.mkdirSync(db_dir);
    }

    //for (var i = 0 ; i < data_dict.lenght ; i++)
    for (key in data_dict)
    {		
        var temp_key_list = key.split("/");
        temp_key_list[0] = (parseInt(temp_key_list[0]) + 1911).toString();
        var file_date_tag = temp_key_list.join('/');
	    dbfile = db_dir + 'TwStock_' + stockId + '_'  + moment(new Date(file_date_tag)).format('YYYYMMDD') + '.db';
	    fs.writeFileSync(dbfile, JSON.stringify(data_dict[key]));
	    console.log('Write File DB:' + dbfile);
    }		
    
    return callback_wrtdb(null);
}

function writeCheckResultFile(stockObj)
{
	let db_dir = './result/';
    if (!fs.existsSync(db_dir)) {
    	fs.mkdirSync(db_dir);
    }

    let daily_dir = db_dir + moment(new Date()).format('YYMMDD') + '/';
    if (!fs.existsSync(daily_dir)) {
    	fs.mkdirSync(daily_dir);
    }
    	            
	let dbfile = daily_dir  + '' + stockObj.stockInfo.stockId + '_'  + moment(new Date()).format('MMDD') + '.db';
	fs.writeFileSync(dbfile, JSON.stringify(stockObj));
	console.log('Write File DB:' + dbfile);
    
    return true;
}

//******************************************
// stockDailyChecker()
//******************************************
function stockDailyChecker(stockInfo)
{
    let MONTH = moment().month() + 1;
    let YEAR = moment().year();
    let stockId = stockInfo.stockId;

    let body = {  'download': '',
                'query_year': '0', /* 2017, set by main */
                'query_month' : '0', /* 2, set by main */
                'CO_ID': '0',  /* 2454, set by main */
                'query-button' : '%E6%9F%A5%E8%A9%A2'};

    let options_default = {
        url : 'http://www.twse.com.tw/ch/trading/exchange/STOCK_DAY/STOCK_DAYMAIN.php',
        method: "POST",
        form : body,
        headers: {'Content-Type' : 'application/x-www-form-urlencoded'}

    };

    let data_dict = {};
    /* Get 6 month */
    for(let i=0 ; i<5 ; i++ )
    {
        let data_month_int = parseInt(MONTH) - i;
        let data_year_int = parseInt(YEAR);
        if (data_month_int <= 0){
            data_month_int = data_month_int + 12;
            data_year_int = data_year_int - 1;
        } 
        options_default.form.CO_ID = stockId;
        options_default.form.query_year = data_year_int.toString();            
        options_default.form.query_month = data_month_int.toString();
        console.log("[StockId]" + stockId + "[YEAR]:" + options_default.form.query_year + " [MONTH]:" + options_default.form.query_month + ' [i]:' + i);
        
        let temp_data_dict;
        /*
        pool.acquire(function() {
            try{
                temp_data_dict = wait.for(getDatafromWeb, options_default);      
            } catch(err){
                console.log(err);                       
            }    
            pool.release();
        });
        */
            try{
                temp_data_dict = wait.for(getDatafromWeb, options_default);     
                console.log("stockDailyChecker()@-1 [dick Len]:" + Object.keys(data_dict).length + ' [temp len]:' + Object.keys(temp_data_dict).length + ' [SotckId]:' + stockId + ' [i]:' + i);     
                data_dict = merge(data_dict, temp_data_dict);            
                console.log("stockDailyChecker()@-2 [dick Len]:" + Object.keys(data_dict).length + ' [temp len]:' + Object.keys(temp_data_dict).length + ' [SotckId]:' + stockId + ' [i]:' + i);  
            } catch(err){
                console.log(err);                       
            }

        /* Merge Data Dict */

   
    }
    //let result_check = wait.for(stockAnalyze_02, stockId, data_dict, true); /* Only check today */   
    let result_check = stockAnalyze_02(stockId, data_dict, true);

    if (result_check.keyMoment == true)
    {
        result_check.stockInfo = stockInfo;
        console.dir(result_check);
        writeCheckResultFile(result_check);
    }

}/* stockDailyChecker() - END */

//******************************************
// main()
//******************************************

function main()
{     

    var stocks = readDataDbFile('./cfg/TwStockList_20170328.db');
    //var stocks = readDataDbFile('./cfg/TwStockList_test.db');

    //function exec(stockInfo, callback_fiber)
    function exec(callback_fiber)
    {                  
         
         //let stockId = '3665';
         
         for (let i=0 ; i< stocks['stock_list'].length ; i++)
         {
              let stockInfo = stocks['stock_list'][i];
              console.log("[StockId]:" + stockInfo.stockId); 
              let stockId = stocks['stock_list'][i].stockId;
             stockDailyChecker(stockInfo);         
         }    

         return callback_fiber(null);
    }   

    //for (let i=0 ; i< stocks['stock_list'].length ; i++)
    //{
    //    let stockInfo = stocks['stock_list'][i];
    //    let stockId = stocks['stock_list'][i].stockId;
        //wait.launchFiber(exec, stockInfo, function(){});
        wait.launchFiber(exec, function(){});
        
   // }    
}

main();