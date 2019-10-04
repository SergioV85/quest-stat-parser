import {
  addIndex,
  append,
  ascend,
  curry,
  filter,
  find,
  flatten,
  flip,
  groupBy,
  head,
  includes,
  indexOf,
  insert,
  isEmpty,
  isNil,
  join,
  length,
  map,
  mapObjIndexed,
  match,
  mergeRight,
  negate,
  not,
  of,
  path,
  pathOr,
  pipe,
  prop,
  propEq,
  replace,
  slice,
  sort,
  sortBy,
  split,
  subtract,
  sum,
  test,
  values,
} from 'ramda';
import { decode } from 'he';
import { parseISO, differenceInMilliseconds } from 'date-fns';

import { AllowedTimeSymbols, GroupedTeamData, ParsedGameData, TeamData } from './../../../models';
import { convertTime, convertStringDuration } from './../time/time.parser';

const groupByProperty = (property: keyof TeamData) => (list: TeamData[]): { [idx: number]: TeamData[] } =>
  // tslint:disable-next-line: no-any
  groupBy(prop(property) as any, list);

const getCorrectTimeFromString = (type: AllowedTimeSymbols, strArray: string[]): number =>
  pipe(
    indexOf(type) as (data: string[]) => number,
    flip(subtract)(1),
    of,
    flip(path)(strArray),
    parseInt,
  )(strArray);

const convertStringToTime = (strArray: string[]): number => {
  const days = includes('д', strArray) ? getCorrectTimeFromString('д', strArray) : 0;
  const hours = includes('ч', strArray) ? getCorrectTimeFromString('ч', strArray) : 0;
  const minutes = includes('м', strArray) ? getCorrectTimeFromString('м', strArray) : 0;
  const seconds = includes('с', strArray) ? getCorrectTimeFromString('с', strArray) : 0;
  return convertStringDuration(`${days} ${hours}:${minutes}:${seconds}`);
};

const parseBonusPenaltyTime = (levelArray: string[], regex: RegExp): number =>
  pipe(
    find(test(regex)),
    replace('бонус ', ''),
    replace('штраф ', ''),
    split(' '),
    convertStringToTime,
  )(levelArray);

const getBonusesPenaltiesTime = (levelArray: string[]): number => {
  if (find(test(/бонус/))(levelArray)) {
    const bonusRegex = new RegExp(/бонус/);
    return parseBonusPenaltyTime(levelArray, bonusRegex);
  }
  if (find(test(/штраф/))(levelArray)) {
    const penaltyRegex = new RegExp(/штраф/);
    return negate(parseBonusPenaltyTime(levelArray, penaltyRegex));
  }
  return 0;
};

const getTimeoutStatus: (x: string) => boolean = pipe(
  decode,
  match(/timeout/g),
  isEmpty,
  not,
);

const getTeamId: (x: string) => number = pipe(
  match(/tid=\d*/g),
  head,
  replace('tid=', ''),
  parseInt,
);

const getTeamName: (x: string) => string = pipe(
  decode,
  match(/tid=\d*\W*.*<\/a>/g),
  head,
  match(/>.*?</g),
  head,
  slice(1, -1) as (data: string) => string,
);

const getLevelTime = (rawString: string, gameData: ParsedGameData): string =>
  pipe(
    decode,
    match(/(\d{2}.\d{2}.\d{4}|\d{2}:\d{2}:\d{2}.\d{3})/g),
    insert(1, 'T'),
    append(pathOr('Z', ['timezone'], gameData)),
    join(''),
    convertTime,
  )(rawString);

const getBonusPenaltyTime: (x: string) => number = pipe(
  decode,
  match(/(бонус|штраф)[а-яА-Я0-9 ]*/g),
  getBonusesPenaltiesTime,
);

const convertStringToObject = (
  levelIdx: number | null,
  gameData: ParsedGameData,
  rawString: string,
): Partial<TeamData> => ({
  id: getTeamId(rawString),
  levelIdx,
  name: getTeamName(rawString),
  levelTime: getLevelTime(rawString, gameData),
  additionsTime: getBonusPenaltyTime(rawString),
  timeout: getTimeoutStatus(rawString),
});

