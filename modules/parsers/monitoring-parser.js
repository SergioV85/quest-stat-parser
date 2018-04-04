const R = require('ramda');
const he = require('he');

const filterEmptyAndObsoleteValues = (column) => R.pipe(
  R.reject(
    R.anyPass([
      R.isNil,
      R.isEmpty,
      R.test(/^<div class="spacer"/)
    ])
  ),
  R.drop(1)
)(column);

const getTeamName = (string) => R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.head,
  R.slice(1, -1)
)(string);
const getTeamId = (string) => R.pipe(
  R.match(/tid=\d*/g),
  R.head,
  R.replace('tid=', ''),
  parseInt
)(string);
const getUserName = (string) => R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.last,
  R.slice(1, -1)
)(string);
const getUserId = (string) => R.pipe(
  R.match(/uid=\d*/g),
  R.head,
  R.replace('uid=', ''),
  parseInt
)(string);
const getAnswerType = (string) => R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.head,
  R.slice(1, -1),
  R.equals('в')
)(string);
const getCode = (string) => R.pipe(
  he.decode,
  R.replace(/<.*?>/g, '')
)(string);
const isTimeout = (string) => R.pipe(
  getCode,
  R.test(/таймауту/g)
)(string);
const isRemoved = (string) => R.pipe(
  getCode,
  R.test(/Уровень снят/g)
)(string);

const convertToEntry = ([levelNumber, teamAndUser, answerStatus, code, time]) => ({
  level: parseInt(levelNumber, 10),
  teamName: getTeamName(teamAndUser),
  teamId: getTeamId(teamAndUser),
  userName: getUserName(teamAndUser),
  userId: getUserId(teamAndUser),
  isSuccess: getAnswerType(answerStatus),
  code: getCode(code),
  time: he.decode(time),
  isTimeout: isTimeout(code),
  isRemovedLevel: isRemoved(code)
});

exports.getMonitoringData = (info) => R.pipe(
  R.map(filterEmptyAndObsoleteValues),
  R.transpose,
  R.map(convertToEntry)
)(info);
