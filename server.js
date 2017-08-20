const express = require('express');
const request = require('request-promise');
const bodyParser = require('body-parser');
const R = require('ramda');
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

app.use(allowCrossDomain);
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.post('/games/', (req, res) => {
  const gameId = R.path(['body', 'id'], req);
  const domain = R.path(['body', 'domain'], req);

  if (R.isNil(gameId) || R.isNil(domain)) {
    res.status(400).send('Bad Request');
  }

  const gameData = {
    info: null,
    stat: null
  };

  request(`http://${domain}/GameDetails.aspx?gid=${gameId}`)
    .then((data) => {
      gameData.info = htmlParser.parseGameInfo(data);
      return request(`http://${domain}/GameStat.aspx?gid=${gameId}`);
    })
    .then((stat) => {
      gameData.stat = htmlParser.parseGameStat(stat);
      res.send(gameData);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.listen(process.env.PORT || 4040);
