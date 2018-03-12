const R = require('ramda');
const webstatConvertor = require('./webstat-convertor.js');
const dbConnection = require('./database-connection.js');

const saveNewGameToDb = (gameId, domain) => {
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
      return dbConnection.saveGameToDb(gameData);
    });
};

exports.getSavedGames = () => dbConnection.getAllSavedGames();

exports.getGameData = ({ gameId, domain }) => dbConnection.getGameFromDb(gameId)
  .then(({ data }) => {
    const hasSavedGame = !R.isNil(data) && !R.isEmpty(data);

    if (hasSavedGame) {
      return { data };
    }
    return saveNewGameToDb(gameId, domain)
      .then(() => dbConnection.getGameFromDb(gameId));
  })
  .then(({ data }) => ({
    info: R.pick(['GameId', 'FinishTime', 'GameName', 'Domain', 'StatTime', 'Timezone'], data),
    stat: R.pick(['DataByLevels', 'DataByLevelsRow', 'DataByTeam', 'FinishResults', 'Levels'], data)
  }));

exports.updateLevelData = ({ gameId, levels }) => dbConnection.updateLevelsInDatabase(gameId, levels);
