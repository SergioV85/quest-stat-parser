const R = require('ramda');
const he = require('he');
const timeParser = require('./time-parser');

const convertTimeZone = (number) => {
  const prefix = number < 10 ? '0' : '';
  return `+${prefix}${number}:00`;
};

const getGameInfo = (row) => {
  const name = R.pipe(
    R.find(R.test(/lnkGameTitle/)),
    R.match(/gid=\d{1,10}">.*<\/a>/g),
    R.head,
    R.match(/>.*?</g),
    R.head,
    R.slice(1, -1)
  )(row);

  const timezone = R.pipe(
    R.find(R.test(/Начало игры/)),
    R.replace(/<.*?>/g, ''),
    R.match(/\d+/g),
    R.last,
    parseInt,
    convertTimeZone
  )(row);

  const start = R.pipe(
    R.find(R.test(/Начало игры/)),
    R.replace(/<.*?>/g, ''),
    R.split(' '),
    R.take(3),
    R.join(' '),
    R.split(/\t/g),
    R.last
  )(row);

  const finish = R.pipe(
    R.find(R.test(/Время окончания/)),
    R.replace(/<.*?>/g, ''),
    R.split(' '),
    R.take(3),
    R.join(' '),
    R.split(/\t/g),
    R.last
  )(row);

  const startStringWithTimeZone = `${start}${timezone}`;
  const finishStringWithTimeZone = `${finish}${timezone}`;

  return {
    start: timeParser.convertTime(startStringWithTimeZone),
    finish: timeParser.convertTime(finishStringWithTimeZone),
    timezone,
    name
  };
};

exports.getGameInfo = (info) => R.pipe(
  R.head,
  R.map(he.decode),
  getGameInfo
)(info);
