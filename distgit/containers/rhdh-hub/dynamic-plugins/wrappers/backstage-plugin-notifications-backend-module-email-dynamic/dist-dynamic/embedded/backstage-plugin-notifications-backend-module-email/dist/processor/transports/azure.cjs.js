'use strict';

var nodemailer = require('nodemailer');
var communicationEmail = require('@azure/communication-email');
var identity = require('@azure/identity');

const createAzureTransport = async (config) => {
  const accessKey = config.getOptionalString("accessKey");
  const credentials = accessKey === void 0 ? new identity.DefaultAzureCredential() : { key: accessKey };
  const emailClient = new communicationEmail.EmailClient(
    config.getString("endpoint"),
    credentials
  );
  const transport = {
    name: "azure",
    version: "1.0.0",
    send: async (mail, callback) => {
      const envelope = mail.data.envelope || mail.message.getEnvelope();
      const from = typeof envelope.from === "string" ? envelope.from : config.getString("senderAddress");
      const to = typeof envelope.to === "string" ? [envelope.to] : envelope.to ?? [];
      const recipients = {
        to: to.map((address) => ({ address }))
      };
      const content = {
        subject: mail.message.getHeader("Subject"),
        html: typeof mail.data.html === "string" ? mail.data.html : mail.data.html?.toString("utf-8"),
        plainText: typeof mail.data.text === "string" ? mail.data.text : mail.data.text?.toString("utf-8") ?? "No content"
      };
      const emailMessage = {
        senderAddress: from,
        recipients,
        content
      };
      try {
        const poller = await emailClient.beginSend(emailMessage);
        const response = await poller.pollUntilDone();
        callback(null, response);
      } catch (error) {
        callback(error, null);
      }
    }
  };
  return nodemailer.createTransport(transport);
};

exports.createAzureTransport = createAzureTransport;
//# sourceMappingURL=azure.cjs.js.map
