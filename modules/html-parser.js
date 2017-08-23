const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const R = require('ramda');
const gameInfoParser = require('./game-info-parser.js');
const levelNameParser = require('./level-name-parser.js');
const teamDataParser = require('./team-data-parser.js');

const removeObsoleteData = (rawData) => R.slice(1, -2, rawData);

exports.parseGameInfo = (data) => {
  const $ = cheerio.load(data);
  cheerioTableparser($);
  const parsedData = $('.gameInfo').parsetable(true, true, false);
  return gameInfoParser.getGameInfo(parsedData);
};

exports.parseGameStat = (data, gameInfo) => {
  const $ = cheerio.load(data);
  cheerioTableparser($);
  const parsedData = $('.DataTable').parsetable(true, true, false);
  const statOnly = removeObsoleteData(parsedData);
  const levelsData = teamDataParser.getStat(statOnly, gameInfo);
  return {
    levels: levelNameParser.getNames(statOnly),
    dataByTeam: teamDataParser.getStatByTeam(levelsData),
    dataByLevels: teamDataParser.getStatByLevel(levelsData),
    finishResults: teamDataParser.getFinishResults(statOnly, gameInfo)
  };
};
