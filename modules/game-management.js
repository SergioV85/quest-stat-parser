const R = require('ramda');
const webstatConvertor = require('./webstat-convertor.js');
const dbConnection = require('./database-connection.js');

const getExistedLevelType = (key, oldLevelValue, newLevelValue) => (key === 'type' ? oldLevelValue : newLevelValue);

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
          .then(([totalInputs, correctCodes]) => R.map(
            (team) => {
              const teamId = R.path(['_id', 'teamId'], team);
              return R.pipe(
                R.find(R.pathEq(['_id', 'teamId'], teamId)),
                R.prop('codesCounts'),
                R.objOf('correctCodesQuantity'),
                R.merge(team)
              )(correctCodes);
            },
            totalInputs
          ));
      }
      return data;
    }
    return webstatConvertor.retrieveGameMonitoring(domain, gameId);
  });
