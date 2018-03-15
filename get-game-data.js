const R = require('ramda');
const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  const gameId = R.path(['queryStringParameters', 'id'], event);
  const domain = R.path(['queryStringParameters', 'domain'], event);
  const isForceRefresh = R.pathOr(false, ['queryStringParameters', 'force'], event);

  if (R.isNil(gameId) || R.isNil(domain)) {
    callback({
      statusCode: '400',
      body: 'Bad Request'
    });
  }
  gameManagement.getGameData({ gameId, domain, isForceRefresh })
    .then((gameData) => {
      callback(null, {
        statusCode: '200',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(gameData),
      });
    })
    .catch((error) => {
      callback({
        statusCode: '500',
        body: JSON.stringify(error)
      });
    });
};
