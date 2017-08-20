const moment = require('moment');

exports.convertTime = (str) => moment(str, 'DD.MM.YYYY HH:mm:ss Z').format();
