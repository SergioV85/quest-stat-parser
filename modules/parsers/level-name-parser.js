const R = require('ramda');
const he = require('he');

const checkLevelType = (string) => {
  if (R.anyPass([R.test(/поиск/gui), R.test(/пошук/gui)])(string)) {
    return 1;
  } else if (R.anyPass([R.test(/логика/gui), R.test(/логіка/gui)])(string)) {
    return 2;
  } else if (R.anyPass([R.test(/доезд/gui), R.test(/доїзд/gui), R.test(/ралийка/gui)])(string)) {
    return 3;
  } else if (R.anyPass([R.test(/агент/gui)])(string)) {
    return 4;
  } else if (R.anyPass([R.test(/заглушка/gui), R.test(/бриф/gui)])(string)) {
    return 5;
  }
  return 0;
};

const convertNameStringToObject = (index, strArray) => ({
  level: R.head(strArray),
  name: R.pipe(
    R.tail,
    R.join(' '),
    R.replace('<br><span class="dismissed">Уровень снят</span>', ''),
    R.trim
  )(strArray),
  position: index,
  type: R.pipe(
    R.join(' '),
    checkLevelType
  )(strArray),
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
  const isStatLevel = (level) => isNaN(level.level);
  return R.append(
    R.pipe(
      R.filter(isStatLevel),
      R.head
    )(data),
    R.filter(R.complement(isStatLevel))(data)
  );
};

const getLevelData = (level, index) => R.pipe(
  R.pathOr([], [0]),
  R.curry(parseLevelName)(index)
)(level);

exports.getNames = R.pipe(
  R.addIndex(R.map)(getLevelData),
  dropTwoFinishResults
);
