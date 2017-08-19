const R = require('ramda');
const he = require('he');

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

const getLevelTime = (rawString) => R.pipe(
  levelInfo,
  R.slice(4, 6),
  R.insert(1, 'T'),
  R.join('')
)(rawString);

const getBonusPenaltyTime = (rawString) => R.pipe(
  levelInfo,
  getBonusesPenaltiesTime
)(rawString);

const convertStringToObject = (rawString) => ({
  id: getTeamId(rawString),
  name: getTeamName(rawString),
  levelTime: getLevelTime(rawString),
  additionsTime: getBonusPenaltyTime(rawString)
});

const getTeamData = (team) => R.pipe(
    R.slice(1, -1),
    R.map(convertStringToObject)
  )(team);

exports.getTeamData = (stat) => R.map(getTeamData, stat);
