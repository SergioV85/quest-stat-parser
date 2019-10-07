import { parse, differenceInMilliseconds } from 'date-fns';

export const parseTime = (str: string) => parse(str, 'd.M.yyyy H:mm:ssXXXXX', new Date());
export const convertTime = (str: string) => parseTime(str).toISOString();
export const getDiff = (currTime: Date, oldTime: Date): number => differenceInMilliseconds(currTime, oldTime);
export const convertStringDuration = (str: string): number => {
  const startDate = new Date(Date.UTC(2019, 0, 1, 0, 0, 0, 0));
  const convertedDate = parse(`${str}Z`, 'D H:m:sX', startDate, { useAdditionalDayOfYearTokens: true });
  return differenceInMilliseconds(convertedDate, startDate);
};
