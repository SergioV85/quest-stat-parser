const R = require('ramda');
const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  const gameId = R.pipe(
    R.path(['queryStringParameters', 'id']),
    parseInt
  )(event);
  const domain = R.path(['queryStringParameters', 'domain'], event);

  if (R.isNil(gameId) || R.isNil(domain)) {
    callback({
      statusCode: '400',
      body: 'Bad Request'
    });
  }
  gameManagement.getMonitoringData({ gameId, domain })
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