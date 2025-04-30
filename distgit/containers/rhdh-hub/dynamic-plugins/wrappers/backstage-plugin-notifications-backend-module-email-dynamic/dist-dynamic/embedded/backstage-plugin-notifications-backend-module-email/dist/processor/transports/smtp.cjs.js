'use strict';

var nodemailer = require('nodemailer');

const createSmtpTransport = (config) => {
  const username = config.getOptionalString("username");
  const password = config.getOptionalString("password");
  return nodemailer.createTransport({
    host: config.getString("hostname"),
    port: config.getNumber("port"),
    secure: config.getOptionalBoolean("secure") ?? false,
    requireTLS: config.getOptionalBoolean("requireTls") ?? false,
    auth: username && password ? { user: username, pass: password } : void 0
  });
};

exports.createSmtpTransport = createSmtpTransport;
//# sourceMappingURL=smtp.cjs.js.map
