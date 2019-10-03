import { pipe, find, test, match, head, slice, replace, last, split, take, join, map } from 'ramda';
import { decode } from 'he';
import { convertTime } from './time-parser';

const convertTimeZone = (n: number) => {
  const prefix = n < 10 ? '0' : '';
  return `+${prefix}${n}:00`;
};

const parseGameInfo = (row: string[]) => {
  const name: string = pipe(
    find(test(/lnkGameTitle/)),
    match(/gid=\d{1,10}">.*<\/a>/g),
    head,
    match(/>.*?</g),
    head,
    slice(1, -1) as (data: string) => string
  )(row);

  const timezone: string = pipe(
    find(test(/Начало игры/)),
    replace(/<.*?>/g, ''),
    match(/\d+/g),
    last,
    parseInt,
    convertTimeZone
  )(row);

  const start: string = pipe(
    find(test(/Начало игры/)),
    replace(/<.*?>/g, ''),
    split(' '),
    take(3),
    join(' '),
    split(/\t/g),
    last
  )(row);

  const finish: string = pipe(
    find(test(/Время окончания/)),
    replace(/<.*?>/g, ''),
    split(' '),
    take(3),
    join(' '),
    split(/\t/g),
    last
  )(row);

  const startStringWithTimeZone = `${start}${timezone}`;
  const finishStringWithTimeZone = `${finish}${timezone}`;

  return {
    start: convertTime(startStringWithTimeZone),
    finish: convertTime(finishStringWithTimeZone),
    timezone,
    name,
  };
};

export const getGameInfo = pipe(
  head,
  map(decode),
  parseGameInfo
);
