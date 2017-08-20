const R = require('ramda');
const he = require('he');
const moment = require('moment');
const timeParser = require('./time-parser');

const getCorrectTimeFromString = (type, strArray) => R.pipe(
  R.indexOf(type),
  R.flip(R.subtract)(1),
  R.of,
  R.flip(R.path)(strArray),
  parseInt
)(strArray);

const convertStringToTime = (strArray) => {
  const days = R.contains('д', strArray) ? `${getCorrectTimeFromString('д', strArray)}.` : '';
  const hours = R.contains('ч', strArray) ? getCorrectTimeFromString('ч', strArray) : 0;
  const minutes = R.contains('м', strArray) ? getCorrectTimeFromString('м', strArray) : 0;
  const seconds = R.contains('с', strArray) ? getCorrectTimeFromString('с', strArray) : 0;
  return moment.duration(`${days}${hours}:${minutes}:${seconds}`).asMilliseconds();
};

const parseBonusPenaltyTime = (levelArray, regex) => R.pipe(
    R.find(R.test(regex)),
    R.replace('бонус ', ''),
    R.replace('штраф ', ''),
    R.split(' '),
    convertStringToTime
  )(levelArray);

const getBonusesPenaltiesTime = (levelArray) => {
  if (R.find(R.test(/бонус/))(levelArray)) {
    const bonusRegex = new RegExp(/бонус/);
    return { bonus: parseBonusPenaltyTime(levelArray, bonusRegex) };
  } else if (R.find(R.test(/штраф/))(levelArray)) {
    const penaltyRegex = new RegExp(/штраф/);
    return { penalty: parseBonusPenaltyTime(levelArray, penaltyRegex) };
  }
  return undefined;
};

const levelInfo = (rawString) => R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.map(R.slice(1, -1)),
  R.filter(R.complement(R.isEmpty))
)(rawString);

const getTeamId = (rawString) => R.pipe(
  R.match(/tid=\d*/g),
  R.head,
  R.replace('tid=', ''),
  parseInt
)(rawString);

const getTeamName = (rawString) => R.pipe(
  levelInfo,
  R.head
)(rawString);

const getLevelTime = (rawString, gameData) => R.pipe(
  levelInfo,
  R.slice(4, 6),
  R.insert(1, 'T'),
  R.append(R.pathOr('Z', ['gameTimeZone'], gameData)),
  R.join(''),
  timeParser.convertTime
)(rawString);

const getBonusPenaltyTime = (rawString) => R.pipe(
  levelInfo,
  getBonusesPenaltiesTime
)(rawString);

const convertStringToObject = (levelIdx, gameData, rawString) => ({
  id: getTeamId(rawString),
  levelIdx,
  name: getTeamName(rawString),
  levelTime: getLevelTime(rawString, gameData),
  additionsTime: getBonusPenaltyTime(rawString)
});

const assignIndexToLevelData = (idx, gameData, lvl) => R.map(R.curry(convertStringToObject)(idx, gameData), lvl);

const getTeamData = (gameData, team, idx) => R.pipe(
  R.slice(1, -1),
  R.curry(assignIndexToLevelData)(idx, gameData)
)(team);

const calculateLeveLDuration = (gameData, level, idx, list) => {
  const matchTeamId = R.propEq('id', level.id);
  const matchPrevLevelIdx = R.propEq('levelIdx', R.subtract(level.levelIdx, 1));
  const matchConditions = R.allPass([matchTeamId, matchPrevLevelIdx]);
  const prevLevelTime = level.levelIdx === 0 ? gameData.gameStart : R.find(matchConditions)(list).levelTime;

  return R.merge(level, {
    duration: moment(level.levelTime).diff(moment(prevLevelTime))
  });
};

const highlightBestResult = (levelStat) => {
  const byDuration = R.ascend(R.prop('duration'));
  const bestTeam = R.head(R.sort(byDuration, levelStat));
  return R.map((team) => R.merge(team, {
    bestTime: team.id === bestTeam.id
  }), levelStat);
};

const groupByLevel = (levelList) => R.pipe(
  R.groupBy((level) => level.levelIdx),
  R.map(highlightBestResult)
)(levelList);

const convertObjToArr = (data, id) => ({
  id,
  data
});

exports.getStat = (stat, gameData) => R.pipe(
  R.addIndex(R.map)(R.curry(getTeamData)(gameData)),
  R.flatten,
  R.addIndex(R.map)(R.curry(calculateLeveLDuration)(gameData))
)(stat);

exports.getStatByTeam = (levelData) => R.pipe(
  groupByLevel,
  R.values,
  R.flatten,
  R.groupBy((level) => level.id),
  R.mapObjIndexed(convertObjToArr),
  R.values
)(levelData);

exports.getStatByLevel = (levelData) => R.pipe(
  groupByLevel,
  R.mapObjIndexed(convertObjToArr),
  R.values
)(levelData);

exports.getStatByTime = (levelData) => R.pipe(
  groupByLevel,
  R.values,
  R.transpose
)(levelData);
