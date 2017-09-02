const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const R = require('ramda');
const htmlParser = require('./modules/html-parser.js');
const dbConnection = require('./modules/database-connection.js');

const app = express();
const allowedUrls = [new RegExp('quest-stat'), new RegExp('localhost')];

const corsOptions = {
  origin: (origin, callback) => {
    if (R.any((allowedUrl) => R.test(allowedUrl, origin))(allowedUrls)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200,
  preflightContinue: true,
  credentials: true
};

// app.use(allowCrossDomain);
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.options('*', cors(corsOptions));
app.post('/games/', cors(corsOptions), (req, res) => {
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
