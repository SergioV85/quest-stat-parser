const express = require('express');
const request = require('request');
const htmlParser = require('./modules/html-parser.js');

const app = express();

const allowCrossDomain = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if (req.method === 'OPTIONS') {
    res.send(200);
  } else {
    next();
  }
};

app.configure(() => {
  app.use(allowCrossDomain);
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.get('/games/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  request(`http://quest.ua/GameStat.aspx?gid=${gameId}`, (error, response, body) => {
    const parsedHtml = htmlParser.parseHtml(body);
    res.send(parsedHtml);
  });
});

app.listen(process.env.PORT || 4040);