const assignIndexToLevelData = (idx: number, gameData: ParsedGameData, lvl: string[]) =>
  pipe(
    filter(test(/dataCell/g)) as (data: string[]) => string[],
    map(curry(convertStringToObject)(idx, gameData)),
  )(lvl);

const getTeamData = (gameData: ParsedGameData, team: string[], idx: number) =>
  pipe(
    slice(1, -1),
    curry(assignIndexToLevelData)(idx, gameData),
  )(team);

const calculateSingleLevelDuration = (
  gameData: ParsedGameData,
  level: TeamData,
  list: { [index: number]: TeamData[] },
): TeamData => {
  const matchPrevLevelIdx = propEq('levelIdx', subtract(level.levelIdx as number, 1));
  const prevLevel = find(matchPrevLevelIdx)(list[level.id]);
  const prevLevelTime = isNil(prevLevel) ? gameData.start : prevLevel.levelTime;

  return mergeRight(level, {
    duration: differenceInMilliseconds(parseISO(level.levelTime), parseISO(prevLevelTime)),
  });
};

const calculateLevelsDuration = (gameData: ParsedGameData, list: TeamData[]) => {
  const sortedList: { [index: number]: TeamData[] } = pipe(
    sortBy(prop('levelIdx')) as (data: TeamData[]) => TeamData[],
    groupByProperty('id'),
  )(list);

  return map(level => calculateSingleLevelDuration(gameData, level, sortedList), list);
};

const calculateGameDuration = (gameData: ParsedGameData, level: Partial<TeamData>): TeamData =>
  mergeRight(level, {
    duration: differenceInMilliseconds(parseISO(level.levelTime as string), parseISO(gameData.start)),
  }) as TeamData;

const calculateExtraData = (fullStat: GroupedTeamData[], level: TeamData): TeamData => {
  const teamGameBonus = pipe(
    find(propEq('id', level.id)),
    prop('data'),
    map(pathOr(0, ['additionsTime'])),
    sum,
  )(fullStat);

  const closedLevels = pipe(
    find(propEq('id', level.id)),
    prop('data'),
    length,
  )(fullStat);

  return mergeRight(level, {
    extraBonus: level.additionsTime ? subtract(level.additionsTime, teamGameBonus) : 0,
    closedLevels,
  });
};

const highlightBestResult = (levelStat: TeamData[]): TeamData[] => {
  const byDuration = ascend(prop('duration'));
  const bestTeam = head(sort(byDuration, levelStat));
  return map(
    team =>
      mergeRight(team, {
        bestTime: team.id === bestTeam.id && !team.timeout,
      }),
    levelStat,
  );
};

const groupByLevel = pipe(
  groupByProperty('levelIdx'),
  map(highlightBestResult),
);

const convertObjToArr = (data: TeamData[], id: string) => ({
  id: parseInt(id, 10),
  data,
});

export const getStat = (stat: string[][], gameData: ParsedGameData) =>
  pipe(
    addIndex(map)(curry(getTeamData)(gameData)),
    flatten,
    curry(calculateLevelsDuration)(gameData),
  )(stat);

export const getStatByTeam: (data: TeamData[]) => GroupedTeamData[] = pipe(
  groupByLevel,
  values,
  flatten as (data: TeamData[][]) => TeamData[],
  groupByProperty('id'),
  mapObjIndexed(convertObjToArr),
  values,
);

export const getStatByLevel: (data: TeamData[]) => GroupedTeamData[] = pipe(
  groupByLevel,
  mapObjIndexed(convertObjToArr),
  values,
);
export const getFinishResults = (stat: string[][], gameData: ParsedGameData, dataByTeam: GroupedTeamData[]) =>
  pipe(
    map(slice(1, -1) as (data: string[]) => string[]) as (data: string[][]) => string[][],
    filter(test(/wrapper/g)) as (data: string[][]) => string[][],
    head as (data: string[][]) => string[],
    flatten as (data: string[]) => string[],
    // tslint:disable-next-line: no-any
    map(curry(convertStringToObject)(null as any, gameData) as (data: string) => Partial<TeamData>) as (
      data: string[],
    ) => Array<Partial<TeamData>>,
    map(curry(calculateGameDuration)(gameData)),
    map(curry(calculateExtraData)(dataByTeam)),
  )(stat);
