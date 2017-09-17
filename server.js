const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const R = require('ramda');
const gameManagement = require('./modules/game-management');

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
  methods: ['GET', 'POST', 'PUT'],
  optionsSuccessStatus: 200,
  preflightContinue: true,
  credentials: true
};

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.options('*', cors(corsOptions));
app.get('/games', cors(corsOptions), (req, res) => {
  gameManagement.getSavedGames()
    .then((games) => {
      res.send(games);
    })
    .catch((error) => {
      res.status(500).send(error);
    });
});
app.post('/games/', cors(corsOptions), (req, res) => {
  const gameId = R.path(['body', 'id'], req);
  const domain = R.path(['body', 'domain'], req);
  const isForceRefresh = R.pathOr(false, ['body', 'force'], req);

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
