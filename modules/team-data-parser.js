const R = require('ramda');

const removeUserNameAndLevelTime = (rawString) => R.replace(/\(.*?\)/g, ',', rawString);

const parseLevelTime = (str) => R.pipe(
    R.split('.'),
    R.dropLast(1),
    R.insert(3, 'T'),
    R.join('')
  )(str);

const getCorrectTimeFromString = (type, strArray) => R.pipe(
  R.indexOf(type),
  R.flip(R.subtract)(1),
  R.of,
  R.flip(R.path)(strArray),
  parseInt
)(strArray);

const convertStringToTime = (strArray) => ({
  days: R.contains('д', strArray) ? getCorrectTimeFromString('д', strArray) : 0,
  hours: R.contains('ч', strArray) ? getCorrectTimeFromString('ч', strArray) : 0,
  minutes: R.contains('м', strArray) ? getCorrectTimeFromString('м', strArray) : 0,
  seconds: R.contains('с', strArray) ? getCorrectTimeFromString('с', strArray) : 0,
});

const parseBonusPenaltyTime = (str) => R.pipe(
    R.replace('бонус ', ''),
    R.split(' '),
    convertStringToTime
  )(str);

const getBonusesPenaltiesTime = (str) => {
  if (R.test(/бонус/, str)) {
    return { bonus: parseBonusPenaltyTime(str) };
  } else if (R.test(/штраф/, str)) {
    return { penalty: parseBonusPenaltyTime(str) };
  }
  return undefined;
};

const parseBonusesAndPenalties = (str) => R.pipe(
    R.replace('таймаут', ''),
    getBonusesPenaltiesTime
  )(str);

const parseTeamString = (teamString) => ({
  name: R.pathOr('', [0], teamString),
  time: R.isNil(R.path([1], teamString)) ? null : parseLevelTime(teamString[1]),
  additions: R.isNil(R.path([2], teamString)) ? null : parseBonusesAndPenalties(teamString[2]),
});

const getTeamData = (team) => R.pipe(
    R.slice(1, -1),
    R.map(removeUserNameAndLevelTime),
    R.map(R.split(',')),
    R.map(parseTeamString)
  )(team);

exports.getTeamData = (stat) => R.map(getTeamData, stat);
