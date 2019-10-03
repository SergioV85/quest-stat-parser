import { pipe, map, prop, flatten, groupBy, values, transpose, mergeAll, merge, concat } from 'ramda';
import { all } from 'bluebird';
import moment from 'moment';
import { MongoClient } from 'mongodb';
import { GameInfo, LevelData, GroupedTeamData, TeamData } from '../models';

const uri = `mongodb://${process.env.MONGO_ATLAS_User}:${process.env.MONGO_ATLAS_Password}@quest-stat-shard-00-00-ky7li.mongodb.net:27017,quest-stat-shard-00-01-ky7li.mongodb.net:27017,quest-stat-shard-00-02-ky7li.mongodb.net:27017/quest?ssl=true&replicaSet=Quest-Stat-shard-0&authSource=admin`;

const groupStatByRow = (stat, fieldName) =>
  pipe(
    map(prop('data')),
    flatten,
    groupBy(level => level[fieldName]),
    values,
    transpose
  )(stat);

/* MongoDB requests */
const saveDocumentToCollection = (GameId, collectionName, document) =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection(collectionName)
      .replaceOne({ GameId }, document, { upsert: true })
      .then(() => {
        db.close();
      })
  );

const getDocumentFromCollection = (collectionName: string, GameId: number) =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection(collectionName)
      .findOne({ GameId })
      .then(document => {
        db.close();
        return document;
      })
  );

const getAggregatedMonitoring = aggregationConfig =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection('Monitoring')
      .aggregate(aggregationConfig)
      .toArray()
      .then(stats => {
        db.close();
        return stats;
      })
  );

const getCodesList = query =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection('Monitoring')
      .find(query)
      .toArray()
      .then(codes => {
        db.close();
        return codes;
      })
  );

export const getSavedGames = async (): Promise<GameInfo[]> => {
  const db = await MongoClient.connect(uri);
  const games: GameInfo[] = await db
    .db('quest')
    .collection('Info')
    .find()
    .toArray();
  db.close();
  return games;
};

export const getGameInfo = async (GameId: number) => {
  const data: [
    { GameId: number; FinishTime: string; GameName: string; Domain: string; StartTime: string; Timezone: string },
    { Levels: LevelData[] },
    { DataByLevels: TeamData[][]; DataByTeam: GroupedTeamData[]; FinishResults: TeamData[] }
  ] = await all([
    getDocumentFromCollection('Info', GameId),
    getDocumentFromCollection('Levels', GameId),
    getDocumentFromCollection('Stats', GameId),
  ]);
  return mergeAll(data);
};

export const getMonitoringStatus = async GameId => {
  const db = await MongoClient.connect(uri);
  const document = await db
    .db('quest')
    .collection('MonitoringStatus')
    .findOne({ GameId });
  db.close();
  return document;
};

export const saveGame = ({ info, stat }) => {
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
    Levels: stat.levels,
  };
  const gameStat = {
    _id: GameId,
    GameId,
    FinishResults: stat.finishResults,
    DataByLevels: groupStatByRow(stat.dataByLevels, 'levelIdx'),
    DataByTeam: stat.dataByTeam,
  };

  return all([
    saveDocumentToCollection(GameId, 'Info', gameInfo),
    saveDocumentToCollection(GameId, 'Levels', levels),
    saveDocumentToCollection(GameId, 'Stats', gameStat),
  ]);
};

export const updateLevels = (gameId, levelData) => {
  const GameId = parseInt(gameId, 10);
  const levels = {
    _id: GameId,
    GameId,
    Levels: levelData,
  };
  return saveDocumentToCollection(GameId, 'Levels', levels);
};

export const setMonitoringStatus = async (gameId, status) => {
  const GameId = parseInt(gameId, 10);
  const doc = merge(status, {
    _id: GameId,
    GameId,
  });
  const db = await MongoClient.connect(uri);
  await db
    .db('quest')
    .collection('MonitoringStatus')
    .updateOne({ GameId }, { $set: doc }, { upsert: true });
  db.close();
};

export const saveMonitoringData = async (gameId, entries) => {
  const GameId = parseInt(gameId, 10);
  const monitoringEntries = map(merge({ GameId }), entries);

  const db = await MongoClient.connect(uri);
  await db
    .db('quest')
    .collection('Monitoring')
    .insertMany(monitoringEntries);
  db.close();
};

export const getTotalGameMonitoring = gameId => {
  const GameId = parseInt(gameId, 10);

  const aggregationSettings = [
    {
      $group: {
        _id: {
          teamId: '$teamId',
          teamName: '$teamName',
        },
        uniqueCodes: {
          $addToSet: '$code',
        },
      },
    },
    {
      $project: {
        codesCounts: {
          $size: '$uniqueCodes',
        },
      },
    },
  ];

  const totalCodesRequest = concat([{ $match: { GameId } }], aggregationSettings);
  const correctCodesRequest = concat(
    [
      {
        $match: {
          $and: [{ GameId: { $eq: GameId } }, { isSuccess: true }, { isTimeout: false }, { isRemovedLevel: false }],
        },
      },
    ],
    aggregationSettings
  );
  return all([getAggregatedMonitoring(totalCodesRequest), getAggregatedMonitoring(correctCodesRequest)]);
};

export const getMonitoringByDetails = (GameId, uniqueId, groupingType) => {
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
        userId: '$userId',
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
          $addToSet: '$code',
        },
      },
    },
    {
      $project: {
        codesCounts: {
          $size: '$uniqueCodes',
        },
      },
    },
    {
      $sort: sortSettings,
    },
  ];

  const totalCodesRequest = concat([{ $match: totalMatchSettings }], aggregationSettings);

  const correctCodesRequest = concat(
    [
      {
        $match: {
          $and: [
            { GameId: { $eq: GameId } },
            correctMatchSettings,
            { isSuccess: true },
            { isTimeout: false },
            { isRemovedLevel: false },
          ],
        },
      },
    ],
    aggregationSettings
  );
  return all([getAggregatedMonitoring(totalCodesRequest), getAggregatedMonitoring(correctCodesRequest)]);
};

export const getMonitoringCodes = ({ GameId, teamId, userId, level, type }) => {
  const query = type === 'level' ? { GameId, teamId, level } : { GameId, userId, level };
  return getCodesList(query);
};

export const cleanCodesFromNotFullyParsedGame = async GameId => {
  const db = await MongoClient.connect(uri);
  await db
    .db('quest')
    .collection('Monitoring')
    .deleteMany({ GameId });
  db.close();
};
