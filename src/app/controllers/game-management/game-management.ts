import {
  always,
  anyPass,
  applySpec,
  descend,
  drop,
  equals,
  find,
  ifElse,
  includes,
  isEmpty,
  isNil,
  map,
  mergeRight,
  mergeWithKey,
  multiply,
  nth,
  objOf,
  path,
  pathEq,
  pick,
  pipe,
  pluck,
  prop,
  propOr,
  sort,
  zipWith,
  mapObjIndexed,
  values,
} from 'ramda';
import {
  CodeEntry,
  CodesRequestToDbType,
  DetailedMonitoringRequest,
  GameData,
  GameInfo,
  GamePayload,
  GameRequest,
  LevelData,
  MonitoringResponse,
  MonitoringTeamDetailedData,
  MonitoringTeamGroupedData,
  ParsedGameData,
  ParsedGameStat,
  PlayerGroupedData,
  PlayerLevelData,
  UnaryOperator,
  MonitoringLevelData,
  AggregatedMonitoringData,
} from './../../../models';
import { getDiff, parseTime } from './../../parsers';
import {
  cleanCodesFromNotFullyParsedGame,
  getGameInfo as _getGameInfo,
  getMonitoringByDetails,
  getMonitoringCodesFromDb,
  getMonitoringStatus,
  getSavedGamesFromDb,
  getTotalGameMonitoring,
  saveGame,
  updateLevels,
} from './../database-connection/database-connection';
import { getGameInfo, getGameStat, retrieveGameMonitoring } from './../webstat-convertor/webstat-convertor';

const getExistedLevelType = (key: string, oldLevelValue: number, newLevelValue: number) =>
  key === 'type' ? oldLevelValue : newLevelValue;

const indexedMap = (func: (val: CodeEntry, key: string, obj?: unknown) => CodeEntry, list: CodeEntry[]): CodeEntry[] =>
  pipe(
    (mapObjIndexed(func) as unknown) as UnaryOperator<CodeEntry[], { [key: string]: CodeEntry }>,
    values as UnaryOperator<{ [key: string]: CodeEntry }, CodeEntry[]>,
  )(list);

const reduceCodeArray: (idx: number) => (codes: CodeEntry[]) => string[] = (idx: number) =>
  pipe(drop(idx + 1), pluck('code') as (data: CodeEntry[]) => string[]);

const saveNewGameToDb = async (gameId: number, domain: string, existedLevelsData?: LevelData[] | null) => {
  const parsedGameData: ParsedGameData = await getGameInfo(domain, gameId);
  const stat: ParsedGameStat = await getGameStat(domain, gameId, parsedGameData);
  const levelsData: LevelData[] = isNil(existedLevelsData)
    ? stat.levels
    : (zipWith(mergeWithKey(getExistedLevelType), existedLevelsData)(stat.levels) as LevelData[]);
  const gameData: GamePayload = {
    info: parsedGameData,
    stat: mergeRight(stat, { levels: levelsData }) as ParsedGameStat,
  };
  return saveGame(gameData);
};

const mergeMonitoringData = (
  [totalInputs, correctCodes]: [AggregatedMonitoringData[], AggregatedMonitoringData[]],
  propName: string,
): Partial<MonitoringResponse> => ({
  parsed: true,
  totalData: pipe(
    map(
      (row: AggregatedMonitoringData): AggregatedMonitoringData => {
        const uniqueId: string = path(['_id', propName], row) as string;
        return pipe(
          find(pathEq(['_id', propName], uniqueId)),
          propOr(0, 'codesCounts'),
          objOf('correctCodesQuantity'),
          mergeRight(row),
        )(correctCodes) as AggregatedMonitoringData;
      },
    ),
    map(
      (row: AggregatedMonitoringData): AggregatedMonitoringData => {
        const correctCodesPercent = ifElse(
          pipe(
            prop('codesCounts') as UnaryOperator<MonitoringTeamGroupedData | PlayerLevelData, null | number>,
            anyPass([isNil, isEmpty, equals(0)]) as UnaryOperator<null | number, boolean>,
          ) as UnaryOperator<MonitoringTeamGroupedData | PlayerLevelData, boolean>,
          always(0),
          pipe(
            propOr(0, 'correctCodesQuantity') as UnaryOperator<MonitoringTeamGroupedData | PlayerLevelData, number>,
            (correctCodesQuantity: number): number => correctCodesQuantity / prop('codesCounts', row),
            multiply(100) as UnaryOperator<number, number>,
          ) as UnaryOperator<MonitoringTeamGroupedData | PlayerLevelData, number>,
        )(row) as number;
        return mergeRight(row, { correctCodesPercent }) as MonitoringTeamGroupedData | PlayerLevelData;
      },
    ),
  )(totalInputs),
});

const markDuplicates = (codeList: CodeEntry[]): CodeEntry[] =>
  indexedMap((code: CodeEntry, idx: string): CodeEntry => {
    const isDuplicate: boolean = pipe(
      (list: CodeEntry[]): string[] => reduceCodeArray(+idx)(list),
      includes(prop('code', code)) as (data: string[]) => boolean,
    )(codeList);

    return mergeRight(code, { isDuplicate }) as CodeEntry;
  }, codeList);

