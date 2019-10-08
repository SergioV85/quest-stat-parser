import { expect } from 'chai';
import { convertStringDuration, getDiff, parseTime, convertTime } from './time.parser';

describe('Time Parser', () => {
  const GAME_TIME_ZONE = 3;
  describe('parseTime', () => {
    it('should return parsed date (with double hours) as JS Date', () => {
      const timeZoneDiff = new Date(2019, 4, 24, 21, 16, 0).getTimezoneOffset() / 60 + GAME_TIME_ZONE;
      const expectedHours = 21 - timeZoneDiff;
      expect(parseTime('24.05.2019 21:16:00.000+03:00')).to.eql(new Date(2019, 4, 24, expectedHours, 16, 0));
    });
    it('should return parsed date (with single hours) as JS Date', () => {
      const timeZoneDiff = new Date(2019, 4, 25, 3, 0, 0).getTimezoneOffset() / 60 + GAME_TIME_ZONE;
      const expectedHours = 3 - timeZoneDiff;
      expect(parseTime('25.05.2019 3:00:00.000+03:00')).to.eql(new Date(2019, 4, 25, expectedHours, 0, 0));
    });
  });
  describe('convertTime', () => {
    it('should return parsed date as ISO string', () => {
      expect(convertTime('24.05.2019 21:16:00.000+03:00')).to.eql(`2019-05-24T18:16:00.000Z`);
    });
    it('should return parsed date as ISO string', () => {
      expect(convertTime('24.05.2019 21:19:35.547+03:00')).to.eql(`2019-05-24T18:19:35.547Z`);
    });
  });
  describe('getDiff', () => {
    it('should return the difference between 2 dates in milliseconds', () => {
      const dateCurrent = new Date(2019, 4, 24, 20, 15, 0);
      const datePrevious = new Date(2019, 4, 24, 20, 14, 0);
      expect(getDiff(dateCurrent, datePrevious)).to.eql(60000);
    });
  });
  describe('convertStringDuration', () => {
    it('should return the number of milliseconds in specific local time request (day, hours, minutes, seconds)', () => {
      expect(convertStringDuration('2 1:5:12')).to.eql(90312000);
    });
    it('should return the number of milliseconds in specific local time request (hours, minutes, seconds)', () => {
      expect(convertStringDuration('1 3:23:47')).to.eql(12227000);
    });
    it('should return the number of milliseconds in specific local time request (minutes, seconds)', () => {
      expect(convertStringDuration('1 0:47:11')).to.eql(2831000);
    });
    it('should return the number of milliseconds in specific local time request (seconds only)', () => {
      expect(convertStringDuration('1 0:0:17')).to.eql(17000);
    });
  });
});
