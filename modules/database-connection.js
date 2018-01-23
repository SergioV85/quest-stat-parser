
const R = require('ramda');
const Promise = require('bluebird');
const pgp = require('pg-promise')({
  promiseLib: Promise,
  capSQL: true
});
const AWS = require('aws-sdk');

AWS.config.update({
  region: 'eu-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1'
  },
  endpoint: 'https://dynamodb.eu-central-1.amazonaws.com'
});
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();

const db = pgp(`${process.env.AMAZON_DB_URL}?ssl=true`);

const dbRequest = (preparedRequest) => db.manyOrNone(preparedRequest);

const groupStatByRow = (stat, fieldName) => R.pipe(
  R.map(R.prop('data')),
  R.flatten,
  R.groupBy((level) => level[fieldName]),
  R.values,
  R.transpose
)(stat);

const getLevelsFromDatabase = (gameId) => {
  const levelRequest = ['id', 'name', 'level', 'position', 'type', 'removed'];

  return dbRequest({
    name: 'get-levels',
    text: `SELECT ${levelRequest} FROM quest.levels WHERE game_id = $1 ORDER BY position`,
    values: [gameId]
  });
};

exports.getAllSavedGames = () => dbRequest({
  name: 'get-games',
  text: 'SELECT id, domain, name, start, timezone FROM quest.games ORDER BY start DESC'
});

exports.updateLevelsInDatabase = (gameId, levels) => {
  const cs = new pgp.helpers.ColumnSet(
    ['?id', 'name', 'type'], {
      table: {
        table: 'levels',
        schema: 'quest'
      }
    });

  const query = `${pgp.helpers.update(levels, cs)} WHERE v.id = t.id`;
  return db.none(query)
    .then(() => getLevelsFromDatabase(gameId));
};

exports.getGameFromDb = (gameId) => {
  const gameData = {
    TableName: 'quest-stat-games',
    Key: {
      game: gameId
    }
  };

  return new Promise((resolve) => {
    dynamoDbClient.get(gameData, (err, data) => {
      if (err) {
        resolve(null);
      }
      resolve(data);
    });
  });
};

exports.saveGameToDb = ({ info, stat }) => {
  const fullStat = {
    levels: stat.levels,
    finishResults: stat.finishResults,
    dataByLevels: stat.dataByLevels,
    dataByLevelsRow: groupStatByRow(stat.dataByLevels, 'levelIdx'),
    dataByTeam: stat.dataByTeam
  };

  const gameData = {
    TableName: 'quest-stat-games',
    Item: {
      game: info.id,
      name: info.name,
      domain: info.domain,
      start: info.start,
      finish: info.finish,
      timezone: info.timezone,
      ...fullStat
    }
  };

  return new Promise((resolve, reject) => {
    dynamoDbClient.put(gameData, (err) => {
      if (err) {
        reject(err);
      }
      resolve({ info, stat: fullStat });
    });
  });
};
