const R = require('ramda');
const webstatConvertor = require('./webstat-convertor.js');
const dbConnection = require('./database-connection.js');
const fileConnection = require('./file-connection.js');
const monitoringAnalyser = require('./parsers/monitoring-analyser.js');

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
      gameData.stat = stat;
      return dbConnection.saveGame(gameData, existedLevelsData);
    });
};

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
    stat: R.pick(['DataByLevels', 'DataByLevelsRow', 'DataByTeam', 'FinishResults', 'Levels'], data)
  }));

exports.updateLevelData = ({ gameId, levels }) => dbConnection.updateLevelsInDatabase(gameId, levels);

exports.getMonitoringData = ({ gameId, domain }) => dbConnection.checkMonitoringLogExistence(gameId)
  .then((data) => {
    if (!R.isNil(data)) {
      if (data.Saved && !data.Parsed) {
        return fileConnection.parseSavedLogs(gameId)
          .then((jsonLog) => monitoringAnalyser.calculateTotalMonitoringData(jsonLog));
      }
      return data;
    }
    return webstatConvertor.retrieveGameMonitoring(domain, gameId);
  });
