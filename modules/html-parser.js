const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const R = require('ramda');
const levelNameParser = require('./level-name-parser.js');
const teamDataParser = require('./team-data-parser.js');

const removeObsoleteData = (rawData) => R.slice(1, -3, rawData);

exports.parseHtml = (data) => {
    const $ = cheerio.load(data);
    cheerioTableparser($);
    const parsedData = $('.DataTable').parsetable(true, true, true);
    const statOnly = removeObsoleteData(parsedData);
    return {
      levels: levelNameParser.getNames(statOnly),
      teamData: teamDataParser.getTeamData(statOnly)
    };
  };