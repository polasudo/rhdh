'use strict';

var integration = require('@backstage/integration');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var graphql = require('@octokit/graphql');
var github = require('../lib/github.cjs.js');
var org = require('../lib/org.cjs.js');
var util = require('../lib/util.cjs.js');
var guards = require('../lib/guards.cjs.js');

class GithubOrgReaderProcessor {
  integrations;
  logger;
  githubCredentialsProvider;
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    return new GithubOrgReaderProcessor({
      ...options,
      integrations
    });
  }
  constructor(options) {
    this.integrations = options.integrations;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.logger = options.logger;
  }
  getProcessorName() {
    return "GithubOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "github-org") {
      return false;
    }
    const { client, tokenType } = await this.createClient(location.target);
    const { org: org$1 } = util.parseGithubOrgUrl(location.target);
    const startTimestamp = Date.now();
    this.logger.info("Reading GitHub users and groups");
    const { users } = await github.getOrganizationUsers(client, org$1, tokenType);
    const { teams } = await github.getOrganizationTeams(client, org$1);
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${users.length} GitHub users and ${teams.length} GitHub teams in ${duration} seconds`
    );
    if (guards.areGroupEntities(teams)) {
      org.buildOrgHierarchy(teams);
      if (guards.areUserEntities(users)) {
        org.assignGroupsToUsers(users, teams);
      }
    }
    for (const team of teams) {
      emit(pluginCatalogNode.processingResult.entity(location, team));
    }
    for (const user of users) {
      emit(pluginCatalogNode.processingResult.entity(location, user));
    }
    return true;
  }
  async createClient(orgUrl) {
    const gitHubConfig = this.integrations.github.byUrl(orgUrl)?.config;
    if (!gitHubConfig) {
      throw new Error(
        `There is no GitHub Org provider that matches ${orgUrl}. Please add a configuration for an integration.`
      );
    }
    const { headers, type: tokenType } = await this.githubCredentialsProvider.getCredentials({
      url: orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: gitHubConfig.apiBaseUrl,
      headers
    });
    return { client, tokenType };
  }
}

exports.GithubOrgReaderProcessor = GithubOrgReaderProcessor;
//# sourceMappingURL=GithubOrgReaderProcessor.cjs.js.map
