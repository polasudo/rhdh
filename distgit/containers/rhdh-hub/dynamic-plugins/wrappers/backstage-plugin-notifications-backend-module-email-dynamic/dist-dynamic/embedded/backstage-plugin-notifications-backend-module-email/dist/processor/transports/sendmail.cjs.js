'use strict';

var nodemailer = require('nodemailer');

const createSendmailTransport = (config) => {
  return nodemailer.createTransport({
    sendmail: true,
    newline: config.getOptionalString("newline") ?? "unix",
    path: config.getOptionalString("path") ?? "/usr/sbin/sendmail"
  });
};

exports.createSendmailTransport = createSendmailTransport;
//# sourceMappingURL=sendmail.cjs.js.map
