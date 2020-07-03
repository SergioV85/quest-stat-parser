import { MongoClient } from 'mongodb';
import { pipe, map, prop, flatten, groupBy, values, transpose, mergeAll, mergeRight, concat, pluck } from 'ramda';
import { all } from 'bluebird';
import { parseISO } from 'date-fns';

import {
  AggregatedGameData,
  CodeEntry,
  CodesListRequest,
  CodesRequestToDbType,
  GameData,
  GameInfo,
  GamePayload,
  GroupedTeamData,
  LevelData,
  MongoRequest,
  MonitoringStatus,
  MonitoringTeamGroupedData,
  PlayerLevelData,
  TeamData,
  UnaryOperator,
} from './../../../models';

const uri = `mongodb://${process.env.MONGO_ATLAS_User as string}:${
  process.env.MONGO_ATLAS_Password as string
}@quest-stat-shard-00-00-ky7li.mongodb.net:27017,quest-stat-shard-00-01-ky7li.mongodb.net:27017,quest-stat-shard-00-02-ky7li.mongodb.net:27017/quest?ssl=true&replicaSet=Quest-Stat-shard-0&authSource=admin`;

const groupStatByRow = (stat: GroupedTeamData[], fieldName: keyof TeamData): TeamData[][] =>
  pipe(
    pluck('data') as UnaryOperator<GroupedTeamData[], TeamData[][]>,
    flatten,
    groupBy(prop(fieldName) as UnaryOperator<TeamData, string>) as UnaryOperator<
      TeamData[],
      { [index: number]: TeamData[] }
    >,
    values,
    transpose,
  )(stat);

/* MongoDB requests */
const saveDocumentToCollection = (GameId: number, collectionName: string, document: unknown): Promise<void> =>
  MongoClient.connect(uri).then((db) =>
    db
      .db('quest')
      .collection(collectionName)
      .replaceOne({ GameId }, document, { upsert: true })
      .then(() => {
        void db.close();
      }),
  );

const getDocumentFromCollection = <T>(collectionName: string, GameId: number): Promise<T> =>
  MongoClient.connect(uri).then((db) =>
    db
      .db('quest')
      .collection(collectionName)
      .findOne({ GameId })
      .then((document: T) => {
        void db.close();
        return document;
      }),
  );

const getAggregatedMonitoring = <T>(aggregationConfig: MongoRequest[]): Promise<T[]> =>
  MongoClient.connect(uri).then((db) =>
    db
      .db('quest')
      .collection('Monitoring')
      .aggregate(aggregationConfig)
      .toArray()
      .then((stats: T[]) => {
        void db.close();
        return stats;
      }),
  );

const getCodesList = (query: Partial<CodesListRequest>): Promise<CodeEntry[]> =>
  MongoClient.connect(uri).then((db) =>
    db
      .db('quest')
      .collection('Monitoring')
      .find(query)
      .toArray()
      .then((codes: CodeEntry[]) => {
        void db.close();
        return codes;
      }),
  );

export const getSavedGamesFromDb = async (): Promise<GameInfo[]> => {
  const db = await MongoClient.connect(uri);
  const games: GameInfo[] = (await db.db('quest').collection('Info').find().toArray()) as GameInfo[];
  void db.close();
  return games;
};

export const getGameInfo = async (GameId: number): Promise<AggregatedGameData> => {
  const data: [
    { GameId: number; FinishTime: string; GameName: string; Domain: string; StartTime: string; Timezone: string },
    { Levels: LevelData[] },
    { DataByLevels: TeamData[][]; DataByTeam: GroupedTeamData[]; FinishResults: TeamData[] },
  ] = await all([
    getDocumentFromCollection<GameInfo>('Info', GameId),
    getDocumentFromCollection<Pick<GameData['stat'], 'Levels'>>('Levels', GameId),
    getDocumentFromCollection<Omit<GameData['stat'], 'Levels'>>('Stats', GameId),
  ]);
  return mergeAll(data);
};

export const getMonitoringStatus = async (GameId: number): Promise<{ parsed: boolean }> => {
  const db = await MongoClient.connect(uri);
  const document = (await db.db('quest').collection('MonitoringStatus').findOne({ GameId })) as { parsed: boolean };
  void db.close();
  return document;
};

export const saveGame = ({ info, stat }: GamePayload): Promise<[void, void, void]> => {
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

export const updateLevels = (GameId: number, levelData: LevelData[]): Promise<void> => {
  const levels = {
    _id: GameId,
    GameId,
    Levels: levelData,
  };
  return saveDocumentToCollection(GameId, 'Levels', levels);
};

export const setMonitoringStatus = async (GameId: number, status: Partial<MonitoringStatus>): Promise<void> => {
  const doc = mergeRight(status, {
    _id: GameId,
    GameId,
  });
  const db = await MongoClient.connect(uri);
  await db.db('quest').collection('MonitoringStatus').updateOne({ GameId }, { $set: doc }, { upsert: true });
  void db.close();
};

export const saveMonitoringData = async (GameId: number, entries: CodeEntry[]): Promise<void> => {
  const monitoringEntries = map(mergeRight({ GameId }), entries);

  const db = await MongoClient.connect(uri);
  await db.db('quest').collection('Monitoring').insertMany(monitoringEntries);
  void db.close();
};

export const getTotalGameMonitoring = (GameId: number): Promise<[MonitoringTeamGroupedData[], PlayerLevelData[]]> => {
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
  return all([
    getAggregatedMonitoring<MonitoringTeamGroupedData>(totalCodesRequest),
    getAggregatedMonitoring<PlayerLevelData>(correctCodesRequest),
  ]);
};

export const getMonitoringByDetails = <T>(
  GameId: number,
  uniqueId: number,
  groupingType: CodesRequestToDbType,
): Promise<[T[], T[]]> => {
  let totalMatchSettings: { [key: string]: number; GameId: number };
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
  return all([getAggregatedMonitoring(totalCodesRequest), getAggregatedMonitoring(correctCodesRequest)]) as Promise<
    [T[], T[]]
  >;
};

export const getMonitoringCodesFromDb = ({
  GameId,
  teamId,
  userId,
  level,
  type,
}: CodesListRequest): Promise<CodeEntry[]> => {
  const query = type === 'level' ? { GameId, teamId, level } : { GameId, userId, level };
  return getCodesList(query);
};

export const cleanCodesFromNotFullyParsedGame = async (GameId: number): Promise<void> => {
  const db = await MongoClient.connect(uri);
  await db.db('quest').collection('Monitoring').deleteMany({ GameId });
  void db.close();
};
