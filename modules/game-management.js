const R = require('ramda');
const webstatConvertor = require('./webstat-convertor.js');
const dbConnection = require('./database-connection.js');

exports.getGameData = ({ gameId, domain }) => {
  const gameData = {
    info: null,
    stat: null
  };
  return dbConnection.getGameInfoFromDatabase(gameId)
    .then((results) => {
      if (R.isNil(results) || R.isEmpty(results)) {
        return webstatConvertor.getGameInfo(domain, gameId)
          .then((parsedGameData) => dbConnection.saveGameInfoToDatabase(parsedGameData));
      }
      return R.head(results);
    })
    .then((data) => {
      gameData.info = data;
      return dbConnection.getFullStatFromDatabase(gameId);
    })
    .then((stat) => {
      if (R.isNil(stat) || R.isEmpty(stat)) {
        return webstatConvertor.getGameStat(domain, gameId, gameData.info)
          .then((gameStat) => dbConnection.saveGameDataToDatabase(gameData.info, gameStat))
          .then(() => dbConnection.getFullStatFromDatabase(gameId));
      }
      return stat;
    })
    .then((stat) => {
      gameData.stat = stat;
      return gameData;
    })
    .catch((error) => {
      throw error;
    });
};

exports.updateLevelData = ({ gameId, levels }) => dbConnection.updateLevelsInDatabase(gameId, levels);
