const R = require('ramda');

const convertNameStringToObject = (strArray) => ({
  level: R.head(strArray),
  name: R.pipe(
    R.tail,
    R.join(' '),
    R.replace('Уровень снят', ''),
    R.trim
  )(strArray),
  removed: R.pipe(
    R.join(' '),
    R.test(/Уровень снят/g)
  )(strArray)
});

const parseLevelName = (levelStr) => R.pipe(
    R.split(':'),
    convertNameStringToObject
  )(levelStr);

const getLevelData = (col) => R.pipe(
  R.pathOr([], [0]),
  parseLevelName
)(col);

exports.getNames = (stat) => R.map(getLevelData, stat);
