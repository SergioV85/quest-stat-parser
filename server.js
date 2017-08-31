const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();
const R = require('ramda');
const htmlParser = require('./modules/html-parser.js');
const dbConnection = require('./modules/database-connection.js');

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

// app.use(allowCrossDomain);
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

  dbConnection.getGameInfoFromDatabase(gameId)
    .then((results) => {
      if (R.isNil(results) || R.isEmpty(results)) {
        return htmlParser.getGameInfo(domain, gameId)
          .then((parsedGameData) => dbConnection.saveGameInfoToDatabase(parsedGameData));
      }
      return R.head(results);
    })
    .then((data) => {
      gameData.info = data;
      return dbConnection.getLevelFromDatabase(gameId);
    })
    .then((levels) => {
      if (R.isNil(levels) || R.isEmpty(levels)) {
        return htmlParser.getGameStat(domain, gameId, gameData.info)
          .then((gameStat) => dbConnection.saveGameDataToDatabase(gameData.info, gameStat));
      }
      return levels;
    })
    .then((stat) => {
      gameData.stat = stat;
      res.send(gameData);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});

app.listen(process.env.PORT || 4040);
