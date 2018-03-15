const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  gameManagement.getSavedGames()
    .then((games) => {
      callback(null, {
        statusCode: '200',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(games),
      });
    })
    .catch((error) => {
      callback({
        statusCode: '500',
        body: JSON.stringify(error)
      });
    });
};
