'use strict';

var catalogModel = require('@backstage/catalog-model');
var integration = require('@backstage/integration');
var graphql = require('@octokit/graphql');
var lodash = require('lodash');
var uuid = require('uuid');
var github = require('../lib/github.cjs.js');
var defaultTransformers = require('../lib/defaultTransformers.cjs.js');
var org = require('../lib/org.cjs.js');
var util = require('../lib/util.cjs.js');
var annotation = require('../lib/annotation.cjs.js');
var guards = require('../lib/guards.cjs.js');

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
  "github.installation",
  "github.membership",
  "github.organization",
  "github.team"
];
class GithubMultiOrgEntityProvider {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const gitHubConfig = integrations.github.byUrl(options.githubUrl)?.config;
    if (!gitHubConfig) {
      throw new Error(
        `There is no GitHub integration that matches ${options.githubUrl}. Please add a configuration entry for it under integrations.github.`
      );
    }
    const logger = options.logger.child({
      target: options.githubUrl
    });
    const provider = new GithubMultiOrgEntityProvider({
      id: options.id,
      gitHubConfig,
      githubCredentialsProvider: options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(integrations),
      githubUrl: new URL(options.githubUrl).origin,
      logger,
      orgs: options.orgs,
      userTransformer: options.userTransformer,
      teamTransformer: options.teamTransformer,
      events: options.events,
      alwaysUseDefaultNamespace: options.alwaysUseDefaultNamespace
    });
    provider.schedule(options.schedule);
    return provider;
  }
  /** {@inheritdoc @backstage/plugin-catalog-node#EntityProvider.getProviderName} */
  getProviderName() {
    return `GithubMultiOrgEntityProvider:${this.options.id}`;
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
    const allUsersMap = /* @__PURE__ */ new Map();
    const allTeams = [];
    const orgsToProcess = this.options.orgs?.length ? this.options.orgs : await this.getAllOrgs(this.options.gitHubConfig);
    for (const org$1 of orgsToProcess) {
      const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
        url: `${this.options.githubUrl}/${org$1}`
      });
      const client = graphql.graphql.defaults({
        baseUrl: this.options.gitHubConfig.apiBaseUrl,
        headers
      });
      logger.info(`Reading GitHub users and teams for org: ${org$1}`);
      const { users } = await github.getOrganizationUsers(
        client,
        org$1,
        tokenType,
        this.options.userTransformer
      );
      const { teams } = await github.getOrganizationTeams(
        client,
        org$1,
        this.defaultMultiOrgTeamTransformer.bind(this)
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
      allTeams.push(...teams);
    }
    const allUsers = Array.from(allUsersMap.values());
    const { markCommitComplete } = markReadComplete({ allUsers, allTeams });
    await this.connection.applyMutation({
      type: "full",
      entities: [...allUsers, ...allTeams].map((entity) => ({
        locationKey: `github-multi-org-provider:${this.options.id}`,
        entity: withLocations(
          `https://${this.options.gitHubConfig.host}`,
          entity
        )
      }))
    });
    markCommitComplete();
  }
  async onEvent(params) {
    const { logger } = this.options;
    logger.debug(`Received event from ${params.topic}`);
    const orgs = this.options.orgs?.length ? this.options.orgs : await this.getAllOrgs(this.options.gitHubConfig);
    const eventPayload = params.eventPayload;
    if (!orgs.includes(
      eventPayload.installation?.account?.login
    ) && !orgs.includes(
      eventPayload.organization?.login
    )) {
      return;
    }
    if (params.topic.includes("installation") && eventPayload.action === "created") {
      await this.onInstallationChange(
        eventPayload,
        orgs
      );
    }
    if (params.topic.includes("organization") && (eventPayload.action === "member_added" || eventPayload.action === "member_removed")) {
      await this.onMemberChangeInOrganization(eventPayload, orgs);
    }
    if (params.topic.includes("team")) {
      if (eventPayload.action === "created" || eventPayload.action === "deleted") {
        await this.onTeamChangeInOrganization(
          eventPayload
        );
      } else if (eventPayload.action === "edited") {
        await this.onTeamEditedInOrganization(
          eventPayload,
          orgs
        );
      }
    }
    if (params.topic.includes("membership")) {
      await this.onMembershipChangedInTeam(
        eventPayload,
        orgs
      );
    }
    return;
  }
  async onInstallationChange(event, applicableOrgs) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const org$1 = event.installation.account.login;
    const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { users } = await github.getOrganizationUsers(
      client,
      org$1,
      tokenType,
      this.options.userTransformer
    );
    const { teams } = await github.getOrganizationTeams(
      client,
      org$1,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    if (users.length) {
      for (const userOrg of applicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams: userTeams } = await github.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          users.map(
            (u) => u.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || u.metadata.name
          ),
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (guards.areGroupEntities(userTeams) && guards.areUserEntities(users)) {
          org.assignGroupsToUsers(users, userTeams);
        }
      }
    }
    const { added, removed } = this.createAddEntitiesOperation([
      ...users,
      ...teams
    ]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onMemberChangeInOrganization(event, applicableOrgs) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const userTransformer = this.options.userTransformer || defaultTransformers.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.membership.user;
    const org$1 = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { orgs } = await github.getOrganizationsFromUser(client, login);
    const userApplicableOrgs = orgs.filter((o) => applicableOrgs.includes(o));
    let updateMemberships;
    let createDeltaOperation;
    if (event.action === "member_removed") {
      if (userApplicableOrgs.length) {
        createDeltaOperation = this.createAddEntitiesOperation.bind(this);
        updateMemberships = true;
      } else {
        createDeltaOperation = this.createRemoveEntitiesOperation.bind(this);
        updateMemberships = false;
      }
    } else {
      createDeltaOperation = this.createAddEntitiesOperation.bind(this);
      updateMemberships = true;
    }
    const user = await userTransformer(
      {
        name,
        avatarUrl,
        login,
        email: email ?? void 0
      },
      {
        org: org$1,
        client,
        query: ""
      }
    );
    if (!user) {
      return;
    }
    if (updateMemberships) {
      for (const userOrg of userApplicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await github.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          [login],
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (catalogModel.isUserEntity(user) && guards.areGroupEntities(teams)) {
          org.assignGroupsToUsers([user], teams);
        }
      }
    }
    const { added, removed } = createDeltaOperation([user]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onTeamChangeInOrganization(event) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const org = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { name, html_url: url, description, slug } = event.team;
    const group = await this.defaultMultiOrgTeamTransformer(
      {
        name,
        slug,
        editTeamUrl: `${url}/edit`,
        combinedSlug: `${org}/${slug}`,
        description: description ?? void 0,
        parentTeam: event.team?.parent?.slug ? { slug: event.team.parent.slug } : void 0,
        // entity will be removed or is new
        members: []
      },
      {
        org,
        client,
        query: ""
      }
    );
    const createDeltaOperation = event.action === "created" ? this.createAddEntitiesOperation.bind(this) : this.createRemoveEntitiesOperation.bind(this);
    const { added, removed } = createDeltaOperation([group]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onTeamEditedInOrganization(event, applicableOrgs) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const org$1 = event.organization.login;
    const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const teamSlug = event.team.slug;
    const { team } = await github.getOrganizationTeam(
      client,
      org$1,
      teamSlug,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    const { users } = await github.getOrganizationUsers(
      client,
      org$1,
      tokenType,
      this.options.userTransformer
    );
    const usersFromChangedGroup = catalogModel.isGroupEntity(team) ? team.spec.members?.map(
      (m) => catalogModel.stringifyEntityRef(catalogModel.parseEntityRef(m, { defaultKind: "user" }))
    ) || [] : [];
    const usersToRebuild = users.filter(
      (u) => usersFromChangedGroup.includes(catalogModel.stringifyEntityRef(u))
    );
    if (usersToRebuild.length) {
      for (const userOrg of applicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await github.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          usersToRebuild.map(
            (u) => u.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || u.metadata.name
          ),
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (guards.areGroupEntities(teams) && guards.areUserEntities(usersToRebuild)) {
          org.assignGroupsToUsers(usersToRebuild, teams);
        }
      }
    }
    const oldName = event.changes.name?.from || "";
    const oldSlug = oldName.toLowerCase().replaceAll(/\s/gi, "-");
    const oldGroup = await this.defaultMultiOrgTeamTransformer(
      {
        name: event.changes.name?.from,
        slug: oldSlug,
        combinedSlug: `${org$1}/${oldSlug}`,
        description: event.changes.description?.from,
        parentTeam: event.team?.parent?.slug ? { slug: event.team.parent.slug } : void 0,
        // entity will be removed
        members: []
      },
      {
        org: org$1,
        client,
        query: ""
      }
    );
    const { removed } = this.createRemoveEntitiesOperation([oldGroup]);
    const { added } = this.createAddEntitiesOperation([
      ...usersToRebuild,
      team
    ]);
    await this.connection.applyMutation({
      type: "delta",
      removed,
      added
    });
  }
  async onMembershipChangedInTeam(event, applicableOrgs) {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    if (!("slug" in event.team)) {
      return;
    }
    const org$1 = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const teamSlug = event.team.slug;
    const { team } = await github.getOrganizationTeam(
      client,
      org$1,
      teamSlug,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    const userTransformer = this.options.userTransformer || defaultTransformers.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.member;
    const user = await userTransformer(
      {
        name,
        avatarUrl,
        login,
        email: email ?? void 0
      },
      {
        org: org$1,
        client,
        query: ""
      }
    );
    const mutationEntities = [team];
    if (user && catalogModel.isUserEntity(user)) {
      const { orgs } = await github.getOrganizationsFromUser(client, login);
      const userApplicableOrgs = orgs.filter((o) => applicableOrgs.includes(o));
      for (const userOrg of userApplicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await github.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          [login],
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (guards.areGroupEntities(teams)) {
          org.assignGroupsToUsers([user], teams);
        }
      }
      mutationEntities.push(user);
    }
    const { added, removed } = this.createAddEntitiesOperation(mutationEntities);
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
            class: GithubMultiOrgEntityProvider.prototype.constructor.name,
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
  async defaultMultiOrgTeamTransformer(team, ctx) {
    if (this.options.teamTransformer) {
      return await this.options.teamTransformer(team, ctx);
    }
    const result = await defaultTransformers.defaultOrganizationTeamTransformer(team);
    if (result && result.spec) {
      if (!this.options.alwaysUseDefaultNamespace) {
        result.metadata.namespace = ctx.org.toLocaleLowerCase("en-US");
      }
      result.spec.members = team.members.map(
        (user) => `${catalogModel.DEFAULT_NAMESPACE}/${user.login}`
      );
    }
    return result;
  }
  // Note: Does not support usage of PATs
  async getAllOrgs(gitHubConfig) {
    const githubAppMux = new integration.GithubAppCredentialsMux(gitHubConfig);
    const installs = await githubAppMux.getAllInstallations();
    return installs.map(
      (install) => install.target_type === "Organization" && install.account && "login" in install.account && install.account.login ? install.account.login : void 0
    ).filter(Boolean);
  }
  createAddEntitiesOperation(entities) {
    return {
      removed: [],
      added: entities.map((entity) => ({
        locationKey: `github-multi-org-provider:${this.options.id}`,
        entity: withLocations(
          `https://${this.options.gitHubConfig.host}`,
          entity
        )
      }))
    };
  }
  createRemoveEntitiesOperation(entities) {
    return {
      added: [],
      removed: entities.map((entity) => ({
        locationKey: `github-multi-org-provider:${this.options.id}`,
        entity: withLocations(
          `https://${this.options.gitHubConfig.host}`,
          entity
        )
      }))
    };
  }
}
function trackProgress(logger) {
  let timestamp = Date.now();
  let summary;
  logger.info("Reading GitHub users and groups");
  function markReadComplete(read) {
    summary = `${read.allUsers.length} GitHub users and ${read.allTeams.length} GitHub groups`;
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
function withLocations(baseUrl, entity) {
  const login = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || entity.metadata.name;
  let org = entity.metadata.namespace;
  let team = entity.metadata.name;
  const slug = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [slugOrg, slugTeam] = util.splitTeamSlug(slug);
    org = slugOrg;
    team = slugTeam;
  }
  const location = entity.kind === "Group" ? `url:${baseUrl}/orgs/${org}/teams/${team}` : `url:${baseUrl}/${login}`;
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

exports.GithubMultiOrgEntityProvider = GithubMultiOrgEntityProvider;
exports.withLocations = withLocations;
//# sourceMappingURL=GithubMultiOrgEntityProvider.cjs.js.map
