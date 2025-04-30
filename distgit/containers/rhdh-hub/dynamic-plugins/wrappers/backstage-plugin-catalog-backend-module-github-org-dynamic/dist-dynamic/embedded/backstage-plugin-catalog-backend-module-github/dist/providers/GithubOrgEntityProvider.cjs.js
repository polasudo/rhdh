'use strict';

var catalogModel = require('@backstage/catalog-model');
var integration = require('@backstage/integration');
var graphql = require('@octokit/graphql');
var uuid = require('uuid');
var defaultTransformers = require('../lib/defaultTransformers.cjs.js');
var github = require('../lib/github.cjs.js');
var guards = require('../lib/guards.cjs.js');
var org = require('../lib/org.cjs.js');
var util = require('../lib/util.cjs.js');
var withLocations = require('../lib/withLocations.cjs.js');

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

const EVENT_TOPICS = [
  "github.membership",
  "github.organization",
  "github.team"
];
class GithubOrgEntityProvider {
  constructor(options) {
    this.options = options;
    this.credentialsProvider = options.githubCredentialsProvider || integration.SingleInstanceGithubCredentialsProvider.create(this.options.gitHubConfig);
  }
  credentialsProvider;
  connection;
  scheduleFn;
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const gitHubConfig = integrations.github.byUrl(options.orgUrl)?.config;
    if (!gitHubConfig) {
      throw new Error(
        `There is no GitHub Org provider that matches ${options.orgUrl}. Please add a configuration for an integration.`
      );
    }
    const logger = options.logger.child({
      target: options.orgUrl
    });
    const provider = new GithubOrgEntityProvider({
      id: options.id,
      orgUrl: options.orgUrl,
      logger,
      gitHubConfig,
      githubCredentialsProvider: options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(integrations),
      userTransformer: options.userTransformer,
      teamTransformer: options.teamTransformer,
      events: options.events
    });
    provider.schedule(options.schedule);
    return provider;
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
  getProviderName() {
    return `GithubOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.options.events?.subscribe({
      id: this.getProviderName(),
      topics: EVENT_TOPICS,
      onEvent: (params) => this.onEvent(params)
    });
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
    const { headers, type: tokenType } = await this.credentialsProvider.getCredentials({
      url: this.options.orgUrl
    });
    const client = github.createGraphqlClient({
      headers,
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      logger
    });
    const { org: org$1 } = util.parseGithubOrgUrl(this.options.orgUrl);
    const { users } = await github.getOrganizationUsers(
      client,
      org$1,
      tokenType,
      this.options.userTransformer
    );
    const { teams } = await github.getOrganizationTeams(
      client,
      org$1,
      this.options.teamTransformer
    );
    if (guards.areGroupEntities(teams)) {
      org.buildOrgHierarchy(teams);
      if (guards.areUserEntities(users)) {
        org.assignGroupsToUsers(users, teams);
      }
    }
    const { markCommitComplete } = markReadComplete({ users, teams });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...teams].map((entity) => ({
        locationKey: `github-org-provider:${this.options.id}`,
        entity: withLocations.withLocations(
          `https://${this.options.gitHubConfig.host}`,
          org$1,
          entity
        )
      }))
    });
    markCommitComplete();
  }
  async onEvent(params) {
    const { logger } = this.options;
    logger.debug(`Received event from ${params.topic}`);
    const addEntitiesOperation = github.createAddEntitiesOperation(
      this.options.id,
      this.options.gitHubConfig.host
    );
    const removeEntitiesOperation = github.createRemoveEntitiesOperation(
      this.options.id,
      this.options.gitHubConfig.host
    );
    const replaceEntitiesOperation = github.createReplaceEntitiesOperation(
      this.options.id,
      this.options.gitHubConfig.host
    );
    if (params.topic.includes("organization")) {
      const orgEvent = params.eventPayload;
      if (orgEvent.action === "member_added" || orgEvent.action === "member_removed") {
        const createDeltaOperation = orgEvent.action === "member_added" ? addEntitiesOperation : removeEntitiesOperation;
        await this.onMemberChangeInOrganization(orgEvent, createDeltaOperation);
      }
    }
    if (params.topic.includes("team")) {
      const teamEvent = params.eventPayload;
      if (teamEvent.action === "created" || teamEvent.action === "deleted") {
        const createDeltaOperation = teamEvent.action === "created" ? addEntitiesOperation : removeEntitiesOperation;
        await this.onTeamChangeInOrganization(teamEvent, createDeltaOperation);
      } else if (teamEvent.action === "edited") {
        await this.onTeamEditedInOrganization(
          teamEvent,
          replaceEntitiesOperation
        );
      }
    }
    if (params.topic.includes("membership")) {
      const membershipEvent = params.eventPayload;
      this.onMembershipChangedInOrganization(
        membershipEvent,
        replaceEntitiesOperation
      );
    }
    return;
  }
  async onTeamEditedInOrganization(event, createDeltaOperation) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const teamSlug = event.team.slug;
    const { headers, type: tokenType } = await this.credentialsProvider.getCredentials({
      url: this.options.orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { org: org$1 } = util.parseGithubOrgUrl(this.options.orgUrl);
    const { team } = await github.getOrganizationTeam(
      client,
      org$1,
      teamSlug,
      this.options.teamTransformer
    );
    const { users } = await github.getOrganizationUsers(
      client,
      org$1,
      tokenType,
      this.options.userTransformer
    );
    if (!catalogModel.isGroupEntity(team)) {
      return;
    }
    const usersFromChangedGroup = team.spec.members || [];
    const usersToRebuild = users.filter(
      (u) => usersFromChangedGroup.includes(u.metadata.name)
    );
    const { teams } = await github.getOrganizationTeamsFromUsers(
      client,
      org$1,
      usersToRebuild.map((u) => u.metadata.name),
      this.options.teamTransformer
    );
    if (guards.areGroupEntities(teams)) {
      org.buildOrgHierarchy(teams);
      if (guards.areUserEntities(usersToRebuild)) {
        org.assignGroupsToUsers(usersToRebuild, teams);
      }
    }
    const oldName = event.changes.name?.from || event.team.name;
    const oldSlug = oldName.toLowerCase().replaceAll(/\s/gi, "-");
    const oldDescription = event.changes.description?.from || event.team.description;
    const oldDescriptionSlug = oldDescription?.toLowerCase().replaceAll(/\s/gi, "-");
    const { removed } = createDeltaOperation(org$1, [
      {
        ...team,
        metadata: {
          name: oldSlug,
          description: oldDescriptionSlug
        }
      }
    ]);
    const { added } = createDeltaOperation(org$1, [...usersToRebuild, ...teams]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onMembershipChangedInOrganization(event, createDeltaOperation) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    if (!("slug" in event.team)) {
      return;
    }
    const teamSlug = event.team.slug;
    const userLogin = event.member.login;
    const { headers, type: tokenType } = await this.credentialsProvider.getCredentials({
      url: this.options.orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { org: org$1 } = util.parseGithubOrgUrl(this.options.orgUrl);
    const { team } = await github.getOrganizationTeam(
      client,
      org$1,
      teamSlug,
      this.options.teamTransformer
    );
    const { users } = await github.getOrganizationUsers(
      client,
      org$1,
      tokenType,
      this.options.userTransformer
    );
    const usersToRebuild = users.filter((u) => u.metadata.name === userLogin);
    const { teams } = await github.getOrganizationTeamsFromUsers(
      client,
      org$1,
      [userLogin],
      this.options.teamTransformer
    );
    if (!teams.some((t) => t.metadata.name === team.metadata.name)) {
      teams.push(team);
    }
    if (guards.areGroupEntities(teams)) {
      org.buildOrgHierarchy(teams);
      if (guards.areUserEntities(usersToRebuild)) {
        org.assignGroupsToUsers(usersToRebuild, teams);
      }
    }
    const { added, removed } = createDeltaOperation(org$1, [
      ...usersToRebuild,
      ...teams
    ]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onTeamChangeInOrganization(event, createDeltaOperation) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const organizationTeamTransformer = this.options.teamTransformer || defaultTransformers.defaultOrganizationTeamTransformer;
    const { name, html_url: url, description, slug } = event.team;
    const org = event.organization.login;
    const { headers } = await this.credentialsProvider.getCredentials({
      url: this.options.orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const group = await organizationTeamTransformer(
      {
        name,
        slug,
        editTeamUrl: `${url}/edit`,
        combinedSlug: `${org}/${slug}`,
        description: description || void 0,
        parentTeam: event.team?.parent?.slug ? { slug: event.team.parent.slug } : void 0,
        // entity will be removed
        members: []
      },
      {
        org,
        client,
        query: ""
      }
    );
    const { added, removed } = createDeltaOperation(org, [group]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onMemberChangeInOrganization(event, createDeltaOperation) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const userTransformer = this.options.userTransformer || defaultTransformers.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.membership.user;
    const org = event.organization.login;
    const { headers } = await this.credentialsProvider.getCredentials({
      url: this.options.orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const user = await userTransformer(
      {
        name,
        avatarUrl,
        login,
        email: email || void 0,
        // we don't have this information in the event, so the refresh will handle that for us
        organizationVerifiedDomainEmails: []
      },
      {
        org,
        client,
        query: ""
      }
    );
    const { added, removed } = createDeltaOperation(org, [user]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  schedule(schedule) {
    if (!schedule || schedule === "manual") {
      return;
    }
    this.scheduleFn = async () => {
      const id = `${this.getProviderName()}:refresh`;
      await schedule.run({
        id,
        fn: async () => {
          const logger = this.options.logger.child({
            class: GithubOrgEntityProvider.prototype.constructor.name,
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
  logger.info("Reading GitHub users and teams");
  function markReadComplete(read) {
    summary = `${read.users.length} GitHub users and ${read.teams.length} GitHub teams`;
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

exports.GithubOrgEntityProvider = GithubOrgEntityProvider;
//# sourceMappingURL=GithubOrgEntityProvider.cjs.js.map
