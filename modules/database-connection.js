
const R = require('ramda');
const Promise = require('bluebird');
const moment = require('moment');
const MongoClient = require('mongodb').MongoClient;

const uri = `mongodb://${process.env.MONGO_ATLAS_User}:${process.env.MONGO_ATLAS_Password}@quest-stat-shard-00-00-ky7li.mongodb.net:27017,quest-stat-shard-00-01-ky7li.mongodb.net:27017,quest-stat-shard-00-02-ky7li.mongodb.net:27017/quest?ssl=true&replicaSet=Quest-Stat-shard-0&authSource=admin`;


const groupStatByRow = (stat, fieldName) => R.pipe(
  R.map(R.prop('data')),
  R.flatten,
  R.groupBy((level) => level[fieldName]),
  R.values,
  R.transpose
)(stat);

/* MongoDB requests */
const saveDocumentToCollection = (GameId, collectionName, document) => MongoClient
  .connect(uri)
  .then((db) => db
    .db('quest')
    .collection(collectionName)
    .replaceOne({ GameId }, document, { upsert: true })
    .then(() => {
      db.close();
    })
  );

const getDocumentFromCollection = (collectionName, GameId) => MongoClient
  .connect(uri)
  .then((db) => db
    .db('quest')
    .collection(collectionName)
    .findOne({ GameId })
    .then((document) => {
      db.close();
      return document;
    })
  );

const getAggregatedMonitoring = (aggregationConfig) => MongoClient.connect(uri)
  .then((db) => db
    .db('quest')
    .collection('Monitoring')
    .aggregate(aggregationConfig)
    .toArray()
    .then((stats) => {
      db.close();
      return stats;
    })
  );

const getCodesList = (query) => MongoClient.connect(uri)
.then((db) => db
  .db('quest')
  .collection('Monitoring')
  .find(query)
  .toArray()
  .then((codes) => {
    db.close();
    return codes;
  })
);

exports.getSavedGames = () => MongoClient
  .connect(uri)
  .then((db) => db
    .db('quest')
    .collection('Info')
    .find()
    .toArray()
    .then((games) => {
      db.close();
      return games;
    })
  );

exports.getGameInfo = (GameId) => Promise.all(
  [
    getDocumentFromCollection('Info', GameId),
    getDocumentFromCollection('Levels', GameId),
    getDocumentFromCollection('Stats', GameId)
  ])
  .then((data) => R.mergeAll(data));

exports.getMonitoringStatus = (GameId) => MongoClient
  .connect(uri)
  .then((db) => db
    .db('quest')
    .collection('MonitoringStatus')
    .findOne({ GameId })
    .then((document) => {
      db.close();
      return document;
    })
  );

exports.saveGame = ({ info, stat }) => {
  const GameId = parseInt(info.id, 10);
  const gameInfo = {
    _id: GameId,
    GameId,
    GameName: info.name,
    Domain: info.domain,
    StartTime: moment(info.start).toDate(),
    FinishTime: moment(info.finish).toDate(),
    Timezone: info.timezone,
  };
  const levels = {
    _id: GameId,
    GameId,
    Levels: stat.levels
  };
  const gameStat = {
    _id: GameId,
    GameId,
    FinishResults: stat.finishResults,
    DataByLevels: groupStatByRow(stat.dataByLevels, 'levelIdx'),
    DataByTeam: stat.dataByTeam
  };

  return Promise.all([
    saveDocumentToCollection(GameId, 'Info', gameInfo),
    saveDocumentToCollection(GameId, 'Levels', levels),
    saveDocumentToCollection(GameId, 'Stats', gameStat)
  ]);
};

exports.updateLevels = (gameId, levelData) => {
  const GameId = parseInt(gameId, 10);
  const levels = {
    _id: GameId,
    GameId,
    Levels: levelData
  };
  return saveDocumentToCollection(GameId, 'Levels', levels);
};

