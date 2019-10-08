import { expect } from 'chai';
import { mockedGameStatRawData } from './../../../mocks/games.mock';
import { getStat, getFinishResults, getStatByLevel, getStatByTeam } from './team-data.parser';

describe('Team Stat Parser', () => {
  const gameInfo = {
    start: '2019-05-24T18:16:00.000Z',
    finish: '2019-05-25T00:00:00.000Z',
    timezone: '+03:00',
    name: 'Полювання за пригодами',
    domain: 'rivne.en.cx',
    id: 65527,
  };
  const preparedData = mockedGameStatRawData.slice(1, -1);
  const levelData = getStat(preparedData, gameInfo);
  describe('getStat', () => {
    it('should convert the raw data to list of all team entries', () => {
      expect(levelData.length).to.eql(138);
    });
    it('should convert the raw data to specific format', () => {
      expect(levelData[76]).to.eql({
        additionsTime: 0,
        duration: 186850,
        id: 166156,
        levelIdx: 12,
        levelTime: '2019-05-24T20:09:23.800Z',
        name: 'happykolya',
        timeout: false,
      });
    });
  });
  describe('getStatByTeam', () => {
    const data = getStatByTeam(levelData);
    it('should return grouped data by team', () => {
      expect(data.length).to.eql(6);
    });
    it('should return all entries by one team in raw', () => {
      const teamEntries = data[2];
      expect(teamEntries.id).to.eql(154808);
      expect(teamEntries.data.length).to.eql(23);
    });
  });
  describe('getStatByLevel', () => {
    const data = getStatByLevel(levelData);
    it('should return grouped data by level', () => {
      expect(data.length).to.eql(23);
    });
    it('should return all entries by one team in raw', () => {
      const teamEntries = data[2];
      expect(teamEntries.data.length).to.eql(6);
    });
  });
  describe('getFinishResults', () => {
    const teamData = getStatByTeam(levelData);
    const data = getFinishResults(preparedData, gameInfo, teamData);
    it('should return finish results ', () => {
      expect(data.length).to.eql(6);
    });
    it('should return finish results per team', () => {
      expect(data[2]).to.eql({
        additionsTime: 186000,
        closedLevels: 23,
        duration: 7691980,
        extraBonus: 0,
        id: 154808,
        levelIdx: null,
        levelTime: '2019-05-24T20:24:11.980Z',
        name: 'Dream team best',
        timeout: false,
      });
    });
  });
});
