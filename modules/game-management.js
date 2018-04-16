const R = require('ramda');
const webstatConvertor = require('./webstat-convertor.js');
const dbConnection = require('./database-connection.js');
const timeParser = require('./parsers/time-parser');

const getExistedLevelType = (key, oldLevelValue, newLevelValue) => (key === 'type' ? oldLevelValue : newLevelValue);
const mapIndexed = R.addIndex(R.map);
const reduceCodeArray = (idx, codes) => R.pipe(
  R.drop(idx + 1),
  R.map(R.prop('code'))
)(codes);

const saveNewGameToDb = (gameId, domain, existedLevelsData) => {
  const gameData = {
    info: undefined,
    stat: undefined
  };
  return webstatConvertor.getGameInfo(domain, gameId)
    .then((parsedGameData) => {
      gameData.info = parsedGameData;
      return webstatConvertor.getGameStat(domain, gameId, gameData.info);
    })
    .then((stat) => {
      const levelsData = R.unless(
        () => R.isNil(existedLevelsData),
        R.zipWith(R.mergeWithKey(getExistedLevelType), existedLevelsData)
      )(stat.levels);

      gameData.stat = R.merge(stat, { levels: levelsData });

      return dbConnection.saveGame(gameData, existedLevelsData);
    });
};

const mergeMonitoringData = ([totalInputs, correctCodes], propName) => ({
  parsed: true,
  totalData: R.pipe(
    R.map((row) => {
      const uniqueId = R.path(['_id', propName], row);
      return R.pipe(
        R.find(R.pathEq(['_id', propName], uniqueId)),
        R.propOr(0, 'codesCounts'),
        R.objOf('correctCodesQuantity'),
        R.merge(row)
      )(correctCodes);
    }),
    R.map((row) => {
      const correctCodesPercent = R.ifElse(
        R.pipe(
          R.prop('codesCounts'),
          R.anyPass([
            R.isNil,
            R.isEmpty,
            R.equals(0)
          ])
        ),
        R.always(0),
        R.pipe(
          R.propOr(0, 'correctCodesQuantity'),
          R.flip(R.divide)(
            R.prop('codesCounts', row)
          ),
          R.multiply(100)
        )
      )(row);
      return R.merge(row, { correctCodesPercent });
    })
  )(totalInputs)
});

const markDuplicates = (codeList) =>
  mapIndexed((code, idx) => {
    const isDuplicate = R.pipe(
      R.curry(reduceCodeArray)(idx),
      R.contains(R.prop('code', code))
    )(codeList);

    return R.merge(code, { isDuplicate });
  }, codeList);
const calculateTimeDiffernce = (codeList) =>
  mapIndexed((code, idx) => {
    const prevCodeTime = R.pipe(
      R.prop(idx + 1),
      R.prop('time'),
      timeParser.convertTime
    )(codeList);
    const currentCodeTime = timeParser.convertTime(code.time);
    const timeDiff = R.isNil(prevCodeTime) ? null : timeParser.getDiff(currentCodeTime, prevCodeTime);

    return R.merge(code, { timeDiff });
  }, codeList);

const getMonitoringDataByTeam = (gameId, teamId) => Promise.all([
  dbConnection.getMonitoringByDetails(gameId, teamId, 'teamLevel')
    .then((results) => mergeMonitoringData(results, 'level')),
  dbConnection.getMonitoringByDetails(gameId, teamId, 'teamPlayer')
    .then((results) => mergeMonitoringData(results, 'userId'))
    .then(R.pipe(
      R.prop('totalData'),
      R.sort(
        R.descend(
          R.prop('correctCodesQuantity')
        )
      )
    ))
])
.then(([dataByLevels, dataByUsers]) => ({
  parsed: true,
  dataByLevel: R.prop('totalData', dataByLevels),
  dataByUser: dataByUsers,
}));

const getMonitoringDataByPlayer = (gameId, playerId) =>
  dbConnection.getMonitoringByDetails(gameId, playerId, 'playerLevel')
  .then((results) => mergeMonitoringData(results, 'level'));

const getCodesByLevel = (GameId, level, teamId) =>
  dbConnection.getMonitoringCodes({ GameId, teamId, level, type: 'level' })
    .then(R.pipe(
      markDuplicates,
      calculateTimeDiffernce
    ));

const getCodesByPlayer = (GameId, level, userId) =>
  dbConnection.getMonitoringCodes({ GameId, userId, level, type: 'player' })
    .then(R.pipe(
      markDuplicates,
      calculateTimeDiffernce
    ));

exports.getSavedGames = () => dbConnection.getSavedGames();

exports.getGameData = ({ gameId, domain, isForceRefresh }) => dbConnection.getGameInfo(gameId)
  .then((data) => {
    const hasSavedGame = !R.isNil(data) && !R.isEmpty(data);

    if (hasSavedGame && !isForceRefresh) {
      return data;
    }
    const existedLevelData = isForceRefresh && hasSavedGame
      ? data.Levels
      : null;

    return saveNewGameToDb(gameId, domain, existedLevelData)
      .then(() => dbConnection.getGameInfo(gameId));
  })
  .then((data) => ({
    info: R.pick(['GameId', 'FinishTime', 'GameName', 'Domain', 'StartTime', 'Timezone'], data),
    stat: R.pick(['DataByLevels', 'DataByTeam', 'FinishResults', 'Levels'], data)
  }));

exports.updateLevelData = ({ gameId, levels }) => dbConnection.updateLevels(gameId, levels);

exports.getMonitoringData = ({ gameId, domain }) => dbConnection.getMonitoringStatus(gameId)
  .then((data) => {
    if (!R.isNil(data)) {
      if (data.parsed) {
        return dbConnection.getTotalGameMonitoring(gameId)
          .then((results) => mergeMonitoringData(results, 'teamId'));
      }
      return data;
    }
    return webstatConvertor.retrieveGameMonitoring(domain, gameId);
  });

exports.getMonitoringDetails = (({ gameId, teamId, playerId, detailsType }) => {
  switch (detailsType) {
    case 'byPlayer':
      return getMonitoringDataByPlayer(gameId, playerId);
    case 'byTeam':
    default:
      return getMonitoringDataByTeam(gameId, teamId);
  }
});

exports.getMonitoringCodes = (({ gameId, levelId, playerId, teamId, detailsType }) => {
  switch (detailsType) {
    case 'byLevel':
      return getCodesByLevel(gameId, levelId, teamId);
    case 'byPlayer':
    default:
      return getCodesByPlayer(gameId, levelId, playerId);
  }
});