const calculateTimeDifference = (codeList: CodeEntry[]): CodeEntry[] =>
  indexedMap((code: CodeEntry, idx: string): CodeEntry => {
    const prevCodeTime = pipe(nth(+idx + 1), prop('time') as UnaryOperator<CodeEntry, string>, parseTime)(codeList);
    const currentCodeTime = parseTime(code.time);
    const timeDiff = isNil(prevCodeTime) ? null : getDiff(currentCodeTime, prevCodeTime);

    return mergeRight(code, { timeDiff }) as CodeEntry;
  }, codeList);

const getMonitoringDataByTeam = (gameId: number, teamId: number): Promise<MonitoringTeamDetailedData> =>
  Promise.all([
    getMonitoringByDetails<MonitoringLevelData>(gameId, teamId, CodesRequestToDbType.LEVEL).then((results) =>
      mergeMonitoringData(results, 'level'),
    ),
    getMonitoringByDetails<PlayerGroupedData>(gameId, teamId, CodesRequestToDbType.TEAM)
      .then((results) => mergeMonitoringData(results, 'userId'))
      .then(
        pipe(
          prop('totalData') as UnaryOperator<MonitoringResponse, AggregatedMonitoringData[]>,
          sort(descend(prop('correctCodesQuantity'))),
        ),
      ),
  ]).then(
    ([dataByLevels, dataByUsers]) =>
      ({
        parsed: true,
        dataByLevel: prop('totalData', dataByLevels),
        dataByUser: dataByUsers,
      } as MonitoringTeamDetailedData),
  );

const getMonitoringDataByPlayer = (gameId: number, playerId: number) =>
  getMonitoringByDetails<PlayerLevelData>(gameId, playerId, CodesRequestToDbType.PLAYER).then((results) =>
    mergeMonitoringData(results, 'level'),
  );

const getCodesByLevel = (GameId: number, level: number, teamId: number) =>
  getMonitoringCodesFromDb({ GameId, teamId, level, type: 'level' }).then(
    pipe(markDuplicates, calculateTimeDifference),
  );

const getCodesByPlayer = (GameId: number, level: number, userId: number) =>
  getMonitoringCodesFromDb({ GameId, userId, level, type: 'player' }).then(
    pipe(markDuplicates, calculateTimeDifference),
  );

export const getSavedGames = (): Promise<GameInfo[]> => getSavedGamesFromDb();

export const getGameData = async ({ gameId, domain, isForceRefresh }: GameRequest): Promise<GameData> => {
  const data = await _getGameInfo(gameId);
  const hasSavedGame = !isNil(data) && !isEmpty(data);
  if (hasSavedGame && !isForceRefresh) {
    return applySpec({
      info: pick(['GameId', 'FinishTime', 'GameName', 'Domain', 'StartTime', 'Timezone']) as (
        data: unknown,
      ) => GameInfo,
      stat: pick(['DataByLevels', 'DataByTeam', 'FinishResults', 'Levels']),
    })(data) as GameData;
  }
  const existedLevelData = isForceRefresh && hasSavedGame ? data.Levels : null;
  await saveNewGameToDb(gameId, domain, existedLevelData);
  const createdGameInfo = await _getGameInfo(gameId);
  return applySpec({
    info: pick(['GameId', 'FinishTime', 'GameName', 'Domain', 'StartTime', 'Timezone']) as (data: unknown) => GameInfo,
    stat: pick(['DataByLevels', 'DataByTeam', 'FinishResults', 'Levels']),
  })(createdGameInfo) as GameData;
};

export const updateLevelData = ({ gameId, levels }: { gameId: number; levels: LevelData[] }): Promise<void> =>
  updateLevels(gameId, levels);

export const getMonitoringData = async ({
  gameId,
  domain,
}: GameRequest): Promise<
  | {
      parsed: boolean;
    }
  | Partial<MonitoringResponse>
  | {
      parsed: boolean;
      totalPages: number;
      parsedPages: number;
    }
> => {
  const data = await getMonitoringStatus(gameId);
  if (!isNil(data)) {
    if (data.parsed) {
      return getTotalGameMonitoring(gameId).then((results) => mergeMonitoringData(results, 'teamId'));
    }
    return data;
  }
  await cleanCodesFromNotFullyParsedGame(gameId);
  return retrieveGameMonitoring(domain, gameId);
};

export const getMonitoringDetails = ({
  gameId,
  teamId,
  playerId,
  detailsType,
}: DetailedMonitoringRequest): Promise<Partial<MonitoringResponse>> | Promise<MonitoringTeamDetailedData> | null => {
  if (detailsType === 'byPlayer' && playerId) {
    return getMonitoringDataByPlayer(gameId, playerId);
  }
  if (teamId) {
    return getMonitoringDataByTeam(gameId, teamId);
  }
  return null;
};

export const getMonitoringCodes = ({
  gameId,
  levelId,
  playerId,
  teamId,
  detailsType,
}: DetailedMonitoringRequest): null | Promise<CodeEntry[]> => {
  if (!levelId) {
    return null;
  }
  if (detailsType === 'byLevel' && teamId) {
    return getCodesByLevel(gameId, levelId, teamId);
  }
  if (playerId) {
    return getCodesByPlayer(gameId, levelId, playerId);
  }
  return null;
};
