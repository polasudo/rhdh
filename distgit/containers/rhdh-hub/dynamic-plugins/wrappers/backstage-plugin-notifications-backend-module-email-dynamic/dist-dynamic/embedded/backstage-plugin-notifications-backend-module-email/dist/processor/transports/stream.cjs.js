'use strict';

var nodemailer = require('nodemailer');

const createStreamTransport = () => {
  return nodemailer.createTransport({ streamTransport: true });
};

exports.createStreamTransport = createStreamTransport;
//# sourceMappingURL=stream.cjs.js.map
