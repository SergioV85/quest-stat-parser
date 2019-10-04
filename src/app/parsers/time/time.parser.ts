import { parse, differenceInMilliseconds } from 'date-fns';

export const parseTime = (str: string) => parse(str, 'DD.MM.YYYY HH:mm:ss Z', new Date());
export const convertTime = (str: string) => parseTime(str).toISOString();
export const getDiff = (currTime: Date, oldTime: Date): number => differenceInMilliseconds(currTime, oldTime);
export const convertStringDuration = (str: string): number => {
  const defaultDate = new Date(2019, 0, 1, 0, 0, 0, 0);
  const convertedDate = parse(str, 'd H:m:s', defaultDate);
  return differenceInMilliseconds(convertedDate, defaultDate);
};
