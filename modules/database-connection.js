
const R = require('ramda');
const Promise = require('bluebird');
const pgp = require('pg-promise')({
  promiseLib: Promise,
  capSQL: true
});

const db = pgp(`${process.env.DATABASE_URL}?ssl=true`);

const dbRequest = (preparedRequest) => db.oneOrNone(preparedRequest)
  .then((data) => data)
  .catch((error) => {
    throw error;
  });

exports.getGameInfoFromDatabase = (gameId) => dbRequest({
  name: 'get-game',
  text: 'SELECT id, domain, name, start, timezone FROM quest.games WHERE id = $1',
  values: [gameId]
});

exports.getLevelFromDatabase = (gameId) =>
  dbRequest({
    name: 'get-levels',
    text: 'SELECT id, name, position, type, removed FROM quest.levels WHERE game_id = $1',
    values: [gameId]
  });


exports.saveGameInfoToDatabase = ({ id, name, domain, start, timezone }) => db
  .none(`INSERT 
    INTO quest.games 
    (id, domain, name, start, timezone) 
    VALUES
    (${id}, '${domain}', '${name}', '${start}', '${timezone}')`)
  .then(() => ({ id, name, domain, start, timezone }))
  .catch((error) => {
    throw error;
  });

exports.saveLevelsToDatabase = (gameInfo, { levels, dataByTeam, dataByLevels, finishResults }) => {
  const getLevelNumber = (level) => (isNaN(level.level) ? 0 : parseInt(level.level, 10));

  const cs = new pgp.helpers.ColumnSet(
    ['id', 'game_id', 'level', 'name', 'position', 'removed', 'type'], {
      table: {
        table: 'levels',
        schema: 'quest'
      }
    });
  const values = R.map((level) => R.merge(level, {
    id: (gameInfo.id + (getLevelNumber(level) / 1000)) * 1000,
    game_id: gameInfo.id,
    level: getLevelNumber(level)
  }), levels);

  const query = pgp.helpers.insert(values, cs);

  return db.none(query)
    .then(() => ({ levels, dataByTeam, dataByLevels, finishResults }))
    .catch((error) => {
      throw error.stack;
    });
};

