import {
  anyPass,
  append,
  ascend,
  filter,
  find,
  flatten,
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
  pluck,
  prop,
  propEq,
  reject,
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

import {
  AllowedTimeSymbols,
  GroupedTeamData,
  ParsedGameData,
  TeamData,
  UnaryOperator,
  ParsedGameInfo,
} from './../../../models';
import { convertTime, convertStringDuration } from './../time/time.parser';

const indexedMap = (func: (val: string[], key: string, obj?: unknown) => unknown) => pipe(mapObjIndexed(func), values);

const groupByProperty = (property: keyof TeamData) => (list: TeamData[]): { [idx: number]: TeamData[] } =>
  groupBy(prop(property) as UnaryOperator<TeamData, string>, list);

const getCorrectTimeFromString = (type: AllowedTimeSymbols, strArray: string[]): number =>
  pipe(
    indexOf(type) as UnaryOperator<string[], number>,
    (time: number) => time - 1,
    of,
    (time: number[]) => path(time)(strArray),
    parseInt,
  )(strArray);

const convertStringToTime = (strArray: string[]): number => {
  const days = includes('д', strArray) ? getCorrectTimeFromString('д', strArray) + 1 : 1;
  const hours = includes('ч', strArray) ? getCorrectTimeFromString('ч', strArray) : 0;
  const minutes = includes('м', strArray) ? getCorrectTimeFromString('м', strArray) : 0;
  const seconds = includes('с', strArray) ? getCorrectTimeFromString('с', strArray) : 0;
  return convertStringDuration(`${days} ${hours}:${minutes}:${seconds}`);
};

const parseBonusPenaltyTime = (levelArray: string[], regex: RegExp): number =>
  pipe(find(test(regex)), replace('бонус ', ''), replace('штраф ', ''), split(' '), convertStringToTime)(levelArray);

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

const getTimeoutStatus: (x: string) => boolean = pipe(decode, match(/timeout/g), isEmpty, not);

const getTeamId: (x: string) => number = pipe(match(/tid=\d*/g), head, replace('tid=', ''), parseInt);

const getTeamName: (x: string) => string = pipe(
  decode,
  match(/tid=\d*\W*.*<\/a>/g),
  head,
  match(/>.*?</g),
  head,
  slice(1, -1) as (data: string) => string,
);

const getLevelTime = (rawString: string, gameData: ParsedGameInfo): string =>
  pipe(
    decode,
    match(/(\d{2}.\d{2}.\d{4}|\d{1,2}:\d{2}:\d{2}.\d{3})/g),
    insert(1, ' '),
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
  gameData: ParsedGameInfo,
  rawString: string,
): Partial<TeamData> => ({
  id: getTeamId(rawString),
  levelIdx,
  name: getTeamName(rawString),
  levelTime: getLevelTime(rawString, gameData),
  additionsTime: getBonusPenaltyTime(rawString),
  timeout: getTimeoutStatus(rawString),
});

const assignIndexToLevelData = (idx: number, gameData: ParsedGameInfo, lvl: string[]): Array<Partial<TeamData>> =>
  pipe(
    filter(test(/dataCell/g)) as UnaryOperator<string[], string[]>,
    map((data: string): Partial<TeamData> => convertStringToObject(idx, gameData, data)),
  )(lvl);

const getTeamData = (gameData: ParsedGameInfo, team: string[], idx: string): Array<Partial<TeamData>> =>
  pipe(slice(1, -1), (data: string[]): Array<Partial<TeamData>> => assignIndexToLevelData(+idx, gameData, data))(team);

const calculateSingleLevelDuration = (
  gameData: ParsedGameData,
  level: TeamData,
  list: { [index: number]: TeamData[] },
): TeamData => {
  const matchPrevLevelIdx = propEq('levelIdx', subtract(level.levelIdx as number, 1)) as UnaryOperator<
    TeamData,
    boolean
  >;
  const teamLevels = list[level.id];
  const prevLevel: TeamData | undefined = find(matchPrevLevelIdx)(teamLevels);
  const prevLevelTime: string = isNil(prevLevel) ? gameData.start : prevLevel.levelTime;

  return mergeRight(level, {
    duration: differenceInMilliseconds(parseISO(level.levelTime), parseISO(prevLevelTime)),
  });
};

const calculateLevelsDuration = (gameData: ParsedGameData, list: TeamData[]): TeamData[] => {
  const sortedList: { [index: number]: TeamData[] } = pipe(
    sortBy(prop('levelIdx')) as (data: TeamData[]) => TeamData[],
    groupByProperty('id'),
  )(list);

  return map((level: TeamData) => calculateSingleLevelDuration(gameData, level, sortedList), list);
};

const calculateGameDuration = (gameData: ParsedGameData, level: Partial<TeamData>): TeamData =>
  mergeRight(level, {
    duration: differenceInMilliseconds(parseISO(level.levelTime as string), parseISO(gameData.start)),
  }) as TeamData;

const calculateExtraData = (fullStat: GroupedTeamData[], level: TeamData): TeamData => {
  const teamGameBonus = pipe(
    find(propEq('id', level.id) as UnaryOperator<GroupedTeamData, boolean>) as UnaryOperator<
      GroupedTeamData[],
      GroupedTeamData
    >,
    prop('data') as UnaryOperator<GroupedTeamData, TeamData[]>,
    pluck('additionsTime') as UnaryOperator<TeamData[], number[]>,
    reject(anyPass([isNil, isEmpty])),
    sum,
  )(fullStat);

  const closedLevels = pipe(
    find(propEq('id', level.id) as UnaryOperator<GroupedTeamData, boolean>) as UnaryOperator<
      GroupedTeamData[],
      GroupedTeamData
    >,
    prop('data'),
    length,
  )(fullStat);

  return mergeRight(level, {
    extraBonus: level.additionsTime ? subtract(level.additionsTime, teamGameBonus) : 0,
    closedLevels,
  }) as TeamData;
};

const highlightBestResult = (levelStat: TeamData[]): TeamData[] => {
  const byDuration = ascend(prop('duration'));
  const bestTeam = head(sort(byDuration, levelStat)) as TeamData;
  return map(
    (team) =>
      mergeRight(team, {
        bestTime: team.id === bestTeam.id && !team.timeout,
      }),
    levelStat,
  );
};

const groupByLevel = pipe(groupByProperty('levelIdx'), map(highlightBestResult));

const convertObjToArr = (data: TeamData[], id: string) => ({
  id: parseInt(id, 10),
  data,
});

export const getStat = (stat: string[][], gameData: ParsedGameData): TeamData[] =>
  pipe(
    (indexedMap((data: string[], index: string) => getTeamData(gameData, data, index)) as unknown) as UnaryOperator<
      string[][],
      Array<Array<Partial<TeamData>>>
    >,
    flatten,
    (data: TeamData[]): TeamData[] => calculateLevelsDuration(gameData, data),
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
  mapObjIndexed(convertObjToArr) as UnaryOperator<{ [key: number]: TeamData[] }, { [key: number]: GroupedTeamData }>,
  values as UnaryOperator<{ [key: number]: GroupedTeamData }, GroupedTeamData[]>,
);
export const getFinishResults = (
  stat: string[][],
  gameData: ParsedGameData,
  dataByTeam: GroupedTeamData[],
): TeamData[] =>
  pipe(
    map(slice(1, -1) as (data: string[]) => string[]) as (data: string[][]) => string[][],
    filter(test(/wrapper/g)) as (data: string[][]) => string[][],
    head as (data: string[][]) => string[],
    flatten as (data: string[]) => string[],
    map((data: string): Partial<TeamData> => convertStringToObject(null, gameData, data)) as UnaryOperator<
      string[],
      Array<Partial<TeamData>>
    >,
    map((data: Partial<TeamData>): TeamData => calculateGameDuration(gameData, data)),
    map((data: TeamData): TeamData => calculateExtraData(dataByTeam, data)),
  )(stat);
