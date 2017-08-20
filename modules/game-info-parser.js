const R = require('ramda');
const he = require('he');

const getGameInfo = (row) => {
  const gameStart = R.find(R.test(/Начало игры/))(row);

  return {
    gameStart
  };
};

exports.getGameInfo = (info) => R.pipe(
  R.head,
  R.map(he.decode),
  getGameInfo
)(info);
