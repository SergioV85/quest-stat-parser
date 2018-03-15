
const R = require('ramda');
const Promise = require('bluebird');
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

const groupStatByRow = (stat, fieldName) => R.pipe(
  R.map(R.prop('data')),
  R.flatten,
  R.groupBy((level) => level[fieldName]),
  R.values,
  R.transpose
)(stat);

const keepLevelType = (newLevel, oldLevel) => R.set(R.lensProp('type'), oldLevel.type, newLevel);

const deleteGameFromDb = (gameId) => {
  const GameId = parseInt(gameId, 10);

  const requestParams = {
    RequestItems: {
      GameInfo: [{
        DeleteRequest: {
          Key: { GameId }
        }
      }],
      Levels: [{
        DeleteRequest: {
          Key: { GameId }
        }
      }],
      FinishResults: [{
        DeleteRequest: {
          Key: { GameId }
        }
      }],
      StatByLevel: [{
        DeleteRequest: {
          Key: { GameId }
        }
      }],
      StatByTeam: [{
        DeleteRequest: {
          Key: { GameId }
        }
      }],
    }
  };

  return new Promise((resolve) => {
    dynamoDbClient.batchWrite(requestParams, (err, data) => {
      if (err) {
        resolve(null);
      }
      resolve(data);
    });
  });
};

const getGameFromDb = (gameId) => {
  const GameId = parseInt(gameId, 10);

  const requestParams = {
    RequestItems: {
      GameInfo: {
        Keys: [
          { GameId }
        ]
      },
      Levels: {
        Keys: [
          { GameId }
        ]
      },
      FinishResults: {
        Keys: [
          { GameId }
        ]
      },
      StatByLevel: {
        Keys: [
          { GameId }
        ]
      },
      StatByTeam: {
        Keys: [
          { GameId }
        ]
      }
    }
  };

  return new Promise((resolve) => {
    dynamoDbClient.batchGet(requestParams, (err, data) => {
      if (err) {
        resolve(null);
      }
      resolve(data);
    });
  });
};

const getAllGamesFromDb = () =>
  new Promise((resolve) => {
    dynamoDbClient.scan({
      TableName: 'GameInfo'
    }, (err, data) => {
      if (err) {
        resolve(null);
      }
      resolve(data);
    });
  });

exports.getAllSavedGames = () =>
  getAllGamesFromDb().then((result) => R.pipe(
    R.prop('Items'),
    R.sort(R.descend(R.prop('StartTime')))
  )(result));

exports.updateLevelsInDatabase = (gameId, levels) => {
  const GameId = parseInt(gameId, 10);

  const updateParams = {
    TableName: 'Levels',
    Key: {
      GameId
    },
    UpdateExpression: 'set Levels = :l',
    ExpressionAttributeValues: {
      ':l': levels
    },
    ReturnValues: 'UPDATED_NEW'
  };

  return new Promise((resolve, reject) => {
    dynamoDbClient.update(updateParams, (err) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  });
};

exports.getGameFromDb = (gameId) =>
  getGameFromDb(gameId)
    .then(({ Responses }) => R.pipe(
        R.values,
        R.flatten,
        R.mergeAll
      )(Responses))
    .then((data) => {
      const hasGameData = !R.isNil(data) && !R.isEmpty(data);
      if (hasGameData) {
        const DataByLevelsRow = groupStatByRow(data.DataByLevels, 'levelIdx');
        return {
          data: {
            ...data,
            DataByLevelsRow
          }
        };
      }
      return { data };
    });

exports.saveGameToDb = ({ info, stat }, existedLevelData) => {
  const GameId = parseInt(info.id, 10);

  const fullItems = {
    GameInfo: [{
      PutRequest: {
        Item: {
          GameId,
          GameName: info.name,
          Domain: info.domain,
          StartTime: info.start,
          FinishTime: info.finish,
          Timezone: info.timezone,
        }
      }
    }],
    Levels: [{
      PutRequest: {
        Item: {
          GameId,
          Levels: stat.levels
        }
      }
    }],
    FinishResults: [{
      PutRequest: {
        Item: {
          GameId,
          FinishResults: stat.finishResults
        }
      }
    }],
    StatByLevel: [{
      PutRequest: {
        Item: {
          GameId,
          DataByLevels: stat.dataByLevels
        }
      }
    }],
    StatByTeam: [{
      PutRequest: {
        Item: {
          GameId,
          DataByTeam: stat.dataByTeam
        }
      }
    }]
  };

  const RequestItems = R.isNil(existedLevelData)
  ? fullItems
  : R.set(
      R.lensPath(['Levels', 0, 'PutRequest', 'Item', 'Levels']),
      R.zipWith(keepLevelType, stat.levels, existedLevelData),
      fullItems
    );

  const requestParams = { RequestItems };

  return new Promise((resolve, reject) => {
    dynamoDbClient.batchWrite(requestParams, (err) => {
      if (err) {
        deleteGameFromDb(info.id);
        reject(err);
      }
      resolve();
    });
  });
};
