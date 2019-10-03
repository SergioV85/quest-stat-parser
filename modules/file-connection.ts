import { writeFile, appendFile, readFile, unlink } from 'mz/fs';
import { merge } from 'ramda';
import { S3 } from 'aws-sdk';
import { Parser as Json2csv } from 'json2csv';
import csv2json from 'csvtojson';

import { convertTime } from './parsers/time-parser';

const s3 = new S3();
const defaultParams = {
  Bucket: 'quest-monitoring-data',
};

const fields = ['level', 'team', 'user', 'isSuccess', 'code', 'time', 'isTimeout', 'isRemovedLevel'];
const newLine = '\r\n';

const uploadToS3withPromise = params => s3.putObject(params).promise();
const readFromS3withPromise = params => s3.getObject(params).promise();

const parseCSV = csv =>
  new Promise((resolve, reject) => {
    csv2json({
      colParser: {
        level: 'numer',
        team: 'string',
        user: 'string',
        isSuccess: item => item === 'true',
        code: 'string',
        time: item => convertTime(item),
        isTimeout: item => item === 'true',
        isRemovedLevel: item => item === 'true',
      },
      checkType: true,
    })
      .fromString(csv)
      .then(jsonData => {
        if (!jsonData) {
          reject(new Error('CSV to JSON conversion failed!'));
        }
        resolve(jsonData);
      });
  });

export const createLogFile = gameId => {
  const opts = fields + newLine;

  writeFile(`/tmp/monitoring-${gameId}.csv`, opts).catch(err => {
    throw err;
  });
};

export const saveMonitoringToFile = (gameId, entry) => {
  const json2csvParser = new Json2csv({ fields, header: false });
  const csv = json2csvParser.parse(entry) + newLine;

  appendFile(`/tmp/monitoring-${gameId}.csv`, csv).catch(err => {
    throw err;
  });
};

export const saveMonitoringToS3 = async gameId => {
  const fileBuffer = await readFile(`/tmp/monitoring-${gameId}.csv`);
  const params = merge(defaultParams, {
    Key: `monitoring-${gameId}`,
    Body: fileBuffer,
  });
  await uploadToS3withPromise(params);
  return unlink(`/tmp/monitoring-${gameId}.csv`);
};

export const parseSavedLogs = async gameId => {
  const params = merge(defaultParams, {
    Key: `monitoring-${gameId}`,
  });

  const response = await readFromS3withPromise(params);
  return parseCSV(response.Body.toString('utf-8'));
};
