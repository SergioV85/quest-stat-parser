
const R = require('ramda');
const Promise = require('bluebird');
const pgp = require('pg-promise')({
  promiseLib: Promise,
  capSQL: true
});

const db = pgp(`${process.env.DATABASE_URL}?ssl=true`);

const getLevelId = (gameInfo, levelIndex) => ((gameInfo.id + (levelIndex / 1000)) * 1000);

const dbRequest = (preparedRequest) => db.manyOrNone(preparedRequest);

const saveLevelsToDatabase = (gameInfo, levels) => {
  const cs = new pgp.helpers.ColumnSet(
    ['id', 'game_id', 'level', 'name', 'position', 'removed', 'type'], {
      table: {
        table: 'levels',
        schema: 'quest'
      }
    });
  const values = R.map((level) => R.merge(level, {
    id: getLevelId(gameInfo, level.position),
    game_id: gameInfo.id
  }), levels);

  const query = pgp.helpers.insert(values, cs);
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
    ['id', 'game_id', 'level_id', 'team_id', 'best_time', 'duration', 'level_idx', 'level_time', 'team_name'], {
      table: {
        table: 'stat',
        schema: 'quest'
      }
    });

  const convertLevelToDb = (levelStat) => {
    const levelIdx = R.isNil(levelStat.levelIdx) ? dataByLevels.length : levelStat.levelIdx;
    const levelId = getLevelId(gameInfo, levelIdx);

    const dbObject = {
      id: `${levelId}_${levelStat.id}`,
      game_id: gameInfo.id,
      level_id: levelId,
      team_id: levelStat.id,
      best_time: levelStat.bestTime || false,
      duration: levelStat.duration,
      level_idx: levelIdx,
      level_time: levelStat.levelTime,
      team_name: levelStat.name
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

exports.getGameInfoFromDatabase = (gameId) => dbRequest({
  name: 'get-game',
  text: 'SELECT id, domain, name, start, timezone FROM quest.games WHERE id = $1',
  values: [gameId]
});

exports.getLevelFromDatabase = (gameId) => {
  const savedData = {
    dataByLevels: [],
    dataByTeam: [],
    finishResults: [],
    levels: []
  };
  const levelRequest = ['id', 'name', 'level', 'position', 'type', 'removed'];
  const statRequest = ['level_id', 'team_id', 'best_time', 'duration', 'level_idx', 'level_time', 'team_name'];

  return dbRequest({
    name: 'get-levels',
    text: `SELECT ${levelRequest} FROM quest.levels WHERE game_id = $1`,
    values: [gameId]
  })
  .then((levels) => {
    if (R.isNil(levels) || R.isEmpty(levels)) {
      return null;
    }
    savedData.levels = levels;
    return dbRequest({
      name: 'get-stat',
      text: `SELECT ${statRequest} FROM quest.stat WHERE game_id = $1`,
      values: [gameId]
    });
  })
  .then((stat) => {
    if (R.isNil(stat) || R.isEmpty(stat)) {
      return null;
    }
    savedData.dataByLevels = stat;
    savedData.dataByTeam = stat;
    savedData.finishResults = stat;
    return savedData;
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
    .then(() => ({ levels, dataByTeam, dataByLevels, finishResults }))
    .catch((err) => {
      throw err;
    });
