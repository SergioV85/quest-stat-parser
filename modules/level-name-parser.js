const R = require('ramda');
const he = require('he');

const convertNameStringToObject = (index, strArray) => ({
  level: R.head(strArray),
  name: R.pipe(
    R.tail,
    R.join(' '),
    R.replace('<br><span class="dismissed">Уровень снят</span>', ''),
    R.trim
  )(strArray),
  position: index,
  type: 0,
  removed: R.pipe(
    R.join(' '),
    R.test(/dismissed/g)
  )(strArray)
});

const parseLevelName = (index, string) => R.pipe(
  he.decode,
  R.split(':'),
  R.curry(convertNameStringToObject)(index)
)(string);

const dropTwoFinishResults = (data) => {
  const isLastLever = R.isEmpty(R.prop('name'));

  return R.concat(
    R.dropLastWhile(isLastLever)(data),
    R.pipe(
      R.takeLastWhile(isLastLever),
      R.head
    )(data)
  );
};

const getLevelData = (level, index) => R.pipe(
  R.pathOr([], [0]),
  R.curry(parseLevelName)(index),
  dropTwoFinishResults
)(level);

exports.getNames = (stat) => R.addIndex(R.map)(getLevelData, stat);
