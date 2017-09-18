const request = require('request-promise');
const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const R = require('ramda');
const gameInfoParser = require('./parsers/game-info-parser.js');
const levelNameParser = require('./parsers/level-name-parser.js');
const teamDataParser = require('./parsers/team-data-parser.js');

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

exports.getGameInfo = (domain, gameId) => pageRequest(`http://${domain}/GameDetails.aspx?gid=${gameId}`)
  .then((gameInfoHtml) => R.merge(parseGameInfo(gameInfoHtml), {
    id: gameId,
    domain
  }));

exports.getGameStat = (domain, gameId, gameInfo) => pageRequest(`http://${domain}/GameStat.aspx?gid=${gameId}`)
  .then((gameStatHtml) => parseGameStat(gameStatHtml, gameInfo));
