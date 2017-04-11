
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
var db = require('./db.js');

let g_RESULT_DIR = './result/';

//******************************************
// readDataDbFile()
//******************************************
function readDataDbFile(file_name)
{
    try {
	    var content = fs.readFileSync(file_name);
	    var db = JSON.parse(content.toString());        
	    return db;	
    }catch(err){        
        throw err;
    }
}

//******************************************
// writeDataDbFile()
//******************************************
function writeDataDbFile(stockId, year, month, dataObj)
{
	let db_dir = './db/';
    if (!fs.existsSync(db_dir)) {
    	fs.mkdirSync(db_dir);
    }

    let stock_db_dir = db_dir + stockId + '/';
    if (!fs.existsSync(stock_db_dir)) {
    	fs.mkdirSync(stock_db_dir);
    }

	var dbfile = stock_db_dir + '/'  + year + '_' + month + '.db';
	fs.writeFileSync(dbfile, JSON.stringify(dataObj));
	console.log('Write File DB:' + dbfile);		
    
    return 0;
}

function writeCheckResultFile(stockObj)
{
	let db_dir = './result/';
    if (!fs.existsSync(db_dir)) {
    	fs.mkdirSync(db_dir);
    }
    
    let stock_result_dir = stockObj.stockDailyInfo.date.replace(/\//g, '-');
    let daily_dir = db_dir + stock_result_dir + '/';
    if (!fs.existsSync(daily_dir)) {
    	fs.mkdirSync(daily_dir);
    }
    	            
	let dbfile = daily_dir  + '' + stockObj.stockInfo.stockId + '.db';
	fs.writeFileSync(dbfile, JSON.stringify(stockObj));
	console.log('Write File DB:' + dbfile);
    
    return true;
}

//******************************************
// Write Result to DB server
//******************************************
function changeTwDateToDcDate(twDate)
{
   let temp_date_list = twDate.split('-');
   let year = parseInt(temp_date_list[0]);
   temp_date_list[0] = (year+1911).toString();

   return temp_date_list.join('-');
}

function writeResultToDBServer(dateStr, date_folder, dbCheckExist)
{
    var result_list = []; 
    var resultDbObj = {};
    let result_db_list = fs.readdirSync(date_folder); 
        
    for (let result_db of result_db_list)
    {
        //console.log("Dir:" + result_db);
        let file_path = date_folder + '/' + result_db;
        let result = readDataDbFile(file_path);
        result_list.push(result);          
    } 
   
    let db_date_key = changeTwDateToDcDate(dateStr);    
    resultDbObj.date = db_date_key;
    resultDbObj.data = JSON.stringify(result_list);          
    //db.stockDailyA02_IsExist(db_date_key, resultDbObj);    
    dbCheckExist(db_date_key, resultDbObj);    
}

//******************************************
// Stock A0X Write DB API
//******************************************
function writeResult(typeName)
{
    
    let analyze_type_result_folder = g_RESULT_DIR + typeName;
    let result_db_folder_list = fs.readdirSync(analyze_type_result_folder); 
        
    for (let result_date_folder of result_db_folder_list)
    {
        //console.log("Dir:" + result_date_folder);
        let date_data_dir = analyze_type_result_folder + '/' + result_date_folder;
        let db_IsExit = eval('db.stockDaily' + typeName + '_IsExist;');
        //let db_IsExit = db.stockDailyA01_IsExist;
        var dateStr = result_date_folder;
        writeResultToDBServer(dateStr, date_data_dir, db_IsExit);
    } 
    return 0;
}

//******************************************
// main()
//******************************************

function main()
{         
    function exec(callback_fiber)
    {                  
        writeResult('A01');
        writeResult('A02');
        
        return callback_fiber(null);
    }   

    wait.launchFiber(exec, function(){});
   
}

main();
