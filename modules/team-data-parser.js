const R = require('ramda');

const removeUserNameAndLevelTime = (rawString) => R.replace(/\(.*?\)/g, ',', rawString);

const parseLevelTime = (str) => R.pipe(
    R.splitAt(10),
    R.insert(1, 'T'),
    R.join('')
  )(str);

const convertStringToTime = (strArray) => ({
  days: R.contains('д', strArray) ? R.path([R.indexOf('д', strArray) - 1], strArray) : 0,
  hours: R.contains('ч', strArray) ? R.path([R.indexOf('ч', strArray) - 1], strArray) : 0,
  minutes: R.contains('м', strArray) ? R.path([R.indexOf('м', strArray) - 1], strArray) : 0,
  seconds: R.contains('с', strArray) ? R.path([R.indexOf('с', strArray) - 1], strArray) : 0,
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
