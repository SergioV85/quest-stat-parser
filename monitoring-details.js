const R = require('ramda');
const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  const gameId = R.pipe(
    R.path(['queryStringParameters', 'gameId']),
    parseInt
  )(event);
  const teamId = R.pipe(
    R.path(['queryStringParameters', 'teamId']),
    parseInt
  )(event);
  const detailsLevel = R.path(['queryStringParameters', 'detailsLevel']);

  if (R.isNil(gameId) || R.isNil(teamId)) {
    callback({
      statusCode: '400',
      body: 'Bad Request'
    });
  }
  gameManagement.getMonitoringDetails({ gameId, teamId, detailsLevel })
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
