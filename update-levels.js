const R = require('ramda');
const gameManagement = require('./modules/game-management');

exports.handler = (event, context, callback) => {
  const gameId = R.path(['pathParameters', 'proxy'], event);
  const levels = R.pipe(
    R.prop('body'),
    JSON.parse
  )(event);

  gameManagement.updateLevelData({ gameId, levels })
    .then((updateLevelStat) => {
      callback(null, {
        statusCode: '200',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(updateLevelStat),
      });
    })
    .catch((error) => {
      callback({
        statusCode: '500',
        body: JSON.stringify(error)
      });
    });
};
