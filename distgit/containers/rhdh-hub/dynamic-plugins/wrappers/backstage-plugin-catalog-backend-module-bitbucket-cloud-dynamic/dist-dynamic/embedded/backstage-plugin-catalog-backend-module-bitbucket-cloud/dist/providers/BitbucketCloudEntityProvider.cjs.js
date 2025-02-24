'use strict';

var integration = require('@backstage/integration');
var pluginBitbucketCloudCommon = require('@backstage/plugin-bitbucket-cloud-common');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var BitbucketCloudEntityProviderConfig = require('./BitbucketCloudEntityProviderConfig.cjs.js');
var uuid = require('uuid');

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

const DEFAULT_BRANCH = "master";
const TOPIC_REPO_PUSH = "bitbucketCloud.repo:push";
const ANNOTATION_BITBUCKET_CLOUD_REPO_URL = "bitbucket.org/repo-url";
class BitbucketCloudEntityProvider {
  auth;
  catalogApi;
  client;
  config;
  events;
  logger;
  scheduleFn;
  connection;
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const integration$1 = integrations.bitbucketCloud.byHost("bitbucket.org");
    if (!integration$1) {
      throw new Error("No integration for bitbucket.org available");
    }
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    return BitbucketCloudEntityProviderConfig.readProviderConfigs(config).map((providerConfig) => {
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for bitbucketCloud-provider:${providerConfig.id}.`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new BitbucketCloudEntityProvider(
        options.auth,
        options.catalogApi,
        providerConfig,
        options.events,
        integration$1,
        options.logger,
        taskRunner
      );
    });
  }
  constructor(auth, catalogApi, config, events, integration, logger, taskRunner) {
    this.auth = auth;
    this.catalogApi = catalogApi;
    this.client = pluginBitbucketCloudCommon.BitbucketCloudClient.fromConfig(integration.config);
    this.config = config;
    this.events = events;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
  }
  createScheduleFn(schedule) {
    return async () => {
      const taskId = this.getTaskId();
      return schedule.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: BitbucketCloudEntityProvider.prototype.constructor.name,
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
    return `bitbucketCloud-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getTaskId} */
  getTaskId() {
    return `${this.getProviderName()}:refresh`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
    await this.events.subscribe({
      id: this.getProviderName(),
      topics: [TOPIC_REPO_PUSH],
      onEvent: async (params) => {
        if (params.topic !== TOPIC_REPO_PUSH) {
          return;
        }
        await this.onRepoPush(params.eventPayload);
      }
    });
  }
  async refresh(logger) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    logger.info("Discovering catalog files in Bitbucket Cloud repositories");
    const targets = await this.findCatalogFiles();
    const entities = this.toDeferredEntities(targets);
    await this.connection.applyMutation({
      type: "full",
      entities
    });
    logger.info(
      `Committed ${entities.length} Locations for catalog files in Bitbucket Cloud repositories`
    );
  }
  enhanceEvent(event) {
    event.repository.slug = event.repository.full_name.split("/", 2)[1];
  }
  async onRepoPush(event) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    this.enhanceEvent(event);
    if (event.repository.workspace.slug !== this.config.workspace) {
      return;
    }
    if (!this.matchesFilters(event.repository)) {
      return;
    }
    const repoSlug = event.repository.slug;
    const repoUrl = event.repository.links.html.href;
    this.logger.info(`handle repo:push event for ${repoUrl}`);
    const targets = await this.findCatalogFiles(repoSlug);
    const existing = await this.findExistingLocations(repoUrl);
    const added = this.toDeferredEntities(
      targets.filter(
        // All Locations are managed by this provider and only have `target`, never `targets`.
        // All URLs (fileUrl, target) are created using `BitbucketCloudEntityProvider.toUrl`.
        // Hence, we can keep the comparison simple and don't need to handle different
        // casing  or encoding, etc.
        (target) => !existing.find((item) => item.spec.target === target.fileUrl)
      )
    );
    const stillExisting = [];
    const removed = [];
    existing.forEach((item) => {
      if (targets.find((value) => value.fileUrl === item.spec.target)) {
        stillExisting.push(item);
      } else {
        removed.push({
          locationKey: this.getProviderName(),
          entity: item
        });
      }
    });
    const promises = [
      this.connection.refresh({
        keys: stillExisting.map((entity) => `url:${entity.spec.target}`)
      })
    ];
    if (added.length > 0 || removed.length > 0) {
      const connection = this.connection;
      promises.push(
        connection.applyMutation({
          type: "delta",
          added,
          removed
        })
      );
    }
    await Promise.all(promises);
  }
  async findExistingLocations(repoUrl) {
    const filter = {};
    filter.kind = "Location";
    filter[`metadata.annotations.${ANNOTATION_BITBUCKET_CLOUD_REPO_URL}`] = repoUrl;
    const { token } = await this.auth.getPluginRequestToken({
      onBehalfOf: await this.auth.getOwnServiceCredentials(),
      targetPluginId: "catalog"
    });
    return this.catalogApi.getEntities({ filter }, { token }).then((result) => result.items);
  }
  async findCatalogFiles(repoSlug) {
    const workspace = this.config.workspace;
    const catalogPath = this.config.catalogPath;
    const catalogFilename = catalogPath.substring(
      catalogPath.lastIndexOf("/") + 1
    );
    const optRepoFilter = repoSlug ? ` repo:${repoSlug}` : "";
    const query = `"${catalogFilename}" path:${catalogPath}${optRepoFilter}`;
    const projects = this.client.listProjectsByWorkspace(workspace).iterateResults();
    let results = [];
    for await (const project of projects) {
      const projectQuery = `${query} project:${project.key}`;
      const result = await this.processQuery(workspace, projectQuery);
      results = results.concat(result);
    }
    return results;
  }
  async processQuery(workspace, query) {
    const fields = [
      // exclude code/content match details
      "-values.content_matches",
      // include/add relevant repository details
      "+values.file.commit.repository.mainbranch.name",
      "+values.file.commit.repository.project.key",
      "+values.file.commit.repository.slug",
      // remove irrelevant links
      "-values.*.links",
      "-values.*.*.links",
      "-values.*.*.*.links",
      // ...except the one we need
      "+values.file.commit.repository.links.html.href"
    ].join(",");
    const searchResults = this.client.searchCode(workspace, query, { fields }).iterateResults();
    const result = [];
    for await (const searchResult of searchResults) {
      if (searchResult.path_matches.length === 0) {
        continue;
      }
      const repository = searchResult.file.commit.repository;
      if (this.matchesFilters(repository)) {
        result.push({
          fileUrl: BitbucketCloudEntityProvider.toUrl(
            repository,
            searchResult.file.path
          ),
          repoUrl: repository.links.html.href
        });
      }
    }
    return result;
  }
  matchesFilters(repository) {
    const filters = this.config.filters;
    return !filters || (!filters.projectKey || filters.projectKey.test(repository.project.key)) && (!filters.repoSlug || filters.repoSlug.test(repository.slug));
  }
  toDeferredEntities(targets) {
    return targets.map((target) => {
      const location = BitbucketCloudEntityProvider.toLocationSpec(
        target.fileUrl
      );
      const entity = pluginCatalogNode.locationSpecToLocationEntity({ location });
      entity.metadata.annotations = {
        ...entity.metadata.annotations,
        [ANNOTATION_BITBUCKET_CLOUD_REPO_URL]: target.repoUrl
      };
      return entity;
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  static toUrl(repository, filePath) {
    const repoUrl = repository.links.html.href;
    const branch = repository.mainbranch?.name ?? DEFAULT_BRANCH;
    return `${repoUrl}/src/${branch}/${filePath}`;
  }
  static toLocationSpec(target) {
    return {
      type: "url",
      target,
      presence: "required"
    };
  }
}

exports.ANNOTATION_BITBUCKET_CLOUD_REPO_URL = ANNOTATION_BITBUCKET_CLOUD_REPO_URL;
exports.BitbucketCloudEntityProvider = BitbucketCloudEntityProvider;
//# sourceMappingURL=BitbucketCloudEntityProvider.cjs.js.map
