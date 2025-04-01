'use strict';

var config = require('@backstage/config');
var types = require('@backstage/types');
var catalogClient = require('@backstage/catalog-client');
var pluginNotificationsCommon = require('@backstage/plugin-notifications-common');
var smtp = require('./transports/smtp.cjs.js');
var ses = require('./transports/ses.cjs.js');
var sendmail = require('./transports/sendmail.cjs.js');
var stream = require('./transports/stream.cjs.js');
var azure = require('./transports/azure.cjs.js');
var lodash = require('lodash');
var integrationAwsNode = require('@backstage/integration-aws-node');
var pThrottle = require('p-throttle');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var pThrottle__default = /*#__PURE__*/_interopDefaultCompat(pThrottle);

class NotificationsEmailProcessor {
  constructor(logger, config$1, catalog, auth, cache, templateRenderer) {
    this.logger = logger;
    this.config = config$1;
    this.catalog = catalog;
    this.auth = auth;
    this.cache = cache;
    this.templateRenderer = templateRenderer;
    const emailProcessorConfig = config$1.getConfig(
      "notifications.processors.email"
    );
    this.transportConfig = emailProcessorConfig.getConfig("transportConfig");
    this.broadcastConfig = emailProcessorConfig.getOptionalConfig("broadcastConfig");
    this.sender = emailProcessorConfig.getString("sender");
    this.replyTo = emailProcessorConfig.getOptionalString("replyTo");
    this.concurrencyLimit = emailProcessorConfig.getOptionalNumber("concurrencyLimit") ?? 2;
    this.throttleInterval = emailProcessorConfig.has("throttleInterval") ? types.durationToMilliseconds(
      config.readDurationFromConfig(emailProcessorConfig, {
        key: "throttleInterval"
      })
    ) : 100;
    this.cacheTtl = emailProcessorConfig.has("cache.ttl") ? types.durationToMilliseconds(
      config.readDurationFromConfig(emailProcessorConfig, { key: "cache.ttl" })
    ) : 36e5;
    this.frontendBaseUrl = config$1.getString("app.baseUrl");
    this.allowlistEmailAddresses = emailProcessorConfig.getOptionalStringArray(
      "allowlistEmailAddresses"
    );
    this.denylistEmailAddresses = emailProcessorConfig.getOptionalStringArray(
      "denylistEmailAddresses"
    );
    this.filter = pluginNotificationsCommon.getProcessorFiltersFromConfig(emailProcessorConfig);
  }
  transporter;
  broadcastConfig;
  transportConfig;
  sender;
  replyTo;
  cacheTtl;
  concurrencyLimit;
  throttleInterval;
  frontendBaseUrl;
  filter;
  allowlistEmailAddresses;
  denylistEmailAddresses;
  async getTransporter() {
    if (this.transporter) {
      return this.transporter;
    }
    const transport = this.transportConfig.getString("transport");
    if (transport === "smtp") {
      this.transporter = smtp.createSmtpTransport(this.transportConfig);
    } else if (transport === "ses") {
      const awsCredentialsManager = integrationAwsNode.DefaultAwsCredentialsManager.fromConfig(
        this.config
      );
      this.transporter = await ses.createSesTransport(
        this.transportConfig,
        awsCredentialsManager
      );
    } else if (transport === "sendmail") {
      this.transporter = sendmail.createSendmailTransport(this.transportConfig);
    } else if (transport === "stream") {
      this.transporter = stream.createStreamTransport();
    } else if (transport === "azure") {
      this.transporter = azure.createAzureTransport(this.transportConfig);
    } else {
      throw new Error(`Unsupported transport: ${transport}`);
    }
    return this.transporter;
  }
  getName() {
    return "Email";
  }
  async getBroadcastEmails() {
    if (!this.broadcastConfig) {
      return [];
    }
    const receiver = this.broadcastConfig.getString("receiver");
    if (receiver === "none") {
      return [];
    }
    if (receiver === "config") {
      return this.broadcastConfig.getOptionalStringArray("receiverEmails") ?? [];
    }
    if (receiver === "users") {
      const cached = await this.cache?.get("user-emails:all");
      if (cached) {
        return cached;
      }
      const { token } = await this.auth.getPluginRequestToken({
        onBehalfOf: await this.auth.getOwnServiceCredentials(),
        targetPluginId: "catalog"
      });
      const entities = await this.catalog.getEntities(
        {
          filter: [
            { kind: "user", "spec.profile.email": catalogClient.CATALOG_FILTER_EXISTS }
          ],
          fields: ["spec.profile.email"]
        },
        { token }
      );
      const ret = lodash.compact([
        ...new Set(
          entities.items.map((entity) => {
            return entity?.spec.profile?.email;
          })
        )
      ]);
      await this.cache?.set("user-emails:all", ret, {
        ttl: this.cacheTtl
      });
      return ret;
    }
    throw new Error(`Unsupported broadcast receiver: ${receiver}`);
  }
  async getUserEmail(entityRef) {
    const cached = await this.cache?.get(`user-emails:${entityRef}`);
    if (cached) {
      return cached;
    }
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
    const entity = await this.catalog.getEntityByRef(entityRef, { token });
    const ret = [];
    if (entity) {
      const userEntity = entity;
      if (userEntity.spec.profile?.email) {
        ret.push(userEntity.spec.profile.email);
      }
    }
    await this.cache?.set(`user-emails:${entityRef}`, ret, {
      ttl: this.cacheTtl
    });
    return ret;
  }
  async getRecipientEmails(notification, options) {
    let emails;
    if (options.recipients.type === "broadcast") {
      emails = await this.getBroadcastEmails();
    } else if (options.recipients.type === "entity" && !!notification.user) {
      emails = await this.getUserEmail(notification.user);
    } else {
      this.logger.info(
        `Unknown notification type ${options.recipients.type} or missing user.`
      );
      return [];
    }
    if (this.allowlistEmailAddresses) {
      emails = emails.filter(
        (email) => this.allowlistEmailAddresses?.includes(email)
      );
    }
    if (this.denylistEmailAddresses) {
      emails = emails.filter(
        (email) => !this.denylistEmailAddresses?.includes(email)
      );
    }
    return emails;
  }
  async sendMail(options) {
    try {
      this.logger.debug(`Sending notification email to ${options.to}`);
      await this.transporter.sendMail(options);
    } catch (e) {
      this.logger.error(`Failed to send email to ${options.to}: ${e}`);
    }
  }
  async sendMails(options, emails) {
    const throttle = pThrottle__default.default({
      limit: this.concurrencyLimit,
      interval: this.throttleInterval
    });
    const throttled = throttle((opts) => this.sendMail(opts));
    await Promise.all(
      emails.map((email) => throttled({ ...options, to: email }))
    );
  }
  getNotificationLink(notification) {
    if (notification.payload.link) {
      const stripLeadingSlash = (s) => s.replace(/^\//, "");
      const ensureTrailingSlash = (s) => s.replace(/\/?$/, "/");
      try {
        const url = new URL(
          stripLeadingSlash(notification.payload.link),
          ensureTrailingSlash(this.frontendBaseUrl)
        );
        return url.toString();
      } catch (_e) {
      }
      return notification.payload.link;
    }
    return `${this.frontendBaseUrl}/notifications`;
  }
  getHtmlContent(notification) {
    const contentParts = [];
    if (notification.payload.description) {
      contentParts.push(`${notification.payload.description}`);
    }
    const link = this.getNotificationLink(notification);
    contentParts.push(`<a href="${link}">${link}</a>`);
    return `<p>${contentParts.join("<br/>")}</p>`;
  }
  getTextContent(notification) {
    const contentParts = [];
    if (notification.payload.description) {
      contentParts.push(notification.payload.description);
    }
    contentParts.push(this.getNotificationLink(notification));
    return contentParts.join("\n\n");
  }
  async sendPlainEmail(notification, emails) {
    const mailOptions = {
      from: this.sender,
      subject: notification.payload.title,
      html: this.getHtmlContent(notification),
      text: this.getTextContent(notification),
      replyTo: this.replyTo
    };
    await this.sendMails(mailOptions, emails);
  }
  async sendTemplateEmail(notification, emails) {
    const mailOptions = {
      from: this.sender,
      subject: await this.templateRenderer?.getSubject?.(notification) ?? notification.payload.title,
      html: await this.templateRenderer?.getHtml?.(notification),
      text: await this.templateRenderer?.getText?.(notification),
      replyTo: this.replyTo
    };
    await this.sendMails(mailOptions, emails);
  }
  async postProcess(notification, options) {
    this.transporter = await this.getTransporter();
    let emails = [];
    try {
      emails = await this.getRecipientEmails(notification, options);
    } catch (e) {
      this.logger.error(`Failed to resolve recipient emails: ${e}`);
      return;
    }
    if (emails.length === 0) {
      this.logger.info(
        `No email recipients found for notification: ${notification.id}, skipping`
      );
      return;
    }
    this.logger.debug(`Sending notification emails to: ${emails.join(",")}`);
    if (!this.templateRenderer) {
      await this.sendPlainEmail(notification, emails);
      return;
    }
    await this.sendTemplateEmail(notification, emails);
  }
  getNotificationFilters() {
    return this.filter;
  }
}

exports.NotificationsEmailProcessor = NotificationsEmailProcessor;
//# sourceMappingURL=NotificationsEmailProcessor.cjs.js.map
