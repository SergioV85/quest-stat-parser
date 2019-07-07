const fs = require('mz/fs');
const R = require('ramda');
const AWS = require('aws-sdk');
const json2csv = require('json2csv').Parser;
const csv2json = require('csvtojson');

const timeParser = require('./parsers/time-parser');

const s3 = new AWS.S3();
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
        time: item => timeParser.convertTime(item),
        isTimeout: item => item === 'true',
        isRemovedLevel: item => item === 'true',
      },
      checkType: true,
    })
      .fromString(csv)
      .then(jsonData => {
        if (!jsonData) {
          reject('CSV to JSON conversion failed!');
        }
        resolve(jsonData);
      });
  });

exports.createLogFile = gameId => {
  const opts = fields + newLine;

  fs.writeFile(`/tmp/monitoring-${gameId}.csv`, opts).catch(err => {
    throw err;
  });
};

exports.saveMonitoringToFile = (gameId, entry) => {
  const json2csvParser = new json2csv({ fields, header: false });
  const csv = json2csvParser.parse(entry) + newLine;

  fs.appendFile(`/tmp/monitoring-${gameId}.csv`, csv).catch(err => {
    throw err;
  });
};

exports.saveMonitoringToS3 = gameId =>
  fs
    .readFile(`/tmp/monitoring-${gameId}.csv`)
    .then(fileBuffer => {
      const params = R.merge(defaultParams, {
        Key: `monitoring-${gameId}`,
        Body: fileBuffer,
      });
      return uploadToS3withPromise(params);
    })
    .then(() => fs.unlink(`/tmp/monitoring-${gameId}.csv`))
    .catch(error => {
      throw error;
    });

exports.parseSavedLogs = gameId => {
  const params = R.merge(defaultParams, {
    Key: `monitoring-${gameId}`,
  });

  return readFromS3withPromise(params).then(response => parseCSV(response.Body.toString('utf-8')));
};
