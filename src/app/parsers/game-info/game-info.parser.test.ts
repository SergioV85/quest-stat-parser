import { expect } from 'chai';
import { mockedGameRawData } from './../../../mocks/games.mock';
import { getGameInfo } from './game-info.parser';

const expectedResult = {
  start: '2019-05-24T20:16:00+02:00',
  finish: '2019-05-25T03:00:00+02:00',
  timezone: '+03:00',
  name: 'Полювання за пригодами',
  id: 65527,
  domain: 'rivne.en.cx',
};

describe('Game Info Parser', () => {
  describe('getGameInfo', () => {
    it('should return parsed JSON', () => {
      expect(getGameInfo(mockedGameRawData)).to.eql(expectedResult);
    });
  });
});
