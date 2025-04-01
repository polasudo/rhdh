'use strict';

var integration = require('@backstage/integration');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var graphql = require('@octokit/graphql');
var uuid = require('uuid');
var GithubEntityProviderConfig = require('./GithubEntityProviderConfig.cjs.js');
var github = require('../lib/github.cjs.js');
var util = require('../lib/util.cjs.js');
var minimatch = require('minimatch');

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

const EVENT_TOPICS = ["github.push", "github.repository"];
class GithubEntityProvider {
  config;
  events;
  logger;
  integration;
  scheduleFn;
  connection;
  githubCredentialsProvider;
  static fromConfig(config, options) {
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    const integrations = integration.ScmIntegrations.fromConfig(config);
    return GithubEntityProviderConfig.readProviderConfigs(config).map((providerConfig) => {
      const integrationHost = providerConfig.host;
      const integration = integrations.github.byHost(integrationHost);
      if (!integration) {
        throw new Error(
          `There is no GitHub config that matches host ${integrationHost}. Please add a configuration entry for it under integrations.github`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new GithubEntityProvider(
        providerConfig,
        integration,
        options.logger,
        taskRunner,
        options.events
      );
    });
  }
  constructor(config, integration$1, logger, taskRunner, events) {
    this.config = config;
    this.events = events;
    this.integration = integration$1.config;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
    this.githubCredentialsProvider = integration.SingleInstanceGithubCredentialsProvider.create(integration$1.config);
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
  getProviderName() {
    return `github-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.events?.subscribe({
      id: this.getProviderName(),
      topics: EVENT_TOPICS,
      onEvent: (params) => this.onEvent(params)
    });
    return await this.scheduleFn();
  }
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: GithubEntityProvider.prototype.constructor.name,
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
  async refresh(logger) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const targets = await this.findCatalogFiles();
    const matchingTargets = this.matchesFilters(targets);
    const entities = this.toDeferredEntitiesFromRepos(matchingTargets);
    await this.connection.applyMutation({
      type: "full",
      entities
    });
    logger.info(
      `Read ${targets.length} GitHub repositories (${entities.length} matching the pattern)`
    );
  }
  async createGraphqlClient() {
    const organization = this.config.organization;
    const host = this.integration.host;
    const orgUrl = `https://${host}/${organization}`;
    const { headers } = await this.githubCredentialsProvider.getCredentials({
      url: orgUrl
    });
    return graphql.graphql.defaults({
      baseUrl: this.integration.apiBaseUrl,
      headers
    });
  }
  // go to the server and get all repositories
  async findCatalogFiles() {
    const organization = this.config.organization;
    const catalogPath = this.config.catalogPath;
    const client = await this.createGraphqlClient();
    const { repositories: repositoriesFromGithub } = await github.getOrganizationRepositories(client, organization, catalogPath);
    const repositories = repositoriesFromGithub.map(
      this.createRepoFromGithubResponse
    );
    if (this.config.validateLocationsExist) {
      return repositories.filter(
        (repository) => repository.isCatalogInfoFilePresent
      );
    }
    return repositories;
  }
  matchesFilters(repositories) {
    const repositoryFilter = this.config.filters?.repository;
    const topicFilters = this.config.filters?.topic;
    const allowForks = this.config.filters?.allowForks ?? true;
    const visibilities = this.config.filters?.visibility ?? [];
    return repositories.filter((r) => {
      const repoTopics = r.repositoryTopics;
      return !r.isArchived && (!repositoryFilter || repositoryFilter.test(r.name)) && util.satisfiesTopicFilter(repoTopics, topicFilters) && util.satisfiesForkFilter(allowForks, r.isFork) && util.satisfiesVisibilityFilter(visibilities, r.visibility) && r.defaultBranchRef;
    });
  }
  createLocationUrl(repository) {
    const branch = this.config.filters?.branch || repository.defaultBranchRef || "-";
    const catalogFile = this.config.catalogPath.startsWith("/") ? this.config.catalogPath.substring(1) : this.config.catalogPath;
    return `${repository.url}/blob/${branch}/${catalogFile}`;
  }
  static toLocationSpec(target) {
    return {
      type: "url",
      target,
      presence: "optional"
    };
  }
  /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.onEvent} */
  async onEvent(params) {
    this.logger.debug(`Received event for topic ${params.topic}`);
    if (EVENT_TOPICS.some((topic) => topic === params.topic)) {
      if (!this.connection) {
        throw new Error("Not initialized");
      }
      switch (params.topic) {
        case "github.push":
          await this.onPush(params.eventPayload);
          return;
        case "github.repository":
          await this.onRepoChange(params.eventPayload);
          return;
        default:
          this.logger.warn(
            `Missing implementation for event of topic ${params.topic}`
          );
      }
    }
  }
  /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.supportsEventTopics} */
  supportsEventTopics() {
    return EVENT_TOPICS;
  }
  async onPush(event) {
    if (this.config.organization !== event.organization?.login) {
      this.logger.debug(
        `skipping push event from organization ${event.organization?.login}`
      );
      return;
    }
    const repoName = event.repository.name;
    const repoUrl = event.repository.html_url;
    this.logger.debug(`handle github:push event for ${repoName} - ${repoUrl}`);
    const branch = this.config.filters?.branch || event.repository.default_branch;
    if (!event.ref.includes(branch)) {
      this.logger.debug(`skipping push event from ref ${event.ref}`);
      return;
    }
    const repository = this.createRepoFromEvent(event);
    const matchingTargets = this.matchesFilters([repository]);
    if (matchingTargets.length === 0) {
      this.logger.debug(
        `skipping push event from repository ${repoName} because didn't match provider filters`
      );
      return;
    }
    const added = this.collectDeferredEntitiesFromCommit(
      repoUrl,
      branch,
      event.commits,
      (commit) => [...commit.added]
    );
    const removed = this.collectDeferredEntitiesFromCommit(
      repoUrl,
      branch,
      event.commits,
      (commit) => [...commit.removed]
    );
    const modified = this.collectFilesFromCommit(
      event.commits,
      (commit) => [...commit.modified]
    );
    if (modified.length > 0) {
      const catalogPath = this.config.catalogPath.startsWith("/") ? this.config.catalogPath.substring(1) : this.config.catalogPath;
      await this.connection.refresh({
        keys: [
          .../* @__PURE__ */ new Set([
            ...modified.map(
              (filePath) => `url:${repoUrl}/tree/${branch}/${filePath}`
            ),
            ...modified.map(
              (filePath) => `url:${repoUrl}/blob/${branch}/${filePath}`
            ),
            `url:${repoUrl}/tree/${branch}/${catalogPath}`
          ])
        ]
      });
    }
    if (added.length > 0 || removed.length > 0) {
      await this.connection.applyMutation({
        type: "delta",
        added,
        removed
      });
    }
    this.logger.info(
      `Processed Github push event: added ${added.length} - removed ${removed.length} - modified ${modified.length}`
    );
  }
  async onRepoChange(event) {
    if (this.config.organization !== event.organization?.login) {
      this.logger.debug(
        `skipping repository event from organization ${event.organization?.login}`
      );
      return;
    }
    const action = event.action;
    switch (action) {
      case "archived":
        await this.onRepoArchived(event);
        return;
      // A repository was created.
      case "created":
        return;
      case "deleted":
        await this.onRepoDeleted(event);
        return;
      case "edited":
        await this.onRepoEdited(event);
        return;
      // The visibility of a repository was changed to `private`.
      case "privatized":
        return;
      // The visibility of a repository was changed to `public`.
      case "publicized":
        return;
      case "renamed":
        await this.onRepoRenamed(event);
        return;
      case "transferred":
        await this.onRepoTransferred(event);
        return;
      case "unarchived":
        await this.onRepoUnarchived(event);
        return;
      default:
        this.logger.warn(
          `Missing implementation for event of topic repository with action ${action}`
        );
    }
  }
  /**
   * A repository was archived.
   *
   * Removes all entities associated with the repository.
   *
   * @param event - The repository archived event.
   */
  async onRepoArchived(event) {
    const repository = this.createRepoFromEvent(event);
    await this.removeEntitiesForRepo(repository);
    this.logger.debug(
      `Removed entities for archived repository ${repository.name}`
    );
  }
  /**
   * A repository was deleted.
   *
   * Removes all entities associated with the repository.
   *
   * @param event - The repository deleted event.
   */
  async onRepoDeleted(event) {
    const repository = this.createRepoFromEvent(event);
    await this.removeEntitiesForRepo(repository);
    this.logger.debug(
      `Removed entities for deleted repository ${repository.name}`
    );
  }
  /**
   * The topics, default branch, description, or homepage of a repository was changed.
   *
   * We are interested in potential topic changes as these can be used as part of the filters.
   *
   * Removes all entities associated with the repository if the repository no longer matches the filters.
   *
   * @param event - The repository edited event.
   */
  async onRepoEdited(event) {
    const repository = this.createRepoFromEvent(event);
    const matchingTargets = this.matchesFilters([repository]);
    if (matchingTargets.length === 0) {
      await this.removeEntitiesForRepo(repository);
    }
  }
  /**
   * The name of a repository was changed.
   *
   * Removes all entities associated with the repository's old name.
   * Creates new entities for the repository's new name if it still matches the filters.
   *
   * @param event - The repository renamed event.
   */
  async onRepoRenamed(event) {
    const repository = this.createRepoFromEvent(event);
    const oldRepoName = event.changes.repository.name.from;
    const urlParts = repository.url.split("/");
    urlParts[urlParts.length - 1] = oldRepoName;
    const oldRepoUrl = urlParts.join("/");
    const oldRepository = {
      ...repository,
      name: oldRepoName,
      url: oldRepoUrl
    };
    await this.removeEntitiesForRepo(oldRepository);
    const matchingTargets = this.matchesFilters([repository]);
    if (matchingTargets.length === 0) {
      this.logger.debug(
        `skipping repository renamed event for repository ${repository.name} because it didn't match provider filters`
      );
      return;
    }
    await this.addEntitiesForRepo(repository);
  }
  /**
   * Ownership of the repository was transferred to a user or organization account.
   * This event is only sent to the account where the ownership is transferred.
   * To receive the `repository.transferred` event, the new owner account must have the GitHub App installed,
   * and the App must be subscribed to "Repository" events.
   *
   * Creates new entities for the repository if it matches the filters.
   *
   * @param event - The repository unarchived event.
   */
  async onRepoTransferred(event) {
    const repository = this.createRepoFromEvent(event);
    const matchingTargets = this.matchesFilters([repository]);
    if (matchingTargets.length === 0) {
      this.logger.debug(
        `skipping repository transferred event for repository ${repository.name} because it didn't match provider filters`
      );
      return;
    }
    await this.addEntitiesForRepo(repository);
  }
  /**
   * A previously archived repository was unarchived.
   *
   * Creates new entities for the repository if it matches the filters.
   *
   * @param event - The repository unarchived event.
   */
  async onRepoUnarchived(event) {
    const repository = this.createRepoFromEvent(event);
    const matchingTargets = this.matchesFilters([repository]);
    if (matchingTargets.length === 0) {
      this.logger.debug(
        `skipping repository unarchived event for repository ${repository.name} because it didn't match provider filters`
      );
      return;
    }
    await this.addEntitiesForRepo(repository);
  }
  async removeEntitiesForRepo(repository) {
    const removed = this.toDeferredEntitiesFromRepos([repository]);
    await this.connection.applyMutation({
      type: "delta",
      added: [],
      removed
    });
  }
  async addEntitiesForRepo(repository) {
    if (this.config.validateLocationsExist) {
      const organization = this.config.organization;
      const catalogPath = this.config.catalogPath;
      const client = await this.createGraphqlClient();
      const repositoryFromGithub = await github.getOrganizationRepository(
        client,
        organization,
        repository.name,
        catalogPath
      ).then((r) => r ? this.createRepoFromGithubResponse(r) : null);
      if (!repositoryFromGithub?.isCatalogInfoFilePresent) {
        return;
      }
    }
    const added = this.toDeferredEntitiesFromRepos([repository]);
    await this.connection.applyMutation({
      type: "delta",
      added,
      removed: []
    });
  }
  createRepoFromEvent(event) {
    return {
      // $.repository.url can be a value like
      // "https://api.github.com/repos/{org}/{repo}"
      // or "https://github.com/{org}/{repo}"
      url: event.repository.html_url,
      name: event.repository.name,
      defaultBranchRef: event.repository.default_branch,
      repositoryTopics: event.repository.topics,
      isArchived: event.repository.archived,
      isFork: event.repository.fork,
      // we can consider this file present because
      // only the catalog file will be recovered from the commits
      isCatalogInfoFilePresent: true,
      visibility: event.repository.visibility
    };
  }
  createRepoFromGithubResponse(repositoryResponse) {
    return {
      url: repositoryResponse.url,
      name: repositoryResponse.name,
      defaultBranchRef: repositoryResponse.defaultBranchRef?.name,
      repositoryTopics: repositoryResponse.repositoryTopics.nodes.map(
        (t) => t.topic.name
      ),
      isArchived: repositoryResponse.isArchived,
      isFork: repositoryResponse.isFork,
      isCatalogInfoFilePresent: repositoryResponse.catalogInfoFile?.__typename === "Blob" && repositoryResponse.catalogInfoFile.text !== "",
      visibility: repositoryResponse.visibility
    };
  }
  collectDeferredEntitiesFromCommit(repositoryUrl, branch, commits, transformOperation) {
    const catalogFiles = this.collectFilesFromCommit(
      commits,
      transformOperation
    );
    return this.toDeferredEntities(
      catalogFiles.map(
        (filePath) => `${repositoryUrl}/blob/${branch}/${filePath}`
      )
    );
  }
  collectFilesFromCommit(commits, transformOperation) {
    const catalogFile = this.config.catalogPath.startsWith("/") ? this.config.catalogPath.substring(1) : this.config.catalogPath;
    const matcher = new minimatch.Minimatch(catalogFile);
    return commits.map(transformOperation).flat().filter((file) => matcher.match(file));
  }
  toDeferredEntities(targets) {
    return targets.map((target) => {
      const location = GithubEntityProvider.toLocationSpec(target);
      return pluginCatalogNode.locationSpecToLocationEntity({ location });
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  toDeferredEntitiesFromRepos(repositories) {
    return repositories.map((repository) => this.createLocationUrl(repository)).map(GithubEntityProvider.toLocationSpec).map((location) => {
      return {
        locationKey: this.getProviderName(),
        entity: pluginCatalogNode.locationSpecToLocationEntity({ location })
      };
    });
  }
}

exports.GithubEntityProvider = GithubEntityProvider;
//# sourceMappingURL=GithubEntityProvider.cjs.js.map
