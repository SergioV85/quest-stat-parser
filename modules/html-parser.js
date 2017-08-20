const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const R = require('ramda');
const gameInfoParser = require('./game-info-parser.js');
const levelNameParser = require('./level-name-parser.js');
const teamDataParser = require('./team-data-parser.js');

const removeObsoleteData = (rawData) => R.slice(1, -3, rawData);

exports.parseGameInfo = (data) => {
  const $ = cheerio.load(data);
  cheerioTableparser($);
  const parsedData = $('.gameInfo').parsetable(true, true, false);
  return gameInfoParser.getGameInfo(parsedData);
};

exports.parseGameStat = (data) => {
  const $ = cheerio.load(data);
  cheerioTableparser($);
  const parsedData = $('.DataTable').parsetable(true, true, false);
  const statOnly = removeObsoleteData(parsedData);
  return {
    levels: levelNameParser.getNames(statOnly),
    teamData: teamDataParser.getTeamData(statOnly)
  };
};
