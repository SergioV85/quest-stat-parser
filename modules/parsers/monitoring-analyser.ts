import { filter, allPass, propEq, pipe, length, map, groupBy, prop, curry, values } from 'ramda';

const getCorrectAnswers = filter(
  allPass([propEq('isSuccess', true), propEq('isTimeout', false), propEq('isRemovedLevel', false)])
);

const getCorrectAnswersCount = pipe(
  getCorrectAnswers,
  length
);

const getEntriesStat = (includeCodes, entriesCollection) =>
  map(
    entries => ({
      allEntries: entries.length,
      correct: getCorrectAnswersCount(entries),
      percent: (getCorrectAnswersCount(entries) / entries.length) * 100,
      codes: includeCodes ? getCorrectAnswers(entries) : null,
    }),
    entriesCollection
  );

const getTotalStat = pipe(
  groupBy(prop('team')),
  curry(getEntriesStat)(false)
);

const getDetailsByTeams = pipe(
  groupBy(prop('team')),
  map(
    pipe(
      groupBy(prop('level')),
      values,
      curry(getEntriesStat)(true)
    )
  )
);

export const calculateTotalMonitoringData = jsonLogs => ({
  totalStat: getTotalStat(jsonLogs),
  // byLevels: getTotalStat(jsonLogs),
  byTeams: getDetailsByTeams(jsonLogs),
});

export const getGameMonitoringData = () => {};
