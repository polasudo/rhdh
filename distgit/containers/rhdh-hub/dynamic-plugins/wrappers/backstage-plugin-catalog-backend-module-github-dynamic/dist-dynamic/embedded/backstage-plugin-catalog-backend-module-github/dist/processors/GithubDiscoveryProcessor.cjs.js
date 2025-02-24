'use strict';

var integration = require('@backstage/integration');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var graphql = require('@octokit/graphql');
var github = require('../lib/github.cjs.js');
require('@backstage/catalog-model');

class GithubDiscoveryProcessor {
  integrations;
  logger;
  githubCredentialsProvider;
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    return new GithubDiscoveryProcessor({
      ...options,
      integrations
    });
  }
  constructor(options) {
    this.integrations = options.integrations;
    this.logger = options.logger;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
  }
  getProcessorName() {
    return "GithubDiscoveryProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "github-discovery") {
      return false;
    }
    const gitHubConfig = this.integrations.github.byUrl(
      location.target
    )?.config;
    if (!gitHubConfig) {
      throw new Error(
        `There is no GitHub integration that matches ${location.target}. Please add a configuration entry for it under integrations.github`
      );
    }
    const { org, repoSearchPath, catalogPath, branch, host } = parseUrl(
      location.target
    );
    const orgUrl = `https://${host}/${org}`;
    const { headers } = await this.githubCredentialsProvider.getCredentials({
      url: orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: gitHubConfig.apiBaseUrl,
      headers
    });
    const startTimestamp = Date.now();
    this.logger.info(`Reading GitHub repositories from ${location.target}`);
    const { repositories } = await github.getOrganizationRepositories(
      client,
      org,
      catalogPath
    );
    const matching = repositories.filter(
      (r) => !r.isArchived && repoSearchPath.test(r.name)
    );
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${repositories.length} GitHub repositories (${matching.length} matching the pattern) in ${duration} seconds`
    );
    for (const repository of matching) {
      const branchName = branch === "-" ? repository.defaultBranchRef?.name : branch;
      if (!branchName) {
        this.logger.info(
          `the repository ${repository.url} does not have a default branch, skipping`
        );
        continue;
      }
      const path = `/blob/${branchName}${catalogPath}`;
      emit(
        pluginCatalogNode.processingResult.location({
          type: "url",
          target: `${repository.url}${path}`,
          // Not all locations may actually exist, since the user defined them as a wildcard pattern.
          // Thus, we emit them as optional and let the downstream processor find them while not outputting
          // an error if it couldn't.
          presence: "optional"
        })
      );
    }
    return true;
  }
}
function parseUrl(urlString) {
  const url = new URL(urlString);
  const path = url.pathname.slice(1).split("/");
  if (path.length > 2 && path[0].length && path[1].length) {
    return {
      org: decodeURIComponent(path[0]),
      repoSearchPath: escapeRegExp(decodeURIComponent(path[1])),
      branch: decodeURIComponent(path[3]),
      catalogPath: `/${decodeURIComponent(path.slice(4).join("/"))}`,
      host: url.host
    };
  } else if (path.length === 1 && path[0].length) {
    return {
      org: decodeURIComponent(path[0]),
      host: url.host,
      repoSearchPath: escapeRegExp("*"),
      catalogPath: "/catalog-info.yaml",
      branch: "-"
    };
  }
  throw new Error(`Failed to parse ${urlString}`);
}
function escapeRegExp(str) {
  return new RegExp(`^${str.replace(/\*/g, ".*")}$`);
}

exports.GithubDiscoveryProcessor = GithubDiscoveryProcessor;
exports.escapeRegExp = escapeRegExp;
exports.parseUrl = parseUrl;
//# sourceMappingURL=GithubDiscoveryProcessor.cjs.js.map
