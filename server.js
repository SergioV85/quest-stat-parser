const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const R = require('ramda');
// TODO: Remove next line after configuring unit tests
// const webstatConvertor = require('./modules/webstat-convertor.js');
const gameManagement = require('./modules/game-management');

const app = express();
const allowedUrls = [new RegExp('quest-stat', 'g'), new RegExp('localhost', 'g')];

const corsOptions = {
  origin: (origin, callback) => {
    if (R.any((allowedUrl) => R.test(allowedUrl, origin))(allowedUrls)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT'],
  optionsSuccessStatus: 200,
  preflightContinue: true,
  credentials: true
};

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.options('*', cors(corsOptions));
// TODO: Remove next route after configuring unit tests
/*
  app.get('/rawGames/:gameId', (req, res) => {
    const gameId = R.path(['params', 'gameId'], req);
    const domain = 'quest.ua';
    webstatConvertor.getGameInfo(domain, gameId)
      .then((data) => {
        res.send(data);
      });
  });
*/
app.get('/games', cors(corsOptions), (req, res) => {
  gameManagement.getSavedGames()
    .then((games) => {
      res.send(games);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});
app.get('/game', cors(corsOptions), (req, res) => {
  const gameId = R.path(['query', 'id'], req);
  const domain = R.path(['query', 'domain'], req);
  const isForceRefresh = R.pathOr(false, ['query', 'force'], req);

  if (R.isNil(gameId) || R.isNil(domain)) {
    res.status(400).send('Bad Request');
  }
  gameManagement.getGameData({ gameId, domain, isForceRefresh })
    .then((gameData) => {
      res.send(gameData);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});
app.get('/game/nosql', cors(corsOptions), (req, res) => {
  const gameId = R.path(['query', 'id'], req);
  const domain = R.path(['query', 'domain'], req);
  const isForceRefresh = R.pathOr(false, ['query', 'force'], req);

  if (R.isNil(gameId) || R.isNil(domain)) {
    res.status(400).send('Bad Request');
  }
  gameManagement.getGameDataNoSql({ gameId, domain, isForceRefresh })
    .then((gameData) => {
      res.send(gameData);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});
app.put('/games/:gameId/update-levels', cors(corsOptions), (req, res) => {
  const gameId = R.path(['params', 'gameId'], req);
  const levels = R.path(['body'], req);

  gameManagement.updateLevelData({ gameId, levels })
    .then((updateLevelStat) => {
      res.status(200).send(updateLevelStat);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});
app.listen(process.env.PORT || 4040);

module.exports.handler = serverless(app);
