'use strict';

var uuid = require('uuid');
var config = require('../lib/config.cjs.js');
var read = require('../lib/read.cjs.js');
var client = require('../lib/client.cjs.js');

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var uuid__namespace = /*#__PURE__*/_interopNamespaceCompat(uuid);

class PingIdentityEntityProvider {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(configRoot, options) {
    return config.readProviderConfigs(configRoot).map((providerConfig) => {
      let taskRunner;
      if (options.scheduler && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if (options.schedule) {
        taskRunner = options.schedule;
      } else {
        throw new Error(
          `No schedule provided neither via code nor config for PingIdentityEntityProvider:${providerConfig.id}.`
        );
      }
      const provider = new PingIdentityEntityProvider({
        id: providerConfig.id,
        provider: providerConfig,
        logger: options.logger,
        userTransformer: options.userTransformer,
        groupTransformer: options.groupTransformer
      });
      if (taskRunner !== "manual") {
        provider.schedule(taskRunner);
      }
      return provider;
    });
  }
  getProviderName() {
    return `PingIdentityEntityProvider:${this.options.id}`;
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn?.();
  }
  /**
   * Runs one complete ingestion loop. Call this method regularly at some
   * appropriate cadence.
   */
  async read(options) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const provider = this.options.provider;
    const { markReadComplete } = trackProgress(logger);
    const client$1 = new client.PingIdentityClient(provider);
    const { users, groups } = await read.readPingIdentity(client$1, {
      userQuerySize: this.options.provider.userQuerySize,
      groupQuerySize: this.options.provider.groupQuerySize,
      userTransformer: this.options.userTransformer,
      groupTransformer: this.options.groupTransformer
    });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `pingidentity-org-provider:${this.options.id}`,
        entity
      }))
    });
    const { markCommitComplete } = markReadComplete({ users, groups });
    markCommitComplete();
  }
  schedule(taskRunner) {
    this.scheduleFn = async () => {
      const id = `${this.getProviderName()}:refresh`;
      await taskRunner.run({
        id,
        fn: async () => {
          const logger = this.options.logger.child({
            class: PingIdentityEntityProvider.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.read({ logger });
          } catch (error) {
            logger.error("Error while syncing PingIdentity users and groups", {
              // Default Error properties:
              name: error.name,
              message: error.message,
              stack: error.stack,
              // Additional status code if available:
              status: error.response?.status
            });
          }
        }
      });
    };
  }
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading PingIdentity users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} PingIdentity users and ${read.groups.length} PingIdentity groups`;
    const readDuration = ((Date.now() - timestamp) / 1e3).toFixed(1);
    timestamp = Date.now();
    logger.info(`Read ${summary} in ${readDuration} seconds. Committing...`);
    return { markCommitComplete };
  }
  function markCommitComplete() {
    const commitDuration = ((Date.now() - timestamp) / 1e3).toFixed(1);
    logger.info(`Committed ${summary} in ${commitDuration} seconds.`);
  }
  return { markReadComplete };
}

exports.PingIdentityEntityProvider = PingIdentityEntityProvider;
//# sourceMappingURL=PingIdentityEntityProvider.cjs.js.map
