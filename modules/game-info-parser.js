const R = require('ramda');
const he = require('he');
const timeParser = require('./time-parser');

const convertTimeZone = (number) => {
  const prefix = number < 10 ? '0' : '';
  return `+${prefix}${number}:00`;
};

const getGameInfo = (row) => {
  const timeZone = R.pipe(
    R.find(R.test(/Начало игры/)),
    R.replace(/<.*?>/g, ''),
    R.match(/\d+/g),
    R.last,
    parseInt,
    convertTimeZone
  )(row);

  const gameTime = R.pipe(
    R.find(R.test(/Начало игры/)),
    R.replace(/<.*?>/g, ''),
    R.split(' '),
    R.take(3),
    R.join(' '),
    R.split(/\t/g),
    R.last
  )(row);

  const stringWithTimeZone = `${gameTime}${timeZone}`;

  return {
    gameStart: timeParser.convertTime(stringWithTimeZone),
    gameTimeZone: timeZone
  };
};

exports.getGameInfo = (info) => R.pipe(
  R.head,
  R.map(he.decode),
  getGameInfo
)(info);
