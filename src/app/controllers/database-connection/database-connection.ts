import { MongoClient } from 'mongodb';
import { pipe, map, prop, flatten, groupBy, values, transpose, mergeAll, mergeRight, concat, pluck } from 'ramda';
import { all } from 'bluebird';
import { parseISO } from 'date-fns';

import {
  CodeEntry,
  CodesListRequest,
  CodesRequestToDbType,
  GameInfo,
  GamePayload,
  GroupedTeamData,
  LevelData,
  MongoRequest,
  TeamData,
  MonitoringStatus,
} from './../../../models';

const uri = `mongodb://${process.env.MONGO_ATLAS_User}:${process.env.MONGO_ATLAS_Password}@quest-stat-shard-00-00-ky7li.mongodb.net:27017,quest-stat-shard-00-01-ky7li.mongodb.net:27017,quest-stat-shard-00-02-ky7li.mongodb.net:27017/quest?ssl=true&replicaSet=Quest-Stat-shard-0&authSource=admin`;

const groupStatByRow = (stat: GroupedTeamData[], fieldName: keyof TeamData) =>
  pipe(
    pluck('data') as (data: GroupedTeamData[]) => TeamData[][],
    flatten,
    // tslint:disable-next-line: no-any
    groupBy(prop(fieldName) as any) as (data: TeamData[]) => { [index: number]: TeamData[] },
    values,
    transpose,
  )(stat);

/* MongoDB requests */
// tslint:disable-next-line: no-any
const saveDocumentToCollection = (GameId: number, collectionName: string, document: any) =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection(collectionName)
      .replaceOne({ GameId }, document, { upsert: true })
      .then(() => {
        db.close();
      }),
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
      }),
  );

const getAggregatedMonitoring = (aggregationConfig: MongoRequest[]) =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection('Monitoring')
      .aggregate(aggregationConfig)
      .toArray()
      .then(stats => {
        db.close();
        return stats;
      }),
  );

const getCodesList = (query: Partial<CodesListRequest>): Promise<CodeEntry[]> =>
  MongoClient.connect(uri).then(db =>
    db
      .db('quest')
      .collection('Monitoring')
      .find(query)
      .toArray()
      .then(codes => {
        db.close();
        return codes;
      }),
  );

export const getSavedGamesFromDb = async (): Promise<GameInfo[]> => {
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
    { DataByLevels: TeamData[][]; DataByTeam: GroupedTeamData[]; FinishResults: TeamData[] },
  ] = await all([
    getDocumentFromCollection('Info', GameId),
    getDocumentFromCollection('Levels', GameId),
    getDocumentFromCollection('Stats', GameId),
  ]);
  return mergeAll(data);
};

export const getMonitoringStatus = async (GameId: number) => {
  const db = await MongoClient.connect(uri);
  const document = await db
    .db('quest')
    .collection('MonitoringStatus')
    .findOne({ GameId });
  db.close();
  return document;
};

export const saveGame = ({ info, stat }: GamePayload) => {
  const GameId = info.id;
  const gameInfo = {
    _id: GameId,
    GameId,
    GameName: info.name,
    Domain: info.domain,
    StartTime: parseISO(info.start),
    FinishTime: parseISO(info.finish),
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

export const updateLevels = (GameId: number, levelData: LevelData[]) => {
  const levels = {
    _id: GameId,
    GameId,
    Levels: levelData,
  };
  return saveDocumentToCollection(GameId, 'Levels', levels);
};

export const setMonitoringStatus = async (GameId: number, status: Partial<MonitoringStatus>) => {
  const doc = mergeRight(status, {
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

export const saveMonitoringData = async (GameId: number, entries: CodeEntry[]) => {
  const monitoringEntries = map(mergeRight({ GameId }), entries);

  const db = await MongoClient.connect(uri);
  await db
    .db('quest')
    .collection('Monitoring')
    .insertMany(monitoringEntries);
  db.close();
};

export const getTotalGameMonitoring = (GameId: number) => {
  const aggregationSettings: MongoRequest[] = [
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

  const totalCodesRequest: MongoRequest[] = concat([{ $match: { GameId } }], aggregationSettings);
  const correctCodesRequest: MongoRequest[] = concat(
    [
      {
        $match: {
          $and: [{ GameId: { $eq: GameId } }, { isSuccess: true }, { isTimeout: false }, { isRemovedLevel: false }],
        },
      },
    ],
    aggregationSettings,
  );
  return all([getAggregatedMonitoring(totalCodesRequest), getAggregatedMonitoring(correctCodesRequest)]);
};

export const getMonitoringByDetails = (GameId: number, uniqueId: number, groupingType: CodesRequestToDbType) => {
  let totalMatchSettings: { GameId: number; [key: string]: number };
  let correctMatchSettings: { [key: string]: { $eq: number } };
  let groupSettings: { [key: string]: string };
  let sortSettings: { [key: string]: number };
  switch (groupingType) {
    case CodesRequestToDbType.PLAYER:
      totalMatchSettings = { GameId, userId: uniqueId };
      correctMatchSettings = { userId: { $eq: uniqueId } };
      groupSettings = {
        level: '$level',
        userId: '$userId',
      };
      sortSettings = { '_id.level': 1 };
      break;
    case CodesRequestToDbType.TEAM:
      totalMatchSettings = { GameId, teamId: uniqueId };
      correctMatchSettings = { teamId: { $eq: uniqueId } };
      groupSettings = {
        userName: '$userName',
        userId: '$userId',
      };
      sortSettings = { codesCounts: -1 };
      break;
    case CodesRequestToDbType.LEVEL:
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

  const aggregationSettings: MongoRequest[] = [
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

  const totalCodesRequest: MongoRequest[] = concat([{ $match: totalMatchSettings }], aggregationSettings);

  const correctCodesRequest: MongoRequest[] = concat(
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
    aggregationSettings,
  );
  return all([getAggregatedMonitoring(totalCodesRequest), getAggregatedMonitoring(correctCodesRequest)]);
};

export const getMonitoringCodesFromDb = ({ GameId, teamId, userId, level, type }: CodesListRequest) => {
  const query = type === 'level' ? { GameId, teamId, level } : { GameId, userId, level };
  return getCodesList(query);
};

export const cleanCodesFromNotFullyParsedGame = async (GameId: number) => {
  const db = await MongoClient.connect(uri);
  await db
    .db('quest')
    .collection('Monitoring')
    .deleteMany({ GameId });
  db.close();
};
