import {
  anyPass,
  head,
  isEmpty,
  join,
  mapObjIndexed,
  partition,
  pathOr,
  pipe,
  propSatisfies,
  replace,
  split,
  tail,
  test,
  trim,
  values,
  when,
} from 'ramda';
import { decode } from 'he';
import { LevelData, UnaryOperator } from '../../../models';

const indexedMap = (func: (val: string[], key: string, obj?: unknown) => unknown) => pipe(mapObjIndexed(func), values);

const checkLevelType = (str: string): number => {
  if (anyPass([test(/поиск/giu), test(/пошук/giu)])(str)) {
    return 1;
  }
  if (anyPass([test(/логика/giu), test(/логіка/giu)])(str)) {
    return 2;
  }
  if (anyPass([test(/доезд/giu), test(/доїзд/giu), test(/ралийка/giu)])(str)) {
    return 3;
  }
  if (anyPass([test(/агент/giu)])(str)) {
    return 4;
  }
  if (anyPass([test(/заглушка/giu), test(/бриф/giu)])(str)) {
    return 5;
  }
  if (anyPass([test(/добег/giu), test(/добіг/giu)])(str)) {
    return 7;
  }
  if (anyPass([test(/ралл/giu), test(/ралі/giu)])(str)) {
    return 8;
  }
  if (anyPass([test(/ракет/giu)])(str)) {
    return 10;
  }
  return 0;
};

const checkLevelName = (str: string): string | number => {
  const parsedLevelNumber = parseInt(str, 10);
  return isNaN(parsedLevelNumber) ? str : parsedLevelNumber;
};

const convertNameStringToObject = (index: number, strArray: string[]): LevelData => ({
  level: pipe(head, checkLevelName)(strArray),
  name: pipe(
    tail,
    join(' '),
    replace('<br><span class="dismissed">Уровень снят</span>', ''),
    replace(/<span>\(<a\d*\W*.*<\/span>/g, ''),
    trim,
    when(isEmpty, () => 'Итоговое время'),
  )(strArray),
  position: index,
  type: pipe(join(' '), checkLevelType)(strArray),
  removed: pipe(join(' '), test(/dismissed/g))(strArray),
});

const parseLevelName = (index: number, name: string): LevelData =>
  pipe(decode, split(':'), (data: string[]): LevelData => convertNameStringToObject(index, data))(name);

const dropTwoFinishResults = pipe(
  partition(propSatisfies(isNaN, 'level')),
  ([finalStat, levelStat]: [LevelData[], LevelData[]]) => [...levelStat, head(finalStat)],
) as UnaryOperator<LevelData[], LevelData[]>;

const getLevelData = (level: string[], index: string): LevelData =>
  pipe(
    pathOr('', [0]) as UnaryOperator<string[], string>,
    (data: string): LevelData => parseLevelName(+index, data),
  )(level);

export const getNames: (data: string[][]) => LevelData[] = pipe(
  (indexedMap(getLevelData) as unknown) as UnaryOperator<string[][], LevelData[]>,
  dropTwoFinishResults,
);
