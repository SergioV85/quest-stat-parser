import { filter, allPass, propEq, pipe, length, map, groupBy, prop, curry, values } from 'ramda';
import { CodeEntry } from '../../../models';

const groupByProperty = (property: keyof CodeEntry | 'team') => (list: CodeEntry[]): { [idx: number]: CodeEntry[] } =>
  // tslint:disable-next-line: no-any
  groupBy(prop(property) as any, list);

const getCorrectAnswers: (codes: CodeEntry[]) => CodeEntry[] = filter(
  allPass([propEq('isSuccess', true), propEq('isTimeout', false), propEq('isRemovedLevel', false)]),
);

const getCorrectAnswersCount: (codes: CodeEntry[]) => number = pipe(
  getCorrectAnswers,
  length,
);

const getEntriesStat = (includeCodes: boolean, entriesCollection: CodeEntry[][]) =>
  map(
    entries => ({
      allEntries: entries.length,
      correct: getCorrectAnswersCount(entries),
      percent: (getCorrectAnswersCount(entries) / entries.length) * 100,
      codes: includeCodes ? getCorrectAnswers(entries) : null,
    }),
    entriesCollection,
  );

const getTotalStat = pipe(
  groupByProperty('team'),
  curry(getEntriesStat)(false),
);

const getDetailsByTeams = pipe(
  groupByProperty('team'),
  map(
    pipe(
      groupByProperty('level'),
      values,
      curry(getEntriesStat)(true),
    ),
  ),
);

// tslint:disable-next-line: no-any
export const calculateTotalMonitoringData = (jsonLogs: any) => ({
  totalStat: getTotalStat(jsonLogs),
  // byLevels: getTotalStat(jsonLogs),
  byTeams: getDetailsByTeams(jsonLogs),
});
