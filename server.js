const express = require('express');
const request = require('request');
const cheerio = require('cheerio');
const cheerioTableparser = require('cheerio-tableparser');
const app = express();

const parseHtml = (data) => {
  const $ = cheerio.load(data);
  cheerioTableparser($);
  const parsedData = $(".DataTable").parsetable(true, true, true);
  const statOnly = parsedData.slice(1, -3);
  const levelNames = statOnly.map((col) => {
    return col[0];
  });
  const teamStats = statOnly.map((col) => {
    const statByLevel = col.slice(1, -1);
    const lvlStatByTeam = statByLevel.map((teamStatString) => {
      const strWithoutUserName = teamStatString.replace(/\(.*?\)/g,',');
      const arrFromStr = strWithoutUserName.split(',');
      const time = arrFromStr[1] ? `${arrFromStr[1].slice(0, 9)}T${arrFromStr[1].slice(9)}` : null;
      // const hasBonus = arrFromStr[2].indexOf('бонус') > -1;
      // const hasPenalty = arrFromStr[2].indexOf('штраф') > -1;
      return {
        name: arrFromStr[0],
        time,
        additions: arrFromStr[2]
      }
    });
    return lvlStatByTeam;
  });  
  return {
    levelNames,
    teamStats
  };
}

app.get('/games/:gameId', (req, res) => {
  const gameId = req.params.gameId;
  request(`http://quest.ua/GameStat.aspx?gid=${gameId}`, (error, response, body) => {
    const parsedHtml = parseHtml(body);
    res.send(parsedHtml);
  });
});
 
app.listen(4040);