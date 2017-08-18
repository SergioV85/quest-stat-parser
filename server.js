const express = require('express');
const request = require('request');
const htmlParser = require('./modules/html-parser.js');

const app = express();

app.get('/games/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  request(`http://quest.ua/GameStat.aspx?gid=${gameId}`, (error, response, body) => {
    const parsedHtml = htmlParser.parseHtml(body);
    res.send(parsedHtml);
  });
});

app.listen(process.env.PORT || 4040);
