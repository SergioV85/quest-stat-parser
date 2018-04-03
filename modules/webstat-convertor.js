const request = require('request-promise').defaults({ jar: true });
const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const R = require('ramda');
const async = require('async');
const databaseConnector = require('./database-connection.js');
const gameInfoParser = require('./parsers/game-info-parser.js');
const levelNameParser = require('./parsers/level-name-parser.js');
const teamDataParser = require('./parsers/team-data-parser.js');
const monitoringParser = require('./parsers/monitoring-parser.js');

const removeObsoleteData = (rawData) => R.slice(1, -1, rawData);

const pageRequest = (uri) => request({
  uri,
  transform: (body) => cheerio.load(body)
});

const parseGameInfo = ($) => {
  cheerioTableparser($);
  const parsedData = $('.gameInfo').parsetable(true, true, false);
  return gameInfoParser.getGameInfo(parsedData);
};

const parseGameStat = ($, gameInfo) => {
  cheerioTableparser($);
  const parsedData = $('.DataTable').parsetable(true, true, false);
  const statOnly = removeObsoleteData(parsedData);
  const levelsData = teamDataParser.getStat(statOnly, gameInfo);
  let levels;
  let dataByTeam;
  let dataByLevels;
  let finishResults;
  try {
    levels = levelNameParser.getNames(statOnly);
  } catch (err) {
    throw err;
  }
  try {
    dataByTeam = teamDataParser.getStatByTeam(levelsData);
  } catch (err) {
    throw err;
  }
  try {
    dataByLevels = teamDataParser.getStatByLevel(levelsData);
  } catch (err) {
    throw err;
  }
  try {
    finishResults = teamDataParser.getFinishResults(statOnly, gameInfo, dataByTeam);
  } catch (err) {
    throw err;
  }
  return {
    levels,
    dataByTeam,
    dataByLevels,
    finishResults
  };
};

const parseMonitoringInfo = ($) => {
  const lastPage = $('form').siblings('div')
    .children('a')
    .last()
    .text();
  return lastPage;
};

const parseMonitoringData = ($) => {
  cheerioTableparser($);
  const tableData = $('form > table > tbody')
    .children()
    .last()
    .find('table')
    .parsetable(true, true, false);
  return monitoringParser.getMonitoringData(tableData);
};

const loginToEncounter = (domain) => request({
  method: 'POST',
  url: `http://${domain}/login/signin`,
  formData: {
    Login: process.env.EN_LOGIN,
    Password: process.env.EN_PASSWORD
  },
  followAllRedirects: true
});
const getMonitoringPage = (domain, gameId, page = 1) => request({
  method: 'GET',
  url: `http://${domain}/ALoader/GameLoader.aspx`,
  qs: {
    gid: gameId,
    page,
    item: 0,
    rnd: Math.random()
  },
  transform: (body) => cheerio.load(body)
});

const getMonitoring = (domain, gameId, numberOfPages) => {
  const asyncRequests = [];
  databaseConnector.setMonitoringStatus(gameId, { parsed: false });

  for (let i = 1; i < numberOfPages; i++) {
    const requestFunc = (callback) => {
      getMonitoringPage(domain, gameId, i)
        .then((rawData) => {
          const parsedData = parseMonitoringData(rawData);
          databaseConnector.saveMonitoringData(gameId, parsedData);
          return callback(null);
        }, (error) => callback(error));
    };
    asyncRequests.push(requestFunc);
  }

  const finishExecution = () => {
    databaseConnector.setMonitoringStatus(gameId, { parsed: true });
  };

  async.parallelLimit(asyncRequests, 10, finishExecution);

  return {
    parsed: false
  };
};

exports.getGameInfo = (domain, gameId) => pageRequest(`http://${domain}/GameDetails.aspx?gid=${gameId}`)
  .then((gameInfoHtml) => R.merge(parseGameInfo(gameInfoHtml), {
    id: gameId,
    domain
  }));

exports.getGameStat = (domain, gameId, gameInfo) => pageRequest(`http://${domain}/GameStat.aspx?gid=${gameId}`)
  .then((gameStatHtml) => parseGameStat(gameStatHtml, gameInfo));

exports.retrieveGameMonitoring = (domain, gameId) => loginToEncounter(domain)
  .then(() => getMonitoringPage(domain, gameId))
  .then((rawData) => parseMonitoringInfo(rawData))
  .then((numberOfPages) => getMonitoring(domain, gameId, numberOfPages))
  .catch((error) => {
    throw error;
  });
