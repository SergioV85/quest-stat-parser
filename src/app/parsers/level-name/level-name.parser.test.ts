import { expect } from 'chai';
import { mockedGameStatRawData } from './../../../mocks/games.mock';
import { getNames } from './level-name.parser';

describe('Level Names Parser', () => {
  const preparedData = mockedGameStatRawData.slice(1, -1);
  const resultedData = getNames(preparedData);
  describe('getNames', () => {
    it('should convert all columns to levels', () => {
      expect(resultedData.length).to.eql(24);
    });
    describe('detect level type', () => {
      it('should detect level type "Поиск" from the name', () => {
        expect(resultedData[5]).to.eql({
          level: 6,
          name: 'пошук-логіка',
          position: 5,
          removed: false,
          type: 1,
        });
      });
      it('should detect level type "Логика" from the name', () => {
        expect(resultedData[1]).to.eql({
          level: 2,
          name: 'Логіка',
          position: 1,
          removed: false,
          type: 2,
        });
      });
      it('should detect level type "Доезд" from the name', () => {
        const rawData = [
          '8: &#x434;&#x43E;&#x457;&#x437;&#x434; &#x434;&#x43E; &#x43A;&#x456;&#x43D;&#x43E;&#x43F;&#x430;&#x43B;&#x430;&#x446;&#x443;',
        ];
        const convertedData = getNames([rawData]);
        expect(convertedData[0]).to.eql({
          level: 8,
          name: 'доїзд до кінопалацу',
          position: 0,
          removed: false,
          type: 3,
        });
      });
      it('should detect level type "Агент" from the name', () => {
        const rawData = [
          '10: &#x430;&#x433;&#x435;&#x43D;&#x442; &#x43D;&#x430; &#x43A;&#x456;&#x43D;&#x43E;&#x43F;&#x430;&#x43B;&#x430;&#x446;&#x456;',
        ];
        const convertedData = getNames([rawData]);
        expect(convertedData[0]).to.eql({
          level: 10,
          name: 'агент на кінопалаці',
          position: 0,
          removed: false,
          type: 4,
        });
      });
      it('should detect level type "Заглушка" from the name', () => {
        expect(resultedData[6]).to.eql({
          level: 7,
          name: 'заглушка повернутися в авто',
          position: 6,
          removed: false,
          type: 5,
        });
      });
      it('should detect level type "Добег" from the name', () => {
        expect(resultedData[4]).to.eql({
          level: 5,
          name: 'добіг',
          position: 4,
          removed: false,
          type: 7,
        });
      });
      it('should detect level type "Раллийка" from the name', () => {
        const rawData = [
          '22: &#x440;&#x430;&#x43B;&#x43B;&#x456; &#x43F;&#x43E; &#x431;&#x430;&#x43D;&#x434;&#x435;&#x440;&#x438;',
        ];
        const convertedData = getNames([rawData]);
        expect(convertedData[0]).to.eql({
          level: 22,
          name: 'раллі по бандери',
          position: 0,
          removed: false,
          type: 8,
        });
      });
      it('should detect level type "Ракеты" from the name', () => {
        const rawData = ['16: &#x440;&#x430;&#x43A;&#x435;&#x442;&#x438; 1'];
        const convertedData = getNames([rawData]);
        expect(convertedData[0]).to.eql({
          level: 16,
          name: 'ракети 1',
          position: 0,
          removed: false,
          type: 10,
        });
      });
    });
    it('should detect removed levels', () => {
      expect(resultedData[17]).to.eql({
        level: 18,
        name: 'Чорновола 12А',
        position: 17,
        removed: true,
        type: 0,
      });
    });
  });
});