exports.setMonitoringStatus = (gameId, status) => {
  const GameId = parseInt(gameId, 10);
  const doc = {
    _id: GameId,
    GameId,
    ...status
  };
  return MongoClient.connect(uri)
    .then((db) => db
      .db('quest')
      .collection('MonitoringStatus')
      .updateOne({ GameId }, { $set: doc }, { upsert: true })
      .then(() => {
        db.close();
      })
    );
};

exports.saveMonitoringData = (gameId, entries) => {
  const GameId = parseInt(gameId, 10);
  const monitoringEntries = R.map(
    R.merge({ GameId }),
    entries
  );

  return MongoClient.connect(uri)
    .then((db) => db
      .db('quest')
      .collection('Monitoring')
      .insertMany(monitoringEntries)
      .then(() => {
        db.close();
      })
    );
};

exports.getTotalGameMonitoring = (gameId) => {
  const GameId = parseInt(gameId, 10);

  const aggregationSettings = [
    {
      $group: {
        _id: {
          teamId: '$teamId',
          teamName: '$teamName',
        },
        uniqueCodes: {
          $addToSet: '$code'
        }
      }
    },
    {
      $project: {
        codesCounts: {
          $size: '$uniqueCodes'
        }
      }
    },
  ];

  const totalCodesRequest = [
    { $match: { GameId } },
    ...aggregationSettings
  ];
  const correctCodesRequest = [
    {
      $match: {
        $and: [
          { GameId: { $eq: GameId } },
          { isSuccess: true },
          { isTimeout: false },
          { isRemovedLevel: false }
        ]
      }
    },
    ...aggregationSettings
  ];

  return Promise.all([
    getAggregatedMonitoring(totalCodesRequest),
    getAggregatedMonitoring(correctCodesRequest)
  ]);
};

exports.getMonitoringByDetails = (GameId, uniqueId, groupingType) => {
  let totalMatchSettings;
  let correctMatchSettings;
  let groupSettings;
  let sortSettings;
  switch (groupingType) {
    case 'playerLevel':
      totalMatchSettings = { GameId, userId: uniqueId };
      correctMatchSettings = { userId: { $eq: uniqueId } };
      groupSettings = {
        level: '$level',
        userId: '$userId',
      };
      sortSettings = { '_id.level': 1 };
      break;
    case 'teamPlayer':
      totalMatchSettings = { GameId, teamId: uniqueId };
      correctMatchSettings = { teamId: { $eq: uniqueId } };
      groupSettings = {
        userName: '$userName',
        userId: '$userId'
      };
      sortSettings = { codesCounts: -1 };
      break;
    case 'teamLevel':
    default:
      totalMatchSettings = { GameId, teamId: uniqueId };
      correctMatchSettings = { teamId: { $eq: uniqueId } };
      groupSettings = {
        level: '$level',
        teamId: '$teamId',
      };
      sortSettings = { '_id.level': 1 };
      break;
  }

  const aggregationSettings = [
    {
      $group: {
        _id: groupSettings,
        uniqueCodes: {
          $addToSet: '$code'
        }
      }
    },
    {
      $project: {
        codesCounts: {
          $size: '$uniqueCodes'
        }
      }
    },
    {
      $sort: sortSettings
    }
  ];

  const totalCodesRequest = [
    { $match: totalMatchSettings },
    ...aggregationSettings
  ];
  const correctCodesRequest = [
    {
      $match: {
        $and: [
          { GameId: { $eq: GameId } },
          correctMatchSettings,
          { isSuccess: true },
          { isTimeout: false },
          { isRemovedLevel: false }
        ]
      }
    },
    ...aggregationSettings
  ];
  return Promise.all([
    getAggregatedMonitoring(totalCodesRequest),
    getAggregatedMonitoring(correctCodesRequest)
  ]);
};

exports.getMonitoringCodes = ({ GameId, teamId, userId, level, type }) => {
  const query = type === 'level' ? { GameId, teamId, level } : { GameId, userId, level };
  return getCodesList(query);
};
