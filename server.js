const express = require('express');
const request = require('request');
const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const app = express();
let data;

request('http://quest.ua/GameStat.aspx?gid=58829', (error, response, body) => {
    const $ = cheerio.load(body);
    cheerioTableparser($);
    data = $(".DataTable").parsetable(true, true, true);
});
 
app.post('/', (req, res) => {
  res.send(req);
});
 
app.listen(4040);