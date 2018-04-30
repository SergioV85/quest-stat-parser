const R = require('ramda');
const he = require('he');

const filterEmptyAndObsoleteValues = R.pipe(
  R.reject(
    R.anyPass([
      R.isNil,
      R.isEmpty,
      R.test(/^<div class="spacer"/)
    ])
  ),
  R.drop(1)
);

const getTeamName = R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.head,
  R.slice(1, -1)
);
const getTeamId = R.pipe(
  R.match(/tid=\d*/g),
  R.head,
  R.replace('tid=', ''),
  parseInt
);
const getUserName = R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.last,
  R.slice(1, -1)
);
const getUserId = R.pipe(
  R.match(/uid=\d*/g),
  R.head,
  R.replace('uid=', ''),
  parseInt
);
const getAnswerType = R.pipe(
  he.decode,
  R.match(/>.*?</g),
  R.head,
  R.slice(1, -1),
  R.equals('в')
);
const getCode = R.pipe(
  he.decode,
  R.replace(/<.*?>/g, '')
);
const isTimeout = R.pipe(
  getCode,
  R.test(/таймауту/g)
);
const isRemoved = R.pipe(
  getCode,
  R.test(/Уровень снят/g)
);

const convertToEntry = ([levelNumber, teamAndUser, answerStatus, code, time]) => ({
  level: parseInt(levelNumber, 10),
  teamName: getTeamName(teamAndUser),
  teamId: getTeamId(teamAndUser),
  userName: getUserName(teamAndUser),
  userId: getUserId(teamAndUser),
  isSuccess: getAnswerType(answerStatus),
  // Can be situation, when code is empty and was dropped on previous stage.
  // In such case, time entry shifted to code position
  code: R.isNil(time) ? '' : getCode(code),
  time: R.isNil(time) ? he.decode(code) : he.decode(time),
  isTimeout: isTimeout(code),
  isRemovedLevel: isRemoved(code)
});

exports.getMonitoringData = (info) => R.pipe(
  R.map(filterEmptyAndObsoleteValues),
  R.transpose,
  R.map(convertToEntry)
)(info);
