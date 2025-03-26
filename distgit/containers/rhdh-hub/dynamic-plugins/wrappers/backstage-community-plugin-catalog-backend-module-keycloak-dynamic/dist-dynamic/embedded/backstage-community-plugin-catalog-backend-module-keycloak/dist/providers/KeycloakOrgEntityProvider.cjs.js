'use strict';

var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var lodash = require('lodash');
var uuid = require('uuid');
var constants = require('../lib/constants.cjs.js');
var config = require('../lib/config.cjs.js');
var read = require('../lib/read.cjs.js');
var authenticate = require('../lib/authenticate.cjs.js');
var api = require('@opentelemetry/api');

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

const withLocations = (baseUrl, realm, entity) => {
  const kind = entity.kind === "Group" ? "groups" : "users";
  const location = `url:${baseUrl}/admin/realms/${realm}/${kind}/${entity.metadata.annotations?.[constants.KEYCLOAK_ID_ANNOTATION]}`;
  return lodash.merge(
    {
      metadata: {
        annotations: {
          [catalogModel.ANNOTATION_LOCATION]: location,
          [catalogModel.ANNOTATION_ORIGIN_LOCATION]: location
        }
      }
    },
    entity
  );
};
class KeycloakOrgEntityProvider {
  constructor(options) {
    this.options = options;
    this.meter = api.metrics.getMeter("default");
    this.counter = this.meter.createCounter(
      "backend_keycloak.fetch.task.failure.count",
      {
        description: "Counts the number of failed Keycloak data fetch tasks. Each increment indicates a complete failure of a fetch task, meaning no data was provided to the Catalog API. However, data may still be fetched in subsequent tasks, depending on the nature of the error."
      }
    );
    this.schedule(options.taskRunner);
  }
  connection;
  meter;
  counter;
  scheduleFn;
  /**
   * Static builder method to create multiple KeycloakOrgEntityProvider instances from a single config.
   * @param deps - The dependencies required for the provider, including the configuration and logger.
   * @param options - Options for scheduling tasks and transforming users and groups.
   * @returns An array of KeycloakOrgEntityProvider instances.
   */
  static fromConfig(deps, options) {
    const { config: config$1, logger } = deps;
    return config.readProviderConfigs(config$1).map((providerConfig) => {
      let taskRunner;
      if ("scheduler" in options && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if ("schedule" in options) {
        taskRunner = options.schedule;
      } else {
        throw new errors.InputError(
          `No schedule provided via config for KeycloakOrgEntityProvider:${providerConfig.id}.`
        );
      }
      const provider = new KeycloakOrgEntityProvider({
        id: providerConfig.id,
        provider: providerConfig,
        logger,
        taskRunner,
        userTransformer: options.userTransformer,
        groupTransformer: options.groupTransformer
      });
      return provider;
    });
  }
  /**
   * Returns the name of this entity provider.
   */
  getProviderName() {
    return `KeycloakOrgEntityProvider:${this.options.id}`;
  }
  /**
   * Connect to Backstage catalog entity provider
   * @param connection - The connection to the catalog API ingestor, which allows the provision of new entities.
   */
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
      throw new errors.NotFoundError("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const provider = this.options.provider;
    const { markReadComplete } = trackProgress(logger);
    const KeyCloakAdminClientModule = await import('@keycloak/keycloak-admin-client');
    const KeyCloakAdminClient = KeyCloakAdminClientModule.default;
    const kcAdminClient = new KeyCloakAdminClient({
      baseUrl: provider.baseUrl,
      realmName: provider.loginRealm
    });
    await authenticate.authenticate(kcAdminClient, provider, logger);
    const pLimitCJSModule = await import('p-limit');
    const limitFunc = pLimitCJSModule.default;
    const concurrency = provider.maxConcurrency ?? 20;
    const limit = limitFunc(concurrency);
    const dataBatchFailureCounter = this.meter.createCounter(
      "backend_keycloak.fetch.data.batch.failure.count",
      {
        description: "Keycloak data batch fetch failure counter. Incremented for each batch fetch failure. Each failure means that a part of the data was not fetched due to an error, and thus the corresponding data batch was skipped during the current fetch task."
      }
    );
    const { users, groups } = await read.readKeycloakRealm(
      kcAdminClient,
      provider,
      logger,
      limit,
      options.taskInstanceId,
      dataBatchFailureCounter,
      {
        userQuerySize: provider.userQuerySize,
        groupQuerySize: provider.groupQuerySize,
        userTransformer: this.options.userTransformer,
        groupTransformer: this.options.groupTransformer
      }
    );
    const { markCommitComplete } = markReadComplete({ users, groups });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `keycloak-org-provider:${this.options.id}`,
        entity: withLocations(provider.baseUrl, provider.realm, entity)
      }))
    });
    markCommitComplete();
  }
  /**
   * Periodically schedules a task to read Keycloak user and group information, parse it, and provision it to the Backstage catalog.
   * @param taskRunner - The task runner to use for scheduling tasks.
   */
  schedule(taskRunner) {
    this.scheduleFn = async () => {
      const id = `${this.getProviderName()}:refresh`;
      await taskRunner.run({
        id,
        fn: async () => {
          const taskInstanceId = uuid__namespace.v4();
          const logger = this.options.logger.child({
            class: KeycloakOrgEntityProvider.prototype.constructor.name,
            taskId: id,
            taskInstanceId
          });
          try {
            await this.read({ logger, taskInstanceId });
          } catch (error) {
            this.counter.add(1, { taskInstanceId });
            if (errors.isError(error)) {
              logger.error("Error while syncing Keycloak users and groups", {
                // Default Error properties:
                name: error.name,
                cause: error.cause,
                message: error.message,
                stack: error.stack,
                // Additional status code if available:
                status: error.response?.status
              });
            }
          }
        }
      });
    };
  }
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading Keycloak users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} Keycloak users and ${read.groups.length} Keycloak groups`;
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

exports.KeycloakOrgEntityProvider = KeycloakOrgEntityProvider;
exports.withLocations = withLocations;
//# sourceMappingURL=KeycloakOrgEntityProvider.cjs.js.map
