'use strict';

var catalogModel = require('@backstage/catalog-model');
var integration = require('@backstage/integration');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var graphql = require('@octokit/graphql');
var config = require('../lib/config.cjs.js');
var github = require('../lib/github.cjs.js');
var defaultTransformers = require('../lib/defaultTransformers.cjs.js');
var org = require('../lib/org.cjs.js');
var guards = require('../lib/guards.cjs.js');

class GithubMultiOrgReaderProcessor {
  constructor(options) {
    this.options = options;
    this.integrations = options.integrations;
    this.logger = options.logger;
    this.orgs = options.orgs;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
  }
  integrations;
  orgs;
  logger;
  githubCredentialsProvider;
  static fromConfig(config$1, options) {
    const c = config$1.getOptionalConfig("catalog.processors.githubMultiOrg");
    const integrations = integration.ScmIntegrations.fromConfig(config$1);
    return new GithubMultiOrgReaderProcessor({
      ...options,
      integrations,
      orgs: c ? config.readGithubMultiOrgConfig(c) : []
    });
  }
  getProcessorName() {
    return "GithubMultiOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "github-multi-org") {
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
    const allUsersMap = /* @__PURE__ */ new Map();
    const baseUrl = new URL(location.target).origin;
    const orgsToProcess = this.orgs.length ? this.orgs : await this.getAllOrgs(gitHubConfig);
    for (const orgConfig of orgsToProcess) {
      try {
        const { headers, type: tokenType } = await this.githubCredentialsProvider.getCredentials({
          url: `${baseUrl}/${orgConfig.name}`
        });
        const client = graphql.graphql.defaults({
          baseUrl: gitHubConfig.apiBaseUrl,
          headers
        });
        const startTimestamp = Date.now();
        this.logger.info(
          `Reading GitHub users and teams for org: ${orgConfig.name}`
        );
        const { users } = await github.getOrganizationUsers(
          client,
          orgConfig.name,
          tokenType,
          async (githubUser, ctx) => {
            const result = this.options.userTransformer ? await this.options.userTransformer(githubUser, ctx) : await defaultTransformers.defaultUserTransformer(githubUser, ctx);
            if (result) {
              result.metadata.namespace = orgConfig.userNamespace;
            }
            return result;
          }
        );
        const { teams } = await github.getOrganizationTeams(
          client,
          orgConfig.name,
          async (team, ctx) => {
            const result = this.options.teamTransformer ? await this.options.teamTransformer(team, ctx) : await defaultTransformers.defaultOrganizationTeamTransformer(team, ctx);
            if (result && catalogModel.isGroupEntity(result)) {
              result.metadata.namespace = orgConfig.groupNamespace;
              result.spec.members = team.members.map(
                (user) => `${orgConfig.userNamespace ?? catalogModel.DEFAULT_NAMESPACE}/${user.login}`
              );
            }
            return result;
          }
        );
        const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
        this.logger.debug(
          `Read ${users.length} GitHub users and ${teams.length} GitHub teams from ${orgConfig.name} in ${duration} seconds`
        );
        const pendingUsers = users.map((u) => {
          const userRef = catalogModel.stringifyEntityRef(u);
          if (!allUsersMap.has(userRef)) {
            allUsersMap.set(userRef, u);
          }
          return allUsersMap.get(userRef);
        });
        if (guards.areGroupEntities(teams)) {
          org.buildOrgHierarchy(teams);
          if (guards.areUserEntities(pendingUsers)) {
            org.assignGroupsToUsers(pendingUsers, teams);
          }
        }
        for (const team of teams) {
          emit(pluginCatalogNode.processingResult.entity(location, team));
        }
      } catch (e) {
        this.logger.error(
          `Failed to read GitHub org data for ${orgConfig.name}: ${e}`
        );
      }
    }
    const allUsers = Array.from(allUsersMap.values());
    for (const user of allUsers) {
      emit(pluginCatalogNode.processingResult.entity(location, user));
    }
    return true;
  }
  // Note: Does not support usage of PATs
  async getAllOrgs(gitHubConfig) {
    const githubAppMux = new integration.GithubAppCredentialsMux(gitHubConfig);
    const installs = await githubAppMux.getAllInstallations();
    return installs.map(
      (install) => install.target_type === "Organization" && install.account && "login" in install.account && install.account.login ? {
        name: install.account.login,
        groupNamespace: install.account.login.toLowerCase()
      } : void 0
    ).filter(Boolean);
  }
}

exports.GithubMultiOrgReaderProcessor = GithubMultiOrgReaderProcessor;
//# sourceMappingURL=GithubMultiOrgReaderProcessor.cjs.js.map
