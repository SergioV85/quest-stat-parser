import {
  applySpec,
  addIndex,
  always,
  anyPass,
  contains,
  curry,
  descend,
  divide,
  drop,
  equals,
  find,
  flip,
  ifElse,
  isEmpty,
  isNil,
  map,
  merge,
  mergeWithKey,
  multiply,
  objOf,
  path,
  pathEq,
  pick,
  pipe,
  prop,
  propOr,
  sort,
  unless,
  zipWith,
} from 'ramda';
import { GameRequest, GameData, GameInfo, LevelData, ParsedGameData } from './../models';
import { getGameInfo, getGameStat, retrieveGameMonitoring } from './webstat-convertor';
import {
  cleanCodesFromNotFullyParsedGame,
  getGameInfo as _getGameInfo,
  getMonitoringByDetails,
  getMonitoringCodes as _getMonitoringCodes,
  getMonitoringStatus,
  getSavedGames as _getSavedGames,
  getTotalGameMonitoring,
  saveGame,
  updateLevels,
} from './database-connection';
import { convertTime, getDiff } from './parsers/time-parser';

const getExistedLevelType = (key, oldLevelValue, newLevelValue) => (key === 'type' ? oldLevelValue : newLevelValue);
const mapIndexed = addIndex(map);
const reduceCodeArray = (idx, codes) =>
  pipe(
    drop(idx + 1),
    map(prop('code'))
  )(codes);

const saveNewGameToDb = async (gameId: number, domain: string, existedLevelsData?: LevelData[]) => {
  const gameData = {
    info: undefined,
    stat: undefined,
  };
  const parsedGameData: ParsedGameData = await getGameInfo(domain, gameId);
  gameData.info = parsedGameData;
  const stat = await getGameStat(domain, gameId, gameData.info);
  const levelsData = unless(() => isNil(existedLevelsData), zipWith(mergeWithKey(getExistedLevelType), existedLevelsData))(stat.levels);
  gameData.stat = merge(stat, { levels: levelsData });
  return saveGame(gameData, existedLevelsData);
};

const mergeMonitoringData = ([totalInputs, correctCodes], propName) => ({
  parsed: true,
  totalData: pipe(
    map(row => {
      const uniqueId = path(['_id', propName], row);
      return pipe(
        find(pathEq(['_id', propName], uniqueId)),
        propOr(0, 'codesCounts'),
        objOf('correctCodesQuantity'),
        merge(row)
      )(correctCodes);
    }),
    map(row => {
      const correctCodesPercent = ifElse(
        pipe(
          prop('codesCounts'),
          anyPass([isNil, isEmpty, equals(0)])
        ),
        always(0),
        pipe(
          propOr(0, 'correctCodesQuantity'),
          flip(divide)(prop('codesCounts', row)),
          multiply(100)
        )
      )(row);
      return merge(row, { correctCodesPercent });
    })
  )(totalInputs),
});

const markDuplicates = codeList =>
  mapIndexed((code, idx) => {
    const isDuplicate = pipe(
      curry(reduceCodeArray)(idx),
      contains(prop('code', code))
    )(codeList);

    return merge(code, { isDuplicate });
  }, codeList);
const calculateTimeDifference = codeList =>
  mapIndexed((code, idx) => {
    const prevCodeTime = pipe(
      prop(idx + 1),
      prop('time'),
      convertTime
    )(codeList);
    const currentCodeTime = convertTime(code.time);
    const timeDiff = isNil(prevCodeTime) ? null : getDiff(currentCodeTime, prevCodeTime);

    return merge(code, { timeDiff });
  }, codeList);

const getMonitoringDataByTeam = (gameId, teamId) =>
  Promise.all([
    getMonitoringByDetails(gameId, teamId, 'teamLevel').then(results => mergeMonitoringData(results, 'level')),
    getMonitoringByDetails(gameId, teamId, 'teamPlayer')
      .then(results => mergeMonitoringData(results, 'userId'))
      .then(
        pipe(
          prop('totalData'),
          sort(descend(prop('correctCodesQuantity')))
        )
      ),
  ]).then(([dataByLevels, dataByUsers]) => ({
    parsed: true,
    dataByLevel: prop('totalData', dataByLevels),
    dataByUser: dataByUsers,
  }));

const getMonitoringDataByPlayer = (gameId, playerId) =>
  getMonitoringByDetails(gameId, playerId, 'playerLevel').then(results => mergeMonitoringData(results, 'level'));

const getCodesByLevel = (GameId, level, teamId) =>
  _getMonitoringCodes({ GameId, teamId, level, type: 'level' }).then(
    pipe(
      markDuplicates,
      calculateTimeDifference
    )
  );

const getCodesByPlayer = (GameId, level, userId) =>
  _getMonitoringCodes({ GameId, userId, level, type: 'player' }).then(
    pipe(
      markDuplicates,
      calculateTimeDifference
    )
  );

export const getSavedGames = () => _getSavedGames();

export const getGameData = async ({ gameId, domain, isForceRefresh }: GameRequest): Promise<GameData> => {
  const data = await _getGameInfo(gameId);
  const hasSavedGame = !isNil(data) && !isEmpty(data);
  if (hasSavedGame && !isForceRefresh) {
    return applySpec({
      info: pick(['GameId', 'FinishTime', 'GameName', 'Domain', 'StartTime', 'Timezone']) as (
        data: unknown
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

export const updateLevelData = ({ gameId, levels }) => updateLevels(gameId, levels);

export const getMonitoringData = ({ gameId, domain }) => {
  return getMonitoringStatus(gameId).then(data => {
    if (!isNil(data)) {
      if (data.parsed) {
        return getTotalGameMonitoring(gameId).then(results => mergeMonitoringData(results, 'teamId'));
      }
      return data;
    }
    return cleanCodesFromNotFullyParsedGame(gameId).then(() => retrieveGameMonitoring(domain, gameId));
  });
};

export const getMonitoringDetails = ({ gameId, teamId, playerId, detailsType }) => {
  switch (detailsType) {
    case 'byPlayer':
      return getMonitoringDataByPlayer(gameId, playerId);
    case 'byTeam':
    default:
      return getMonitoringDataByTeam(gameId, teamId);
  }
};

export const getMonitoringCodes = ({ gameId, levelId, playerId, teamId, detailsType }) => {
  switch (detailsType) {
    case 'byLevel':
      return getCodesByLevel(gameId, levelId, teamId);
    case 'byPlayer':
    default:
      return getCodesByPlayer(gameId, levelId, playerId);
  }
};
