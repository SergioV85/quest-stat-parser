const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  gameManagement.getSavedGames()
    .then((games) => {
      callback(null, {
        statusCode: '200',
        body: games,
      });
    })
    .catch((error) => {
      callback(null, {
        statusCode: '500',
        body: error
      });
    });
};
