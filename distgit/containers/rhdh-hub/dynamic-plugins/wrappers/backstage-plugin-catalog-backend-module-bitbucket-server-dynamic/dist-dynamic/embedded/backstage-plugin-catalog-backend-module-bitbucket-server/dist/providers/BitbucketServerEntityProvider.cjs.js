'use strict';

var errors = require('@backstage/errors');
var integration = require('@backstage/integration');
var uuid = require('uuid');
var BitbucketServerClient = require('../lib/BitbucketServerClient.cjs.js');
var BitbucketServerEntityProviderConfig = require('./BitbucketServerEntityProviderConfig.cjs.js');
var BitbucketServerLocationParser = require('./BitbucketServerLocationParser.cjs.js');

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

class BitbucketServerEntityProvider {
  integration;
  config;
  parser;
  logger;
  scheduleFn;
  connection;
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    return BitbucketServerEntityProviderConfig.readProviderConfigs(config).map((providerConfig) => {
      const integration = integrations.bitbucketServer.byHost(
        providerConfig.host
      );
      if (!integration) {
        throw new errors.InputError(
          `No BitbucketServer integration found that matches host ${providerConfig.host}`
        );
      }
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for bitbucketServer-provider:${providerConfig.id}.`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new BitbucketServerEntityProvider(
        providerConfig,
        integration,
        options.logger,
        taskRunner,
        options.parser
      );
    });
  }
  constructor(config, integration, logger, taskRunner, parser) {
    this.integration = integration;
    this.config = config;
    this.parser = parser || BitbucketServerLocationParser.defaultBitbucketServerLocationParser;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
  }
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: BitbucketServerEntityProvider.prototype.constructor.name,
            taskId,
            taskInstanceId: uuid__namespace.v4()
          });
          try {
            await this.refresh(logger);
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
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `bitbucketServer-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  async refresh(logger) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    logger.info("Discovering catalog files in Bitbucket Server repositories");
    const entities = await this.findEntities();
    await this.connection.applyMutation({
      type: "full",
      entities: entities.map((entity) => ({
        locationKey: this.getProviderName(),
        entity
      }))
    });
    logger.info(
      `Committed ${entities.length} entities for Bitbucket Server repositories`
    );
  }
  async findEntities() {
    const client = BitbucketServerClient.BitbucketServerClient.fromConfig({
      config: this.integration.config
    });
    const projects = BitbucketServerClient.paginated(
      (options) => client.listProjects({ listOptions: options })
    );
    const result = [];
    for await (const project of projects) {
      if (this.config?.filters?.projectKey && !this.config.filters.projectKey.test(project.key)) {
        continue;
      }
      const repositories = BitbucketServerClient.paginated(
        (options) => client.listRepositories({
          projectKey: project.key,
          listOptions: options
        })
      );
      for await (const repository of repositories) {
        if (this.config?.filters?.repoSlug && !this.config.filters.repoSlug.test(repository.slug)) {
          continue;
        }
        if (this.config?.filters?.skipArchivedRepos && repository.archived) {
          continue;
        }
        for await (const entity of this.parser({
          client,
          logger: this.logger,
          location: {
            type: "url",
            target: `${repository.links.self[0].href}${this.config.catalogPath}`,
            presence: "optional"
          }
        })) {
          result.push(entity);
        }
      }
    }
    return result;
  }
}

exports.BitbucketServerEntityProvider = BitbucketServerEntityProvider;
//# sourceMappingURL=BitbucketServerEntityProvider.cjs.js.map
