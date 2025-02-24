'use strict';

var express = require('express');
var Router = require('express-promise-router');
var DatabaseNotificationsStore = require('../database/DatabaseNotificationsStore.cjs.js');
var uuid = require('uuid');
var errors = require('@backstage/errors');
var pluginNotificationsCommon = require('@backstage/plugin-notifications-common');
var parseEntityOrderFieldParams = require('./parseEntityOrderFieldParams.cjs.js');
var getUsersForEntityRef = require('./getUsersForEntityRef.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

async function createRouter(options) {
  const {
    config,
    logger,
    database,
    auth,
    httpAuth,
    userInfo,
    catalog,
    processors = [],
    signals
  } = options;
  const WEB_NOTIFICATION_CHANNEL = "Web";
  const store = await DatabaseNotificationsStore.DatabaseNotificationsStore.create({ database });
  const frontendBaseUrl = config.getString("app.baseUrl");
  const getUser = async (req) => {
    const credentials = await httpAuth.credentials(req, { allow: ["user"] });
    const info = await userInfo.getUserInfo(credentials);
    return info.userEntityRef;
  };
  const getNotificationChannels = () => {
    return [WEB_NOTIFICATION_CHANNEL, ...processors.map((p) => p.getName())];
  };
  const getNotificationSettings = async (user) => {
    const { origins } = await store.getUserNotificationOrigins({ user });
    const settings = await store.getNotificationSettings({ user });
    const channels = getNotificationChannels();
    const response = {
      channels: channels.map((channel) => {
        const channelSettings = settings.channels.find((c) => c.id === channel);
        if (channelSettings) {
          return channelSettings;
        }
        return {
          id: channel,
          origins: origins.map((origin) => ({
            id: origin,
            enabled: true
          }))
        };
      })
    };
    return response;
  };
  const isNotificationsEnabled = async (opts) => {
    const settings = await getNotificationSettings(opts.user);
    return pluginNotificationsCommon.isNotificationsEnabledFor(settings, opts.channel, opts.origin);
  };
  const filterProcessors = async (notification) => {
    const result = [];
    const { payload, user, origin } = notification;
    for (const processor of processors) {
      if (user) {
        const enabled = await isNotificationsEnabled({
          user,
          origin,
          channel: processor.getName()
        });
        if (!enabled) {
          continue;
        }
      }
      if (processor.getNotificationFilters) {
        const filters = processor.getNotificationFilters();
        if (filters.minSeverity) {
          if (pluginNotificationsCommon.notificationSeverities.indexOf(payload.severity ?? "normal") > pluginNotificationsCommon.notificationSeverities.indexOf(filters.minSeverity)) {
            continue;
          }
        }
        if (filters.maxSeverity) {
          if (pluginNotificationsCommon.notificationSeverities.indexOf(payload.severity ?? "normal") < pluginNotificationsCommon.notificationSeverities.indexOf(filters.maxSeverity)) {
            continue;
          }
        }
        if (filters.excludedTopics && payload.topic) {
          if (filters.excludedTopics.includes(payload.topic)) {
            continue;
          }
        }
      }
      result.push(processor);
    }
    return result;
  };
  const processOptions = async (opts, origin) => {
    const filtered = await filterProcessors({ ...opts, origin, user: null });
    let ret = opts;
    for (const processor of filtered) {
      try {
        ret = processor.processOptions ? await processor.processOptions(ret) : ret;
      } catch (e) {
        logger.error(
          `Error while processing notification options with ${processor.getName()}: ${e}`
        );
      }
    }
    return ret;
  };
  const preProcessNotification = async (notification, opts) => {
    const filtered = await filterProcessors(notification);
    let ret = notification;
    for (const processor of filtered) {
      try {
        ret = processor.preProcess ? await processor.preProcess(ret, opts) : ret;
      } catch (e) {
        logger.error(
          `Error while pre processing notification with ${processor.getName()}: ${e}`
        );
      }
    }
    return ret;
  };
  const postProcessNotification = async (notification, opts) => {
    const filtered = await filterProcessors(notification);
    for (const processor of filtered) {
      if (processor.postProcess) {
        try {
          await processor.postProcess(notification, opts);
        } catch (e) {
          logger.error(
            `Error while post processing notification with ${processor.getName()}: ${e}`
          );
        }
      }
    }
  };
  const validateLink = (link) => {
    const stripLeadingSlash = (s) => s.replace(/^\//, "");
    const ensureTrailingSlash = (s) => s.replace(/\/?$/, "/");
    const url = new URL(
      stripLeadingSlash(link),
      ensureTrailingSlash(frontendBaseUrl)
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Only HTTP/HTTPS links are allowed");
    }
  };
  const router = Router__default.default();
  router.use(express__default.default.json());
  const listNotificationsHandler = async (req, res) => {
    const user = await getUser(req);
    const opts = {
      user
    };
    if (req.query.offset) {
      opts.offset = Number.parseInt(req.query.offset.toString(), 10);
    }
    if (req.query.limit) {
      opts.limit = Number.parseInt(req.query.limit.toString(), 10);
    }
    if (req.query.orderField) {
      opts.orderField = parseEntityOrderFieldParams.parseEntityOrderFieldParams(req.query);
    }
    if (req.query.search) {
      opts.search = req.query.search.toString();
    }
    if (req.query.read === "true") {
      opts.read = true;
    } else if (req.query.read === "false") {
      opts.read = false;
    }
    if (req.query.topic) {
      opts.topic = req.query.topic.toString();
    }
    if (req.query.saved === "true") {
      opts.saved = true;
    } else if (req.query.saved === "false") {
      opts.saved = false;
    }
    if (req.query.createdAfter) {
      const sinceEpoch = Date.parse(String(req.query.createdAfter));
      if (isNaN(sinceEpoch)) {
        throw new errors.InputError("Unexpected date format");
      }
      opts.createdAfter = new Date(sinceEpoch);
    }
    if (req.query.minimumSeverity) {
      opts.minimumSeverity = DatabaseNotificationsStore.normalizeSeverity(
        req.query.minimumSeverity.toString()
      );
    }
    const [notifications, totalCount] = await Promise.all([
      store.getNotifications(opts),
      store.getNotificationsCount(opts)
    ]);
    res.json({
      totalCount,
      notifications
    });
  };
  router.get("/", listNotificationsHandler);
  router.get("/notifications", listNotificationsHandler);
  router.get("/status", async (req, res) => {
    const user = await getUser(req);
    const status = await store.getStatus({ user });
    res.json(status);
  });
  router.get(
    "/settings",
    async (req, res) => {
      const user = await getUser(req);
      const response = await getNotificationSettings(user);
      res.json(response);
    }
  );
  router.post(
    "/settings",
    async (req, res) => {
      const user = await getUser(req);
      const channels = getNotificationChannels();
      const settings = req.body;
      if (settings.channels.some((c) => !channels.includes(c.id))) {
        throw new errors.InputError("Invalid channel");
      }
      await store.saveNotificationSettings({ user, settings });
      const response = await getNotificationSettings(user);
      res.json(response);
    }
  );
  const getNotificationHandler = async (req, res) => {
    const user = await getUser(req);
    const opts = {
      user,
      limit: 1,
      ids: [req.params.id]
    };
    const notifications = await store.getNotifications(opts);
    if (notifications.length !== 1) {
      throw new errors.NotFoundError("Not found");
    }
    res.json(notifications[0]);
  };
  router.get("/:id", getNotificationHandler);
  router.get("/notifications/:id", getNotificationHandler);
  const updateNotificationsHandler = async (req, res) => {
    const user = await getUser(req);
    const { ids, read, saved } = req.body;
    if (!ids || !Array.isArray(ids)) {
      throw new errors.InputError();
    }
    if (read === true) {
      await store.markRead({ user, ids });
      if (signals) {
        await signals.publish({
          recipients: { type: "user", entityRef: [user] },
          message: { action: "notification_read", notification_ids: ids },
          channel: "notifications"
        });
      }
    } else if (read === false) {
      await store.markUnread({ user, ids });
      if (signals) {
        await signals.publish({
          recipients: { type: "user", entityRef: [user] },
          message: { action: "notification_unread", notification_ids: ids },
          channel: "notifications"
        });
      }
    }
    if (saved === true) {
      await store.markSaved({ user, ids });
    } else if (saved === false) {
      await store.markUnsaved({ user, ids });
    }
    const notifications = await store.getNotifications({ ids, user });
    res.json(notifications);
  };
  router.post("/update", updateNotificationsHandler);
  router.post("/notifications/update", updateNotificationsHandler);
  const sendBroadcastNotification = async (baseNotification, opts, origin) => {
    const { scope } = opts.payload;
    const broadcastNotification = {
      ...baseNotification,
      user: null,
      id: uuid.v4()
    };
    const notification = await preProcessNotification(
      broadcastNotification,
      opts
    );
    let existingNotification;
    if (scope) {
      existingNotification = await store.getExistingScopeBroadcast({
        scope,
        origin
      });
    }
    let ret = notification;
    if (existingNotification) {
      const restored = await store.restoreExistingNotification({
        id: existingNotification.id,
        notification: { ...notification, user: "" }
      });
      ret = restored ?? notification;
    } else {
      await store.saveBroadcast(notification);
    }
    if (signals) {
      await signals.publish({
        recipients: { type: "broadcast" },
        message: {
          action: "new_notification",
          notification_id: ret.id
        },
        channel: "notifications"
      });
      postProcessNotification(ret, opts);
    }
    return notification;
  };
  const sendUserNotifications = async (baseNotification, users, opts, origin) => {
    const notifications = [];
    const { scope } = opts.payload;
    const uniqueUsers = [...new Set(users)];
    for (const user of uniqueUsers) {
      const userNotification = {
        ...baseNotification,
        id: uuid.v4(),
        user
      };
      const notification = await preProcessNotification(userNotification, opts);
      const enabled = await isNotificationsEnabled({
        user,
        channel: WEB_NOTIFICATION_CHANNEL,
        origin: userNotification.origin
      });
      let ret = notification;
      if (enabled) {
        let existingNotification;
        if (scope) {
          existingNotification = await store.getExistingScopeNotification({
            user,
            scope,
            origin
          });
        }
        if (existingNotification) {
          const restored = await store.restoreExistingNotification({
            id: existingNotification.id,
            notification
          });
          ret = restored ?? notification;
        } else {
          await store.saveNotification(notification);
        }
        notifications.push(ret);
        if (signals) {
          await signals.publish({
            recipients: { type: "user", entityRef: [user] },
            message: {
              action: "new_notification",
              notification_id: ret.id
            },
            channel: "notifications"
          });
        }
      }
      postProcessNotification(ret, opts);
    }
    return notifications;
  };
  const createNotificationHandler = async (req, res) => {
    const credentials = await httpAuth.credentials(req, {
      allow: ["service"]
    });
    const origin = credentials.principal.subject;
    const opts = await processOptions(req.body, origin);
    const { recipients, payload } = opts;
    const { title, link } = payload;
    const notifications = [];
    let users = [];
    if (!recipients || !title) {
      logger.error(`Invalid notification request received`);
      throw new errors.InputError(`Invalid notification request received`);
    }
    if (link) {
      try {
        validateLink(link);
      } catch (e) {
        throw new errors.InputError("Invalid link provided", e);
      }
    }
    const baseNotification = {
      payload: {
        ...payload,
        severity: payload.severity ?? "normal"
      },
      origin,
      created: /* @__PURE__ */ new Date()
    };
    if (recipients.type === "broadcast") {
      const broadcast = await sendBroadcastNotification(
        baseNotification,
        opts,
        origin
      );
      notifications.push(broadcast);
    } else {
      const entityRef = recipients.entityRef;
      try {
        users = await getUsersForEntityRef.getUsersForEntityRef(
          entityRef,
          recipients.excludeEntityRef ?? [],
          { auth, catalogClient: catalog }
        );
      } catch (e) {
        logger.error(`Failed to resolve notification receivers: ${e}`);
        throw new errors.InputError("Failed to resolve notification receivers", e);
      }
      const userNotifications = await sendUserNotifications(
        baseNotification,
        users,
        opts,
        origin
      );
      notifications.push(...userNotifications);
    }
    res.json(notifications);
  };
  router.post("/", createNotificationHandler);
  router.post("/notifications", createNotificationHandler);
  return router;
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
