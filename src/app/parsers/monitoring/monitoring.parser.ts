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
import { decode } from 'he';
import { CodeEntry } from '../../../models';
const filterEmptyAndObsoleteValues: (data: string[]) => string[] = pipe(
  reject(anyPass([isNil, isEmpty, test(/^<div class="spacer"/)])),
  drop(1),
);

const getTeamName: (d: string) => string = pipe(decode, match(/>.*?</g), head, slice(1, -1) as (d: string) => string);
const getTeamId: (d: string) => number = pipe(match(/tid=\d*/g), head, replace('tid=', ''), parseInt);
const getUserName: (d: string) => string = pipe(decode, match(/>.*?</g), last, slice(1, -1) as (d: string) => string);
const getUserId: (d: string) => number = pipe(match(/uid=\d*/g), head, replace('uid=', ''), parseInt);
const isAnswerCorrect: (d: string) => boolean = pipe(
  decode,
  match(/>.*?</g),
  head,
  slice(1, -1) as (d: string) => string,
  equals('в'),
);
const getCode: (d: string) => string = pipe(decode, replace(/<.*?>/g, ''));
const isTimeout: (d: string) => boolean = pipe(getCode, test(/таймауту/g));
const isRemoved: (d: string) => boolean = pipe(getCode, test(/Уровень снят/g));

const convertToEntry = ([levelNumber, teamAndUser, answerStatus, code, time]: string[]): Partial<CodeEntry> => ({
  level: parseInt(levelNumber, 10),
  teamName: getTeamName(teamAndUser),
  teamId: getTeamId(teamAndUser),
  userName: getUserName(teamAndUser),
  userId: getUserId(teamAndUser),
  isSuccess: isAnswerCorrect(answerStatus),
  // Can be situation, when code is empty and was dropped on previous stage.
  // In such case, time entry shifted to code position
  code: isNil(time) ? '' : getCode(code),
  time: isNil(time) ? decode(code) : decode(time),
  isTimeout: isTimeout(code),
  isRemovedLevel: isRemoved(code),
});

export const parseRawMonitoringData: (raw: string[][]) => Array<Partial<CodeEntry>> = pipe(
  map(filterEmptyAndObsoleteValues),
  transpose,
  map(convertToEntry),
);
