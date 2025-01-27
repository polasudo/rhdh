'use strict';

var integration = require('@backstage/integration');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var uuid = require('uuid');
var config = require('./config.cjs.js');
var client = require('../lib/client.cjs.js');
var path = require('path');

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
var path__namespace = /*#__PURE__*/_interopNamespaceCompat(path);

const TOPIC_REPO_PUSH = "gitlab.push";
class GitlabDiscoveryEntityProvider {
  config;
  integration;
  logger;
  scheduleFn;
  connection;
  events;
  gitLabClient;
  static fromConfig(config$1, options) {
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    const providerConfigs = config.readGitlabConfigs(config$1);
    const integrations = integration.ScmIntegrations.fromConfig(config$1).gitlab;
    const providers = [];
    providerConfigs.forEach((providerConfig) => {
      const integration = integrations.byHost(providerConfig.host);
      if (!integration) {
        throw new Error(
          `No gitlab integration found that matches host ${providerConfig.host}`
        );
      }
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for GitlabDiscoveryEntityProvider:${providerConfig.id}.`
        );
      }
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      providers.push(
        new GitlabDiscoveryEntityProvider({
          ...options,
          config: providerConfig,
          integration,
          taskRunner
        })
      );
    });
    return providers;
  }
  /**
   * Constructs a GitlabDiscoveryEntityProvider instance.
   *
   * @param options - Configuration options including config, integration, logger, and taskRunner.
   */
  constructor(options) {
    this.config = options.config;
    this.integration = options.integration;
    this.logger = options.logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(options.taskRunner);
    this.events = options.events;
    this.gitLabClient = new client.GitLabClient({
      config: this.integration.config,
      logger: this.logger
    });
  }
  getProviderName() {
    return `GitlabDiscoveryEntityProvider:${this.config.id}`;
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
    if (this.events) {
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
  }
  /**
   * Creates a scheduled task runner for refreshing the entity provider.
   *
   * @param taskRunner - The task runner instance.
   * @returns The scheduled function.
   */
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: GitlabDiscoveryEntityProvider.prototype.constructor.name,
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
  /**
   * Performs a full scan on the GitLab instance searching for locations to be ingested
   *
   * @param logger - The logger instance for logging.
   */
  async refresh(logger) {
    if (!this.connection) {
      throw new Error(
        `Gitlab discovery connection not initialized for ${this.getProviderName()}`
      );
    }
    const projects = client.paginated(
      (options) => this.gitLabClient.listProjects(options),
      {
        group: this.config.group,
        page: 1,
        per_page: 50,
        ...!this.config.includeArchivedRepos && { archived: false }
      }
    );
    const res = {
      scanned: 0,
      matches: []
    };
    for await (const project of projects) {
      if (await this.shouldProcessProject(project, this.gitLabClient)) {
        res.scanned++;
        res.matches.push(project);
      }
    }
    const locations = res.matches.map((p) => this.createLocationSpec(p));
    logger.info(
      `Processed ${locations.length} from scanned ${res.scanned} projects.`
    );
    await this.connection.applyMutation({
      type: "full",
      entities: locations.map((location) => ({
        locationKey: this.getProviderName(),
        entity: pluginCatalogNode.locationSpecToLocationEntity({ location })
      }))
    });
  }
  createLocationSpec(project) {
    const project_branch = this.config.branch ?? project.default_branch ?? this.config.fallbackBranch;
    return {
      type: "url",
      target: `${project.web_url}/-/blob/${project_branch}/${this.config.catalogFile}`,
      presence: "optional"
    };
  }
  /**
   * Handles the "gitlab.push" event.
   *
   * @param event - The push event payload.
   */
  async onRepoPush(event) {
    if (!this.connection) {
      throw new Error(
        `Gitlab discovery connection not initialized for ${this.getProviderName()}`
      );
    }
    this.logger.info(
      `Received push event for ${event.project.path_with_namespace}`
    );
    const project = await this.gitLabClient.getProjectById(event.project_id);
    if (!project) {
      this.logger.debug(
        `Ignoring push event for ${event.project.path_with_namespace}`
      );
      return;
    }
    if (!await this.shouldProcessProject(project, this.gitLabClient)) {
      this.logger.debug(`Skipping event ${event.project.path_with_namespace}`);
      return;
    }
    const added = this.getFilesMatchingConfig(
      event,
      "added",
      this.config.catalogFile
    );
    const removed = this.getFilesMatchingConfig(
      event,
      "removed",
      this.config.catalogFile
    );
    const modified = this.getFilesMatchingConfig(
      event,
      "modified",
      this.config.catalogFile
    );
    const addedEntities = this.createLocationSpecCommitedFiles(
      event.project,
      added
    );
    const removedEntities = this.createLocationSpecCommitedFiles(
      event.project,
      removed
    );
    if (addedEntities.length > 0 || removedEntities.length > 0) {
      await this.connection.applyMutation({
        type: "delta",
        added: this.toDeferredEntities(
          addedEntities.map((entity) => entity.target)
        ),
        removed: this.toDeferredEntities(
          removedEntities.map((entity) => entity.target)
        )
      });
    }
    if (modified.length > 0) {
      const projectBranch = this.config.branch ?? event.project.default_branch ?? this.config.fallbackBranch;
      await this.connection.refresh({
        keys: [
          ...modified.map(
            (filePath) => `url:${event.project.web_url}/-/tree/${projectBranch}/${filePath}`
          ),
          ...modified.map(
            (filePath) => `url:${event.project.web_url}/-/blob/${projectBranch}/${filePath}`
          )
        ]
      });
    }
    this.logger.info(
      `Processed GitLab push event from ${event.project.web_url}: added ${added.length} - removed ${removed.length} - modified ${modified.length}`
    );
  }
  /**
   * Gets files matching the specified commit action and catalog file name.
   *
   * @param event - The push event payload.
   * @param action - The action type ('added', 'removed', or 'modified').
   * @param catalogFile - The catalog file name.
   * @returns An array of file paths.
   */
  getFilesMatchingConfig(event, action, catalogFile) {
    if (!event.commits) {
      return [];
    }
    const matchingFiles = event.commits.flatMap(
      (element) => element[action].filter(
        (file) => path__namespace.basename(file) === catalogFile
      )
    );
    if (matchingFiles.length === 0) {
      this.logger.debug(
        `No files matching '${catalogFile}' found in the commits.`
      );
    }
    return matchingFiles;
  }
  /**
   * Creates Backstage location specs for committed files.
   *
   * @param project - The GitLab project information.
   * @param addedFiles - The array of added file paths.
   * @returns An array of location specs.
   */
  createLocationSpecCommitedFiles(project, addedFiles) {
    const projectBranch = this.config.branch ?? project.default_branch ?? this.config.fallbackBranch;
    const matchingFiles = addedFiles.filter(
      (file) => path__namespace.basename(file) === this.config.catalogFile
    );
    const locationSpecs = matchingFiles.map((file) => ({
      type: "url",
      target: `${project.web_url}/-/blob/${projectBranch}/${file}`,
      presence: "optional"
    }));
    return locationSpecs;
  }
  /**
   * Converts a target URL to a LocationSpec object.
   *
   * @param target - The target URL to be converted.
   * @returns The LocationSpec object representing the URL.
   */
  toLocationSpec(target) {
    return {
      type: "url",
      target,
      presence: "optional"
    };
  }
  toDeferredEntities(targets) {
    return targets.map((target) => {
      const location = this.toLocationSpec(target);
      return pluginCatalogNode.locationSpecToLocationEntity({ location });
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  async shouldProcessProject(project, client) {
    if (!this.config.projectPattern.test(project.path_with_namespace ?? "")) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it does not match the project pattern ${this.config.projectPattern}.`
      );
      return false;
    }
    if (this.config.group && !project.path_with_namespace.startsWith(`${this.config.group}/`)) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it does not match the group pattern ${this.config.group}.`
      );
      return false;
    }
    if (this.config.skipForkedRepos && project.hasOwnProperty("forked_from_project")) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it is a forked project.`
      );
      return false;
    }
    if (this.config.excludeRepos?.includes(project.path_with_namespace ?? "")) {
      this.logger.debug(
        `Skipping project ${project.path_with_namespace} as it is excluded.`
      );
      return false;
    }
    const project_branch = this.config.branch ?? project.default_branch ?? this.config.fallbackBranch;
    const hasFile = await client.hasFile(
      project.path_with_namespace ?? "",
      project_branch,
      this.config.catalogFile
    );
    return hasFile;
  }
}

exports.GitlabDiscoveryEntityProvider = GitlabDiscoveryEntityProvider;
//# sourceMappingURL=GitlabDiscoveryEntityProvider.cjs.js.map
