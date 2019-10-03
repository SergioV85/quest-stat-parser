import {
  anyPass,
  drop,
  equals,
  head,
  isEmpty,
  isNil,
  last,
  map,
  match,
  pipe,
  reject,
  replace,
  slice,
  test,
  transpose,
} from 'ramda';
import he from 'he';

const filterEmptyAndObsoleteValues = pipe(
  reject(anyPass([isNil, isEmpty, test(/^<div class="spacer"/)])),
  drop(1)
);

const getTeamName = pipe(
  he.decode,
  match(/>.*?</g),
  head,
  slice(1, -1)
);
const getTeamId = pipe(
  match(/tid=\d*/g),
  head,
  replace('tid=', ''),
  parseInt
);
const getUserName = pipe(
  he.decode,
  match(/>.*?</g),
  last,
  slice(1, -1)
);
const getUserId = pipe(
  match(/uid=\d*/g),
  head,
  replace('uid=', ''),
  parseInt
);
const getAnswerType = pipe(
  he.decode,
  match(/>.*?</g),
  head,
  slice(1, -1),
  equals('в')
);
const getCode = pipe(
  he.decode,
  replace(/<.*?>/g, '')
);
const isTimeout = pipe(
  getCode,
  test(/таймауту/g)
);
const isRemoved = pipe(
  getCode,
  test(/Уровень снят/g)
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
  code: isNil(time) ? '' : getCode(code),
  time: isNil(time) ? he.decode(code) : he.decode(time),
  isTimeout: isTimeout(code),
  isRemovedLevel: isRemoved(code),
});

export const getMonitoringData = pipe(
  map(filterEmptyAndObsoleteValues),
  // tslint:disable-next-line: no-any
  transpose as any,
  map(convertToEntry)
);
