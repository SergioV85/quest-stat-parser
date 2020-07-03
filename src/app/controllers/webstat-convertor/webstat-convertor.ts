import { load } from 'cheerio';
import * as cheerioTableparser from 'cheerio-tableparser';
import * as request from 'request-promise';
import { slice, isNil, mergeRight } from 'ramda';
import { timesSeries } from 'async';
import { CheerioTable, ParsedGameInfo, ParsedGameData, ParsedGameStat, CodeEntry } from './../../../models';
import {
  getFinishResults,
  getGameInfo as parsedGameInfo,
  getNames,
  getStat,
  getStatByLevel,
  getStatByTeam,
  parseRawMonitoringData,
} from './../../parsers';
import { saveMonitoringData, setMonitoringStatus } from './../database-connection/database-connection';

request.defaults({ jar: true });

const removeObsoleteData = (rawData: string[][]) => slice(1, -1, rawData);

const pageRequest = async (uri: string): Promise<CheerioStatic> =>
  request({
    uri,
    transform: (body) => load(body),
  });

const parseGameInfo = ($: CheerioStatic): ParsedGameInfo => {
  cheerioTableparser($);
  const parsedData: string[][] = ($('.gameInfo') as CheerioTable).parsetable(true, true, false);
  return parsedGameInfo(parsedData);
};

const parseGameStat = ($: CheerioStatic, gameInfo: ParsedGameData): ParsedGameStat => {
  cheerioTableparser($);
  const parsedData: string[][] = ($('.DataTable') as CheerioTable).parsetable(true, true, false);
  const statOnly = removeObsoleteData(parsedData);
  const levelsData = getStat(statOnly, gameInfo);
  const levels = getNames(statOnly);
  const dataByTeam = getStatByTeam(levelsData);
  const dataByLevels = getStatByLevel(levelsData);
  const finishResults = getFinishResults(statOnly, gameInfo, dataByTeam);

  return {
    levels,
    dataByTeam,
    dataByLevels,
    finishResults,
  };
};

const parseMonitoringInfo = ($: CheerioStatic) => $('form').siblings('div').children('a').last().text();

const parseMonitoringData = ($: CheerioStatic) => {
  cheerioTableparser($);
  const tableData = ($('form > table > tbody').children().last().find('table') as CheerioTable).parsetable(
    true,
    true,
    false,
  );
  return parseRawMonitoringData(tableData);
};

const loginToEncounter = async (domain: string): Promise<void> =>
  request({
    method: 'POST',
    url: `http://${domain}/login/signin`,
    formData: {
      Login: process.env.EN_LOGIN,
      Password: process.env.EN_PASSWORD,
    },
    followAllRedirects: true,
  });
const requestMonitoringPage = async (domain: string, gameId: number, page = 1): Promise<CheerioStatic> =>
  request({
    method: 'GET',
    url: `http://${domain}/ALoader/GameLoader.aspx`,
    qs: {
      gid: gameId,
      page,
      item: 0,
      rnd: Math.random(),
    },
    transform: (body) => load(body),
  });

const getMonitoringData = (domain: string, gameId: number, i: number): Promise<void> =>
  requestMonitoringPage(domain, gameId, i)
    .then(parseMonitoringData)
    .then((parsedData: CodeEntry[]) => saveMonitoringData(gameId, parsedData))
    .then(() => setMonitoringStatus(gameId, { pageSaved: i }));

const getMonitoring = (domain: string, gameId: number, numberOfPages: string) => {
  const totalPages = parseInt(numberOfPages, 10);
  void setMonitoringStatus(gameId, { parsed: false, totalPages });

  timesSeries(
    totalPages,
    (i: number, next) => {
      setTimeout(() => {
        getMonitoringData(domain, gameId, i + 1)
          .then(() => next(null))
          .catch((err) => next(err));
      }, 1000);
    },
    (err: Error | null) => {
      if (isNil(err)) {
        void setMonitoringStatus(gameId, { parsed: true });
      } else {
        void setMonitoringStatus(gameId, { parsed: false, gotError: true, error: err });
      }
    },
  );

  return {
    parsed: false,
    totalPages,
    parsedPages: 1,
  };
};

export const getGameInfo = async (domain: string, gameId: number): Promise<ParsedGameData> => {
  const gameInfoHtml: CheerioStatic = await pageRequest(`http://${domain}/GameDetails.aspx?gid=${gameId}`);
  return mergeRight(parseGameInfo(gameInfoHtml), {
    id: gameId,
    domain,
  }) as ParsedGameData;
};

export const getGameStat = async (
  domain: string,
  gameId: number,
  gameInfo: ParsedGameData,
): Promise<ParsedGameStat> => {
  const gameStatHtml: CheerioStatic = await pageRequest(`http://${domain}/GameStat.aspx?gid=${gameId}`);
  return parseGameStat(gameStatHtml, gameInfo);
};

export const retrieveGameMonitoring = async (
  domain: string,
  gameId: number,
): Promise<{
  parsed: boolean;
  totalPages: number;
  parsedPages: number;
}> => {
  await loginToEncounter(domain);
  const rawData = await requestMonitoringPage(domain, gameId);
  const numberOfPages = parseMonitoringInfo(rawData);
  return getMonitoring(domain, gameId, numberOfPages);
};
