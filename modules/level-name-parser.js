const R = require('ramda');
const he = require('he');

const convertNameStringToObject = (strArray) => ({
  level: R.head(strArray),
  name: R.pipe(
    R.tail,
    R.join(' '),
    R.replace('<br><span class="dismissed">Уровень снят</span>', ''),
    R.trim
  )(strArray),
  removed: R.pipe(
    R.join(' '),
    R.test(/dismissed/g)
  )(strArray)
});

const parseLevelName = R.pipe(
    he.decode,
    R.split(':'),
    convertNameStringToObject);

const getLevelData = R.pipe(
  R.pathOr([], [0]),
  parseLevelName);

exports.getNames = (stat) => R.map(getLevelData, stat);
