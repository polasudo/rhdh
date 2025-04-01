'use strict';

var catalogModel = require('@backstage/catalog-model');
var lodash = require('lodash');
var uuid = require('uuid');
var client = require('../ldap/client.cjs.js');
var config = require('../ldap/config.cjs.js');
var constants = require('../ldap/constants.cjs.js');
var read = require('../ldap/read.cjs.js');

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

class LdapOrgEntityProvider {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(configRoot, options) {
    if ("id" in options) {
      return [LdapOrgEntityProvider.fromLegacyConfig(configRoot, options)];
    }
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    function getTransformer(id, transformers) {
      if (["undefined", "function"].includes(typeof transformers)) {
        return transformers;
      }
      return transformers[id];
    }
    return config.readProviderConfigs(configRoot).map((providerConfig) => {
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for LdapOrgEntityProvider:${providerConfig.id}.`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      const provider = new LdapOrgEntityProvider({
        id: providerConfig.id,
        provider: providerConfig,
        logger: options.logger,
        userTransformer: getTransformer(
          providerConfig.id,
          options.userTransformer
        ),
        groupTransformer: getTransformer(
          providerConfig.id,
          options.groupTransformer
        )
      });
      if (taskRunner !== "manual") {
        provider.schedule(taskRunner);
      }
      return provider;
    });
  }
  static fromLegacyConfig(configRoot, options) {
    const config$1 = configRoot.getOptionalConfig("ldap") || configRoot.getOptionalConfig("catalog.processors.ldapOrg");
    const providers = config$1 ? config.readLdapLegacyConfig(config$1) : [];
    const provider = providers.find((p) => options.target === p.target);
    if (!provider) {
      throw new TypeError(
        `There is no LDAP configuration that matches "${options.target}". Please add a configuration entry for it under "ldap.providers".`
      );
    }
    const logger = options.logger.child({
      target: options.target
    });
    const result = new LdapOrgEntityProvider({
      id: options.id,
      provider,
      userTransformer: options.userTransformer,
      groupTransformer: options.groupTransformer,
      logger
    });
    if (options.schedule !== "manual") {
      result.schedule(options.schedule);
    }
    return result;
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
  getProviderName() {
    return `LdapOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn?.();
  }
  /**
   * Runs one single complete ingestion. This is only necessary if you use
   * manual scheduling.
   */
  async read(options) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const logger = options?.logger ?? this.options.logger;
    const { markReadComplete } = trackProgress(logger);
    const client$1 = await client.LdapClient.create(
      this.options.logger,
      this.options.provider.target,
      this.options.provider.bind,
      this.options.provider.tls
    );
    const { users, groups } = await read.readLdapOrg(
      client$1,
      this.options.provider.users,
      this.options.provider.groups,
      this.options.provider.vendor,
      {
        groupTransformer: this.options.groupTransformer,
        userTransformer: this.options.userTransformer,
        logger
      }
    );
    const { markCommitComplete } = markReadComplete({ users, groups });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...groups].map((entity) => ({
        locationKey: `ldap-org-provider:${this.options.id}`,
        entity: withLocations(this.options.id, entity)
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
            class: LdapOrgEntityProvider.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.read({ logger });
          } catch (error) {
            logger.error(
              `${this.getProviderName()} refresh failed, ${error}`,
              error
            );
          }
        }
      });
    };
  }
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading LDAP users and groups");
  function markReadComplete(read) {
    summary = `${read.users.length} LDAP users and ${read.groups.length} LDAP groups`;
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
function withLocations(providerId, entity) {
  const dn = entity.metadata.annotations?.[constants.LDAP_DN_ANNOTATION] || entity.metadata.name;
  const location = `ldap://${providerId}/${encodeURIComponent(dn)}`;
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
}

exports.LdapOrgEntityProvider = LdapOrgEntityProvider;
//# sourceMappingURL=LdapOrgEntityProvider.cjs.js.map
