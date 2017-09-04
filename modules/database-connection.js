
const R = require('ramda');
const Promise = require('bluebird');
const pgp = require('pg-promise')({
  promiseLib: Promise,
  capSQL: true
});

const db = pgp(`${process.env.HEROKU_POSTGRESQL_AQUA_URL}?ssl=true`);
// const db = pgp(`${process.env.DATABASE_URL}?ssl=true`);

const getLevelId = (gameInfo, levelIndex) => ((gameInfo.id + (levelIndex / 1000)) * 1000);

const dbRequest = (preparedRequest) => db.manyOrNone(preparedRequest);

const saveLevelsToDatabase = (gameInfo, levels) => {
  const cs = new pgp.helpers.ColumnSet(
    [
      {name: 'id', init: a => getLevelId(gameInfo, a.position)},
      {name: 'game_id', init: () => gameInfo.id},
      'level', 'name', 'position', 'removed', 'type'
    ], {
      table: {
        table: 'levels',
        schema: 'quest'
      }
    });
  const query = pgp.helpers.insert(levels, cs);
  return db.none(query);
};

const saveTeamsToDatabase = (dataByTeam) => {
  const getTeamName = R.pipe(
    R.head,
    R.prop('name')
  );

  const cs = new pgp.helpers.ColumnSet(
    ['id', 'name'], {
      table: {
        table: 'teams',
        schema: 'quest'
      }
    });
  const values = R.map((teamData) => ({
    id: teamData.id,
    name: getTeamName(teamData.data)
  }), dataByTeam);

  const conflictSet = cs.columns
    .map((x) => {
      const col = pgp.as.name(x.name);
      return `${col} = EXCLUDED.${col}`;
    })
    .join();

  const query = `${pgp.helpers.insert(values, cs)} ON CONFLICT (id) DO UPDATE SET ${conflictSet}`;
  return db.none(query);
};

const saveLevelStatToDatabase = (gameInfo, dataByLevels, finishResults) => {
  const cs = new pgp.helpers.ColumnSet(
    ['addition_time', 'id', 'game_id',
      'level_id', 'team_id', 'best_time', 'duration', 'level_idx', 'level_time', 'team_name', 'timeout'],
    {
      table: {
        table: 'stat',
        schema: 'quest'
      }
    });

  const convertLevelToDb = (levelStat) => {
    const levelIdx = R.isNil(levelStat.levelIdx) ? dataByLevels.length : levelStat.levelIdx;
    const levelId = getLevelId(gameInfo, levelIdx);

    const dbObject = {
      addition_time: levelStat.additionsTime,
      id: `${levelId}_${levelStat.id}`,
      game_id: gameInfo.id,
      level_id: levelId,
      team_id: levelStat.id,
      best_time: levelStat.bestTime || false,
      duration: levelStat.duration,
      level_idx: levelIdx,
      level_time: levelStat.levelTime,
      team_name: levelStat.name,
      timeout: levelStat.timeout
    };

    return dbObject;
  };

  const values = R.pipe(
    R.map(R.prop('data')),
    R.append(finishResults),
    R.flatten,
    R.map(convertLevelToDb)
  )(dataByLevels);

  const conflictSet = cs.columns
    .map((x) => {
      const col = pgp.as.name(x.name);
      return `${col} = EXCLUDED.${col}`;
    })
    .join();

  const query = `${pgp.helpers.insert(values, cs)} ON CONFLICT (id) DO UPDATE SET ${conflictSet}`;
  return db.none(query);
};

const converDbStat = (stat) => ({
  bestTime: stat.best_time,
  duration: stat.duration,
  id: stat.team_id,
  levelIdx: stat.level_idx,
  levelTime: stat.level_time,
  name: stat.team_name,
  additionsTime: stat.addition_time,
  timeout: stat.timeout
});

const convertObjToArr = (data, id) => ({
  id: parseInt(id, 10),
  data
});

const getlastLevelIdx = R.pipe(
  R.map((level) => level.level_idx),
  R.sort((a, b) => a - b),
  R.last);

const filterFinishStat = (comparsionFunction, stat) => {
  const lastLevelIdx = getlastLevelIdx(stat);

  return R.pipe(
    R.filter((level) => comparsionFunction(level.level_idx, lastLevelIdx)),
    R.map(converDbStat)
  )(stat);
};

const groupStatBy = (stat, fieldName) => R.pipe(
  R.curry(filterFinishStat)(R.complement(R.equals)),
  R.groupBy((level) => level[fieldName]),
  R.mapObjIndexed(convertObjToArr),
  R.values
)(stat);

const getLevelsFromDatabase = (gameId) => {
  const levelRequest = ['id', 'name', 'level', 'position', 'type', 'removed'];

  return dbRequest({
    name: 'get-levels',
    text: `SELECT ${levelRequest} FROM quest.levels WHERE game_id = $1 ORDER BY position`,
    values: [gameId]
  });
};

const getTeamStatFromDatabase = (gameId) => {
  const statRequest = ['addition_time', 'level_id', 'team_id', 'best_time',
    'duration', 'level_idx', 'level_time', 'team_name', 'timeout'];

  return dbRequest({
    name: 'get-stat',
    text: `SELECT ${statRequest} FROM quest.stat WHERE game_id = $1`,
    values: [gameId]
  })
  .then((stat) => {
    if (R.isNil(stat) || R.isEmpty(stat)) {
      return null;
    }
    const dataByLevels = groupStatBy(stat, 'levelIdx');
    const dataByTeam = groupStatBy(stat, 'id');
    const finishResults = filterFinishStat(R.equals, stat);
    return {
      dataByLevels,
      dataByTeam,
      finishResults
    };
  });
};

exports.getGameInfoFromDatabase = (gameId) => dbRequest({
  name: 'get-game',
  text: 'SELECT id, domain, name, start, timezone FROM quest.games WHERE id = $1',
  values: [gameId]
});

exports.getLevelFromDatabase = (gameId) => getLevelsFromDatabase(gameId);

exports.getFullStatFromDatabase = (gameId) => {
  let levelsFromDb;

  return getLevelsFromDatabase(gameId)
    .then((levels) => {
      if (R.isNil(levels) || R.isEmpty(levels)) {
        return null;
      }
      levelsFromDb = levels;
      return getTeamStatFromDatabase(gameId);
    })
    .then((teamStat) => {
      if (R.isNil(teamStat) || R.isEmpty(teamStat)) {
        return null;
      }
      return R.merge(teamStat, {
        levels: levelsFromDb
      });
    })
    .catch((error) => {
      throw error;
    });
};

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

exports.saveGameDataToDatabase = (gameInfo, { levels, dataByTeam, dataByLevels, finishResults }) =>
  saveLevelsToDatabase(gameInfo, levels)
    .then(() => saveTeamsToDatabase(dataByTeam))
    .then(() => saveLevelStatToDatabase(gameInfo, dataByLevels, finishResults))
    .catch((err) => {
      throw err;
    });

exports.updateLevelsInDatabase = (gameId, levels) => {
  const cs = new pgp.helpers.ColumnSet(
    ['?id', 'name', 'removed', 'type'], {
      table: {
        table: 'levels',
        schema: 'quest'
      }
    });

  const query = `${pgp.helpers.update(levels, cs)} WHERE v.id = t.id`;
  return db.none(query)
    .then(() => getLevelsFromDatabase(gameId));
};
