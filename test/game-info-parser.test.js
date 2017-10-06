const chai = require('chai');
const mockedGame = require('./../mock-data/game-info-parser.mock');
const gameInfoParser = require('./../modules/parsers/game-info-parser');

const expect = chai.expect;

const expectedResult = {
  finish: '2017-08-14T03:00:00+02:00',
  name: 'QLiga "Ох" (Этап Лиги Квеста 2017 в г. Луцк)',
  start: '2017-08-12T07:30:00+02:00',
  timezone: '+03:00',
};

describe('Game Info Parser Module', () => {
  describe('getGameInfo', () => {
    it('should return parsed JSON', () => {
      expect(gameInfoParser.getGameInfo(mockedGame.mockData)).to.eql(expectedResult);
    });
  });
});
