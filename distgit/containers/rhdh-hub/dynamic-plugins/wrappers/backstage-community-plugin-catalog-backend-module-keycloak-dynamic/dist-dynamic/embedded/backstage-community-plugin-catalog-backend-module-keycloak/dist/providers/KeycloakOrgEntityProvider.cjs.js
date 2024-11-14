'use strict';

var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var inclusion = require('inclusion');
var lodash = require('lodash');
var uuid = require('uuid');
var constants = require('../lib/constants.cjs.js');
var config = require('../lib/config.cjs.js');
var read = require('../lib/read.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

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

var inclusion__default = /*#__PURE__*/_interopDefaultCompat(inclusion);
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
    this.schedule(options.taskRunner);
  }
  connection;
  scheduleFn;
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
  getProviderName() {
    return `KeycloakOrgEntityProvider:${this.options.id}`;
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
      throw new errors.NotFoundError("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const provider = this.options.provider;
    const { markReadComplete } = trackProgress(logger);
    const KeyCloakAdminClientModule = await inclusion__default.default(
      "@keycloak/keycloak-admin-client"
    );
    const KeyCloakAdminClient = KeyCloakAdminClientModule.default;
    const kcAdminClient = new KeyCloakAdminClient({
      baseUrl: provider.baseUrl,
      realmName: provider.loginRealm
    });
    let credentials;
    if (provider.username && provider.password) {
      credentials = {
        grantType: "password",
        clientId: provider.clientId ?? "admin-cli",
        username: provider.username,
        password: provider.password
      };
    } else if (provider.clientId && provider.clientSecret) {
      credentials = {
        grantType: "client_credentials",
        clientId: provider.clientId,
        clientSecret: provider.clientSecret
      };
    } else {
      throw new errors.InputError(
        `username and password or clientId and clientSecret must be provided.`
      );
    }
    await kcAdminClient.auth(credentials);
    const { users, groups } = await read.readKeycloakRealm(
      kcAdminClient,
      provider,
      logger,
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
  schedule(taskRunner) {
    this.scheduleFn = async () => {
      const id = `${this.getProviderName()}:refresh`;
      await taskRunner.run({
        id,
        fn: async () => {
          const logger = this.options.logger.child({
            class: KeycloakOrgEntityProvider.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.read({ logger });
          } catch (error) {
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
