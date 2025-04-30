'use strict';

var nodemailer = require('nodemailer');
var clientSes = require('@aws-sdk/client-ses');

const createSesTransport = async (config, credentialsManager) => {
  const credentials = await credentialsManager.getCredentialProvider({
    accountId: config.getOptionalString("accountId")
  });
  const ses = new clientSes.SES([
    {
      apiVersion: config.getOptionalString("apiVersion") ?? "2010-12-01",
      credentials: credentials.sdkCredentialProvider,
      region: config.getOptionalString("region")
    }
  ]);
  return nodemailer.createTransport({
    SES: { ses, aws: { SendRawEmailCommand: clientSes.SendRawEmailCommand } }
  });
};

exports.createSesTransport = createSesTransport;
//# sourceMappingURL=ses.cjs.js.map
