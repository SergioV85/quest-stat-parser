const R = require('ramda');

const getCorrectAnswers = R.filter(
  R.allPass([
    R.propEq('isSuccess', true),
    R.propEq('isTimeout', false),
    R.propEq('isRemovedLevel', false)
  ])
);

const getCorrectAnswersCount = R.pipe(
  getCorrectAnswers,
  R.length
);

const getEntriesStat = (includeCodes, entriesCollection) => R.map((entries) => ({
  allEntries: entries.length,
  correct: getCorrectAnswersCount(entries),
  percent: (getCorrectAnswersCount(entries) / entries.length) * 100,
  codes: includeCodes ? getCorrectAnswers(entries) : null
}), entriesCollection);

const getTotalStat = R.pipe(
  R.groupBy(R.prop('team')),
  R.curry(getEntriesStat)(false)
);

const getDetailsByTeams = R.pipe(
  R.groupBy(R.prop('team')),
  R.map(R.pipe(
    R.groupBy(R.prop('level')),
    R.values,
    R.curry(getEntriesStat)(true)
  ))
);

exports.calculateTotalMonitoringData = (jsonLogs) => ({
  totalStat: getTotalStat(jsonLogs),
  // byLevels: getTotalStat(jsonLogs),
  byTeams: getDetailsByTeams(jsonLogs)
});
