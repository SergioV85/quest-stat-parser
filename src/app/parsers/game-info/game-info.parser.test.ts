import { expect } from 'chai';
import { mockedGameRawData } from './../../../mocks/games.mock';
import { getGameInfo } from './game-info.parser';

const expectedResult = {
  start: '2019-05-24T18:16:00.000Z',
  finish: '2019-05-25T00:00:00.000Z',
  timezone: '+03:00',
  name: 'Полювання за пригодами',
};

describe('Game Info Parser', () => {
  describe('getGameInfo', () => {
    it('should return parsed JSON', () => {
      expect(getGameInfo(mockedGameRawData)).to.eql(expectedResult);
    });
  });
});
