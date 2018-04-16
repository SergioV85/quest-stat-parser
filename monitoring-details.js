const R = require('ramda');
const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  const gameId = R.pipe(
    R.path(['queryStringParameters', 'gameId']),
    parseInt
  )(event);
  const teamId = R.pipe(
    R.path(['queryStringParameters', 'teamId']),
    R.unless(
      R.isNil,
      parseInt
    )
  )(event);
  const playerId = R.pipe(
    R.path(['queryStringParameters', 'playerId']),
    R.unless(
      R.isNil,
      parseInt
    )
  )(event);
  const detailsType = R.path(['queryStringParameters', 'detailsLevel'], event);

  if (R.isNil(gameId)) {
    callback({
      statusCode: '400',
      body: 'Bad Request'
    });
  }
  gameManagement.getMonitoringDetails({ gameId, teamId, playerId, detailsType })
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
