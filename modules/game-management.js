const R = require('ramda');
const moment = require('moment');
const webstatConvertor = require('./webstat-convertor.js');
const dbConnection = require('./database-connection.js');

exports.getSavedGames = () => dbConnection.getAllSavedGames();

exports.getGameData = ({ gameId, domain, isForceRefresh }) => {
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
      if (!isForceRefresh && !R.isNil(data.last_updated) && moment(data.last_updated).isAfter(data.finish)) {
        return dbConnection.getFullStatFromDatabase(gameId);
      }
      return null;
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

exports.getGameDataNoSql = ({ gameId, domain }) => {
  return dbConnection.getGameFromDynamoDb(gameId)
    .then((result) => {
      const hasSavedGame = !R.isNil(result) && !R.isEmpty(result);

      if (hasSavedGame) {
        return {
          info: R.pick(['domain', 'finish', 'game', 'name', 'start', 'timezone'], result.Item),
          stat: R.pick(['dataByLevels', 'dataByTeam', 'finishResults', 'levels'], result.Item),
          source: 'DB'
        };
      }

      const gameData = {
        info: null,
        stat: null,
        source: 'HTML'
      };
      return webstatConvertor.getGameInfo(domain, gameId)
        .then((parsedGameData) => {
          gameData.info = parsedGameData;
          return webstatConvertor.getGameStat(domain, gameId, gameData.info);
        })
        .then((stat) => {
          gameData.stat = stat;
          return dbConnection.saveGameToDatabaseNosql(gameData);
        })
        .then(() => gameData);
    });
  /*

  */
};

exports.updateLevelData = ({ gameId, levels }) => dbConnection.updateLevelsInDatabase(gameId, levels);
