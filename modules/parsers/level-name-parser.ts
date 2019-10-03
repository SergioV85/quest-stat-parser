import {
  addIndex,
  anyPass,
  append,
  complement,
  curry,
  filter,
  head,
  isEmpty,
  join,
  map,
  pathOr,
  pipe,
  replace,
  split,
  tail,
  test,
  trim,
  when,
} from 'ramda';
import he from 'he';

const checkLevelType = string => {
  if (anyPass([test(/поиск/giu), test(/пошук/giu)])(string)) {
    return 1;
  }
  if (anyPass([test(/логика/giu), test(/логіка/giu)])(string)) {
    return 2;
  }
  if (anyPass([test(/доезд/giu), test(/доїзд/giu), test(/ралийка/giu)])(string)) {
    return 3;
  }
  if (anyPass([test(/агент/giu)])(string)) {
    return 4;
  }
  if (anyPass([test(/заглушка/giu), test(/бриф/giu)])(string)) {
    return 5;
  }
  return 0;
};

const checkLevelName = string => {
  const parsedLevelNumber = parseInt(string, 10);
  return typeof parsedLevelNumber !== 'number' ? string : parsedLevelNumber;
};

const convertNameStringToObject = (index, strArray) => ({
  level: pipe(
    head,
    checkLevelName
  )(strArray),
  name: pipe(
    tail,
    join(' '),
    replace('<br><span class="dismissed">Уровень снят</span>', ''),
    replace(/<span>\(<a\d*\W*.*<\/span>/g, ''),
    trim,
    when(isEmpty, () => 'Итоговое время')
  )(strArray),
  position: index,
  type: pipe(
    join(' '),
    checkLevelType
  )(strArray),
  removed: pipe(
    join(' '),
    test(/dismissed/g)
  )(strArray),
});

const parseLevelName = (index: number, name: string) =>
  pipe(
    he.decode,
    split(':'),
    curry(convertNameStringToObject)(index)
  )(name);

const dropTwoFinishResults = data => {
  const isStatLevel = level => typeof level.level !== 'number';
  return append(
    pipe(
      filter(isStatLevel),
      head
    )(data),
    filter(complement(isStatLevel))(data)
  );
};

const getLevelData = (level, index) =>
  pipe(
    pathOr([], [0]),
    curry(parseLevelName)(index)
  )(level);

export const getNames = pipe(
  addIndex(map)(getLevelData),
  dropTwoFinishResults
);
