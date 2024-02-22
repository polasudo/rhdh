'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$2 = require('@backstage/backend-common');
var require$$1$1 = require('@backstage/backend-plugin-api');
var require$$4 = require('@backstage/backend-tasks');
var require$$0$1 = require('@backstage/catalog-client');
var require$$0 = require('@backstage/integration');
var require$$2$1 = require('@octokit/rest');
var require$$6 = require('lodash');
var require$$4$1 = require('git-url-parse');
var require$$1 = require('@backstage/plugin-catalog-node');
var require$$2 = require('@octokit/graphql');
var require$$3 = require('uuid');
var require$$5 = require('@backstage/catalog-model');
var require$$7 = require('minimatch');
var require$$4$2 = require('@backstage/plugin-catalog-node/alpha');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var index_cjs$2 = {};

var index_cjs$1 = {};

var GithubEntityProviderC0c9bd2d_cjs = {};

var integration$1 = require$$0;
var pluginCatalogNode$1 = require$$1;
var graphql$1 = require$$2;
var uuid$1 = require$$3;
var backendTasks = require$$4;
var catalogModel$1 = require$$5;
var lodash$1 = require$$6;
var minimatch = require$$7;

function _interopNamespace$2(e) {
  if (e && e.__esModule) return e;
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
  n["default"] = e;
  return Object.freeze(n);
}

var uuid__namespace$1 = /*#__PURE__*/_interopNamespace$2(uuid$1);

const ANNOTATION_GITHUB_USER_LOGIN = "github.com/user-login";
const ANNOTATION_GITHUB_TEAM_SLUG = "github.com/team-slug";

const defaultUserTransformer = async (item, _ctx) => {
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "User",
    metadata: {
      name: item.login,
      annotations: {
        [ANNOTATION_GITHUB_USER_LOGIN]: item.login
      }
    },
    spec: {
      profile: {},
      memberOf: []
    }
  };
  if (item.bio)
    entity.metadata.description = item.bio;
  if (item.name)
    entity.spec.profile.displayName = item.name;
  if (item.email)
    entity.spec.profile.email = item.email;
  if (item.avatarUrl)
    entity.spec.profile.picture = item.avatarUrl;
  return entity;
};
const defaultOrganizationTeamTransformer = async (team) => {
  const annotations = {
    [ANNOTATION_GITHUB_TEAM_SLUG]: team.combinedSlug
  };
  if (team.editTeamUrl) {
    annotations["backstage.io/edit-url"] = team.editTeamUrl;
  }
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "Group",
    metadata: {
      name: team.slug,
      annotations
    },
    spec: {
      type: "team",
      profile: {},
      children: []
    }
  };
  if (team.description) {
    entity.metadata.description = team.description;
  }
  if (team.name) {
    entity.spec.profile.displayName = team.name;
  }
  if (team.avatarUrl) {
    entity.spec.profile.picture = team.avatarUrl;
  }
  if (team.parentTeam) {
    entity.spec.parent = team.parentTeam.slug;
  }
  entity.spec.members = team.members.map((user) => user.login);
  return entity;
};

function parseGithubOrgUrl(urlString) {
  const path = new URL(urlString).pathname.slice(1).split("/");
  if (path.length === 1 && path[0].length) {
    return { org: decodeURIComponent(path[0]) };
  }
  throw new Error(`Expected a URL pointing to /<org>`);
}
function satisfiesTopicFilter(topics, topicFilter) {
  var _a, _b, _c, _d;
  if (!topicFilter)
    return true;
  if (!topicFilter.include && !topicFilter.exclude)
    return true;
  if (!((_a = topicFilter.include) == null ? void 0 : _a.length) && !((_b = topicFilter.exclude) == null ? void 0 : _b.length))
    return true;
  if (((_c = topicFilter.include) == null ? void 0 : _c.length) && !topicFilter.exclude) {
    for (const topic of topics) {
      if (topicFilter.include.includes(topic))
        return true;
    }
    return false;
  }
  if (!topicFilter.include && ((_d = topicFilter.exclude) == null ? void 0 : _d.length)) {
    if (!topics.length)
      return true;
    for (const topic of topics) {
      if (topicFilter.exclude.includes(topic))
        return false;
    }
    return true;
  }
  if (topicFilter.include && topicFilter.exclude) {
    const matchesInclude = satisfiesTopicFilter(topics, {
      include: topicFilter.include
    });
    const matchesExclude = !satisfiesTopicFilter(topics, {
      exclude: topicFilter.exclude
    });
    if (matchesExclude)
      return false;
    return matchesInclude;
  }
  return true;
}
function satisfiesForkFilter(allowForks, isFork) {
  if (!allowForks && isFork)
    return false;
  return true;
}
function splitTeamSlug(slug) {
  const parts = slug.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `Github team slug '${slug}' was not in the expected format <organisation>/<team>`
    );
  }
  return [parts[0], parts[1]];
}
function satisfiesVisibilityFilter(visibilities, visibility) {
  if (!visibilities.length) {
    return true;
  }
  const lowerCaseVisibilities = visibilities.map(
    (v) => v.toLocaleLowerCase("en-US")
  );
  const lowerCaseVisibility = visibility.toLocaleLowerCase("en-US");
  return lowerCaseVisibilities.includes(lowerCaseVisibility);
}

function withLocations$1(baseUrl, org, entity) {
  var _a, _b;
  const login = ((_a = entity.metadata.annotations) == null ? void 0 : _a[ANNOTATION_GITHUB_USER_LOGIN]) || entity.metadata.name;
  let team = entity.metadata.name;
  const slug = (_b = entity.metadata.annotations) == null ? void 0 : _b[ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [_, slugTeam] = splitTeamSlug(slug);
    team = slugTeam;
  }
  const location = entity.kind === "Group" ? `url:${baseUrl}/orgs/${org}/teams/${team}` : `url:${baseUrl}/${login}`;
  return lodash$1.merge(
    {
      metadata: {
        annotations: {
          [catalogModel$1.ANNOTATION_LOCATION]: location,
          [catalogModel$1.ANNOTATION_ORIGIN_LOCATION]: location
        }
      }
    },
    entity
  );
}

async function getOrganizationUsers(client, org, tokenType, userTransformer = defaultUserTransformer) {
  const query = `
    query users($org: String!, $email: Boolean!, $cursor: String) {
      organization(login: $org) {
        membersWithRole(first: 100, after: $cursor) {
          pageInfo { hasNextPage, endCursor }
          nodes {
            avatarUrl,
            bio,
            email @include(if: $email),
            login,
            name,
            organizationVerifiedDomainEmails(login: $org)
          }
        }
      }
    }`;
  const users = await queryWithPaging(
    client,
    query,
    org,
    (r) => {
      var _a;
      return (_a = r.organization) == null ? void 0 : _a.membersWithRole;
    },
    userTransformer,
    {
      org,
      email: tokenType === "token"
    }
  );
  return { users };
}
async function getOrganizationTeams(client, org, teamTransformer = defaultOrganizationTeamTransformer) {
  const query = `
    query teams($org: String!, $cursor: String) {
      organization(login: $org) {
        teams(first: 50, after: $cursor) {
          pageInfo { hasNextPage, endCursor }
          nodes {
            slug
            combinedSlug
            name
            description
            avatarUrl
            editTeamUrl
            parentTeam { slug }
            members(first: 100, membership: IMMEDIATE) {
              pageInfo { hasNextPage }
              nodes {
                avatarUrl,
                bio,
                email,
                login,
                name,
                organizationVerifiedDomainEmails(login: $org)
               }
            }
          }
        }
      }
    }`;
  const materialisedTeams = async (item, ctx) => {
    const memberNames = [];
    if (!item.members.pageInfo.hasNextPage) {
      for (const user of item.members.nodes) {
        memberNames.push(user);
      }
    } else {
      const { members } = await getTeamMembers(ctx.client, ctx.org, item.slug);
      for (const userLogin of members) {
        memberNames.push(userLogin);
      }
    }
    const team = {
      ...item,
      members: memberNames
    };
    return await teamTransformer(team, ctx);
  };
  const teams = await queryWithPaging(
    client,
    query,
    org,
    (r) => {
      var _a;
      return (_a = r.organization) == null ? void 0 : _a.teams;
    },
    materialisedTeams,
    { org }
  );
  return { teams };
}
async function getOrganizationTeamsFromUsers(client, org, userLogins, teamTransformer = defaultOrganizationTeamTransformer) {
  const query = `
   query teams($org: String!, $cursor: String, $userLogins: [String!] = "") {
  organization(login: $org) {
    teams(first: 100, after: $cursor, userLogins: $userLogins) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        slug
        combinedSlug
        name
        description
        avatarUrl
        editTeamUrl
        parentTeam {
          slug
        }
        members(first: 100, membership: IMMEDIATE) {
          pageInfo {
            hasNextPage
          }
          nodes {
            avatarUrl,
            bio,
            email,
            login,
            name,
            organizationVerifiedDomainEmails(login: $org)
          }
        }
      }
    }
  }
}`;
  const materialisedTeams = async (item, ctx) => {
    const memberNames = [];
    if (!item.members.pageInfo.hasNextPage) {
      for (const user of item.members.nodes) {
        memberNames.push(user);
      }
    } else {
      const { members } = await getTeamMembers(ctx.client, ctx.org, item.slug);
      for (const userLogin of members) {
        memberNames.push(userLogin);
      }
    }
    const team = {
      ...item,
      members: memberNames
    };
    return await teamTransformer(team, ctx);
  };
  const teams = await queryWithPaging(
    client,
    query,
    org,
    (r) => {
      var _a;
      return (_a = r.organization) == null ? void 0 : _a.teams;
    },
    materialisedTeams,
    { org, userLogins }
  );
  return { teams };
}
async function getOrganizationsFromUser(client, user) {
  const query = `
  query orgs($user: String!) {
    user(login: $user) {
      organizations(first: 100) {
        nodes { login }
        pageInfo { hasNextPage, endCursor }
      }
    }
  }`;
  const orgs = await queryWithPaging(
    client,
    query,
    "",
    (r) => {
      var _a;
      return (_a = r.user) == null ? void 0 : _a.organizations;
    },
    async (o) => o.login,
    { user }
  );
  return { orgs };
}
async function getOrganizationTeam(client, org, teamSlug, teamTransformer = defaultOrganizationTeamTransformer) {
  var _a, _b;
  const query = `
  query teams($org: String!, $teamSlug: String!) {
      organization(login: $org) {
        team(slug:$teamSlug) {
            slug
            combinedSlug
            name
            description
            avatarUrl
            editTeamUrl
            parentTeam { slug }
            members(first: 100, membership: IMMEDIATE) {
              pageInfo { hasNextPage }
              nodes { login }
            }
        }
      }
    }`;
  const materialisedTeam = async (item, ctx) => {
    const memberNames = [];
    if (!item.members.pageInfo.hasNextPage) {
      for (const user of item.members.nodes) {
        memberNames.push(user);
      }
    } else {
      const { members } = await getTeamMembers(ctx.client, ctx.org, item.slug);
      for (const userLogin of members) {
        memberNames.push(userLogin);
      }
    }
    const team2 = {
      ...item,
      members: memberNames
    };
    return await teamTransformer(team2, ctx);
  };
  const response = await client(query, {
    org,
    teamSlug
  });
  if (!((_a = response.organization) == null ? void 0 : _a.team))
    throw new Error(`Found no match for team ${teamSlug}`);
  const team = await materialisedTeam((_b = response.organization) == null ? void 0 : _b.team, {
    query,
    client,
    org
  });
  if (!team)
    throw new Error(`Can't transform for team ${teamSlug}`);
  return { team };
}
async function getOrganizationRepositories(client, org, catalogPath) {
  let relativeCatalogPathRef;
  if (catalogPath.startsWith("/")) {
    relativeCatalogPathRef = catalogPath.substring(1);
  } else {
    relativeCatalogPathRef = catalogPath;
  }
  const catalogPathRef = `HEAD:${relativeCatalogPathRef}`;
  const query = `
    query repositories($org: String!, $catalogPathRef: String!, $cursor: String) {
      repositoryOwner(login: $org) {
        login
        repositories(first: 50, after: $cursor) {
          nodes {
            name
            catalogInfoFile: object(expression: $catalogPathRef) {
              __typename
              ... on Blob {
                id
                text
              }
            }
            url
            isArchived
            isFork
            visibility
            repositoryTopics(first: 100) {
              nodes {
                ... on RepositoryTopic {
                  topic {
                    name
                  }
                }
              }
            }
            defaultBranchRef {
              name
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }`;
  const repositories = await queryWithPaging(
    client,
    query,
    org,
    (r) => {
      var _a;
      return (_a = r.repositoryOwner) == null ? void 0 : _a.repositories;
    },
    async (x) => x,
    { org, catalogPathRef }
  );
  return { repositories };
}
async function getTeamMembers(client, org, teamSlug) {
  const query = `
    query members($org: String!, $teamSlug: String!, $cursor: String) {
      organization(login: $org) {
        team(slug: $teamSlug) {
          members(first: 100, after: $cursor, membership: IMMEDIATE) {
            pageInfo { hasNextPage, endCursor }
            nodes { login }
          }
        }
      }
    }`;
  const members = await queryWithPaging(
    client,
    query,
    org,
    (r) => {
      var _a, _b;
      return (_b = (_a = r.organization) == null ? void 0 : _a.team) == null ? void 0 : _b.members;
    },
    async (user) => user,
    { org, teamSlug }
  );
  return { members };
}
async function queryWithPaging(client, query, org, connection, transformer, variables) {
  const result = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let cursor = void 0;
  for (let j = 0; j < 1e3; ++j) {
    const response = await client(query, {
      ...variables,
      cursor
    });
    const conn = connection(response);
    if (!conn) {
      throw new Error(`Found no match for ${JSON.stringify(variables)}`);
    }
    for (const node of conn.nodes) {
      const transformedNode = await transformer(node, {
        client,
        query,
        org
      });
      if (transformedNode) {
        result.push(transformedNode);
      }
    }
    if (!conn.pageInfo.hasNextPage) {
      break;
    } else {
      await sleep(1e3);
      cursor = conn.pageInfo.endCursor;
    }
  }
  return result;
}
const createAddEntitiesOperation = (id, host) => (org, entities) => ({
  removed: [],
  added: entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations$1(`https://${host}`, org, entity)
  }))
});
const createRemoveEntitiesOperation = (id, host) => (org, entities) => ({
  added: [],
  removed: entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations$1(`https://${host}`, org, entity)
  }))
});
const createReplaceEntitiesOperation = (id, host) => (org, entities) => {
  const entitiesToReplace = entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations$1(`https://${host}`, org, entity)
  }));
  return {
    removed: entitiesToReplace,
    added: entitiesToReplace
  };
};

const DEFAULT_CATALOG_PATH = "/catalog-info.yaml";
const DEFAULT_PROVIDER_ID = "default";
function readProviderConfigs(config) {
  const providersConfig = config.getOptionalConfig("catalog.providers.github");
  if (!providersConfig) {
    return [];
  }
  if (providersConfig.has("organization")) {
    return [readProviderConfig(DEFAULT_PROVIDER_ID, providersConfig)];
  }
  return providersConfig.keys().map((id) => {
    const providerConfig = providersConfig.getConfig(id);
    return readProviderConfig(id, providerConfig);
  });
}
function readProviderConfig(id, config) {
  var _a, _b, _c, _d;
  const organization = config.getString("organization");
  const catalogPath = (_a = config.getOptionalString("catalogPath")) != null ? _a : DEFAULT_CATALOG_PATH;
  const host = (_b = config.getOptionalString("host")) != null ? _b : "github.com";
  const repositoryPattern = config.getOptionalString("filters.repository");
  const branchPattern = config.getOptionalString("filters.branch");
  const allowForks = (_c = config.getOptionalBoolean("filters.allowForks")) != null ? _c : true;
  const topicFilterInclude = config == null ? void 0 : config.getOptionalStringArray(
    "filters.topic.include"
  );
  const topicFilterExclude = config == null ? void 0 : config.getOptionalStringArray(
    "filters.topic.exclude"
  );
  const validateLocationsExist = (_d = config == null ? void 0 : config.getOptionalBoolean("validateLocationsExist")) != null ? _d : false;
  const catalogPathContainsWildcard = catalogPath.includes("*");
  const visibilityFilterInclude = config == null ? void 0 : config.getOptionalStringArray("filters.visibility");
  if (validateLocationsExist && catalogPathContainsWildcard) {
    throw Error(
      `Error while processing GitHub provider config. The catalog path ${catalogPath} contains a wildcard, which is incompatible with validation of locations existing before emitting them. Ensure that validateLocationsExist is set to false.`
    );
  }
  const schedule = config.has("schedule") ? backendTasks.readTaskScheduleDefinitionFromConfig(config.getConfig("schedule")) : void 0;
  return {
    id,
    catalogPath,
    organization,
    host,
    filters: {
      repository: repositoryPattern ? compileRegExp(repositoryPattern) : void 0,
      branch: branchPattern || void 0,
      allowForks,
      topic: {
        include: topicFilterInclude,
        exclude: topicFilterExclude
      },
      visibility: visibilityFilterInclude
    },
    schedule,
    validateLocationsExist
  };
}
function compileRegExp(pattern) {
  let fullLinePattern = pattern;
  if (!fullLinePattern.startsWith("^")) {
    fullLinePattern = `^${fullLinePattern}`;
  }
  if (!fullLinePattern.endsWith("$")) {
    fullLinePattern = `${fullLinePattern}$`;
  }
  return new RegExp(fullLinePattern);
}

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => {
  __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const TOPIC_REPO_PUSH = "github.push";
class GithubEntityProvider$1 {
  constructor(config, integration$1$1, logger, taskRunner) {
    __publicField$6(this, "config");
    __publicField$6(this, "logger");
    __publicField$6(this, "integration");
    __publicField$6(this, "scheduleFn");
    __publicField$6(this, "connection");
    __publicField$6(this, "githubCredentialsProvider");
    this.config = config;
    this.integration = integration$1$1.config;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
    this.githubCredentialsProvider = integration$1.SingleInstanceGithubCredentialsProvider.create(integration$1$1.config);
  }
  static fromConfig(config, options) {
    if (!options.schedule && !options.scheduler) {
      throw new Error("Either schedule or scheduler must be provided.");
    }
    const integrations = integration$1.ScmIntegrations.fromConfig(config);
    return readProviderConfigs(config).map((providerConfig) => {
      var _a;
      const integrationHost = providerConfig.host;
      const integration = integrations.github.byHost(integrationHost);
      if (!integration) {
        throw new Error(
          `There is no GitHub config that matches host ${integrationHost}. Please add a configuration entry for it under integrations.github`
        );
      }
      if (!options.schedule && !providerConfig.schedule) {
        throw new Error(
          `No schedule provided neither via code nor config for github-provider:${providerConfig.id}.`
        );
      }
      const taskRunner = (_a = options.schedule) != null ? _a : options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new GithubEntityProvider$1(
        providerConfig,
        integration,
        options.logger,
        taskRunner
      );
    });
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `github-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    return await this.scheduleFn();
  }
  createScheduleFn(taskRunner) {
    return async () => {
      const taskId = `${this.getProviderName()}:refresh`;
      return taskRunner.run({
        id: taskId,
        fn: async () => {
          const logger = this.logger.child({
            class: GithubEntityProvider$1.prototype.constructor.name,
            taskId,
            taskInstanceId: uuid__namespace$1.v4()
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
    const entities = matchingTargets.map((repository) => this.createLocationUrl(repository)).map(GithubEntityProvider$1.toLocationSpec).map((location) => {
      return {
        locationKey: this.getProviderName(),
        entity: pluginCatalogNode$1.locationSpecToLocationEntity({ location })
      };
    });
    await this.connection.applyMutation({
      type: "full",
      entities
    });
    logger.info(
      `Read ${targets.length} GitHub repositories (${entities.length} matching the pattern)`
    );
  }
  // go to the server and get all of the repositories
  async findCatalogFiles() {
    const organization = this.config.organization;
    const host = this.integration.host;
    const catalogPath = this.config.catalogPath;
    const orgUrl = `https://${host}/${organization}`;
    const { headers } = await this.githubCredentialsProvider.getCredentials({
      url: orgUrl
    });
    const client = graphql$1.graphql.defaults({
      baseUrl: this.integration.apiBaseUrl,
      headers
    });
    const { repositories: repositoriesFromGithub } = await getOrganizationRepositories(client, organization, catalogPath);
    const repositories = repositoriesFromGithub.map((r) => {
      var _a, _b;
      return {
        url: r.url,
        name: r.name,
        defaultBranchRef: (_a = r.defaultBranchRef) == null ? void 0 : _a.name,
        repositoryTopics: r.repositoryTopics.nodes.map((t) => t.topic.name),
        isArchived: r.isArchived,
        isFork: r.isFork,
        isCatalogInfoFilePresent: ((_b = r.catalogInfoFile) == null ? void 0 : _b.__typename) === "Blob" && r.catalogInfoFile.text !== "",
        visibility: r.visibility
      };
    });
    if (this.config.validateLocationsExist) {
      return repositories.filter(
        (repository) => repository.isCatalogInfoFilePresent
      );
    }
    return repositories;
  }
  matchesFilters(repositories) {
    var _a, _b, _c, _d, _e, _f;
    const repositoryFilter = (_a = this.config.filters) == null ? void 0 : _a.repository;
    const topicFilters = (_b = this.config.filters) == null ? void 0 : _b.topic;
    const allowForks = (_d = (_c = this.config.filters) == null ? void 0 : _c.allowForks) != null ? _d : true;
    const visibilities = (_f = (_e = this.config.filters) == null ? void 0 : _e.visibility) != null ? _f : [];
    const matchingRepositories = repositories.filter((r) => {
      const repoTopics = r.repositoryTopics;
      return !r.isArchived && (!repositoryFilter || repositoryFilter.test(r.name)) && satisfiesTopicFilter(repoTopics, topicFilters) && satisfiesForkFilter(allowForks, r.isFork) && satisfiesVisibilityFilter(visibilities, r.visibility) && r.defaultBranchRef;
    });
    return matchingRepositories;
  }
  createLocationUrl(repository) {
    var _a;
    const branch = ((_a = this.config.filters) == null ? void 0 : _a.branch) || repository.defaultBranchRef || "-";
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
    this.logger.debug(`Received event from ${params.topic}`);
    if (params.topic !== TOPIC_REPO_PUSH) {
      return;
    }
    await this.onRepoPush(params.eventPayload);
  }
  /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.supportsEventTopics} */
  supportsEventTopics() {
    return [TOPIC_REPO_PUSH];
  }
  async onRepoPush(event) {
    var _a;
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    if (this.config.organization !== event.repository.organization) {
      this.logger.debug(
        `skipping push event from organization ${event.repository.organization}`
      );
      return;
    }
    const repoName = event.repository.name;
    const repoUrl = event.repository.url;
    this.logger.debug(`handle github:push event for ${repoName} - ${repoUrl}`);
    const branch = ((_a = this.config.filters) == null ? void 0 : _a.branch) || event.repository.default_branch;
    if (!event.ref.includes(branch)) {
      this.logger.debug(`skipping push event from ref ${event.ref}`);
      return;
    }
    const repository = {
      url: event.repository.url,
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
    const matchingTargets = this.matchesFilters([repository]);
    if (matchingTargets.length === 0) {
      this.logger.debug(
        `skipping push event from repository ${repoName} because didn't match provider filters`
      );
      return;
    }
    const added = this.collectDeferredEntitiesFromCommit(
      event.repository.url,
      branch,
      event.commits,
      (commit) => [...commit.added]
    );
    const removed = this.collectDeferredEntitiesFromCommit(
      event.repository.url,
      branch,
      event.commits,
      (commit) => [...commit.removed]
    );
    const modified = this.collectFilesFromCommit(
      event.commits,
      (commit) => [...commit.modified]
    );
    if (modified.length > 0) {
      await this.connection.refresh({
        keys: [
          ...modified.map(
            (filePath) => `url:${event.repository.url}/tree/${branch}/${filePath}`
          ),
          ...modified.map(
            (filePath) => `url:${event.repository.url}/blob/${branch}/${filePath}`
          )
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
      const location = GithubEntityProvider$1.toLocationSpec(target);
      return pluginCatalogNode$1.locationSpecToLocationEntity({ location });
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
}

GithubEntityProviderC0c9bd2d_cjs.ANNOTATION_GITHUB_TEAM_SLUG = ANNOTATION_GITHUB_TEAM_SLUG;
GithubEntityProviderC0c9bd2d_cjs.ANNOTATION_GITHUB_USER_LOGIN = ANNOTATION_GITHUB_USER_LOGIN;
GithubEntityProviderC0c9bd2d_cjs.GithubEntityProvider = GithubEntityProvider$1;
GithubEntityProviderC0c9bd2d_cjs.createAddEntitiesOperation = createAddEntitiesOperation;
GithubEntityProviderC0c9bd2d_cjs.createRemoveEntitiesOperation = createRemoveEntitiesOperation;
GithubEntityProviderC0c9bd2d_cjs.createReplaceEntitiesOperation = createReplaceEntitiesOperation;
GithubEntityProviderC0c9bd2d_cjs.defaultOrganizationTeamTransformer = defaultOrganizationTeamTransformer;
GithubEntityProviderC0c9bd2d_cjs.defaultUserTransformer = defaultUserTransformer;
GithubEntityProviderC0c9bd2d_cjs.getOrganizationRepositories = getOrganizationRepositories;
GithubEntityProviderC0c9bd2d_cjs.getOrganizationTeam = getOrganizationTeam;
GithubEntityProviderC0c9bd2d_cjs.getOrganizationTeams = getOrganizationTeams;
GithubEntityProviderC0c9bd2d_cjs.getOrganizationTeamsFromUsers = getOrganizationTeamsFromUsers;
GithubEntityProviderC0c9bd2d_cjs.getOrganizationUsers = getOrganizationUsers;
GithubEntityProviderC0c9bd2d_cjs.getOrganizationsFromUser = getOrganizationsFromUser;
GithubEntityProviderC0c9bd2d_cjs.parseGithubOrgUrl = parseGithubOrgUrl;
GithubEntityProviderC0c9bd2d_cjs.splitTeamSlug = splitTeamSlug;
GithubEntityProviderC0c9bd2d_cjs.withLocations = withLocations$1;

Object.defineProperty(index_cjs$1, '__esModule', { value: true });

var catalogClient = require$$0$1;
var integration = require$$0;
var rest = require$$2$1;
var lodash = require$$6;
var parseGitUrl = require$$4$1;
var pluginCatalogNode = require$$1;
var graphql = require$$2;
var GithubEntityProvider = GithubEntityProviderC0c9bd2d_cjs;
var catalogModel = require$$5;
var uuid = require$$3;



function _interopDefaultLegacy$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace$1(e) {
  if (e && e.__esModule) return e;
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
  n["default"] = e;
  return Object.freeze(n);
}

var parseGitUrl__default = /*#__PURE__*/_interopDefaultLegacy$1(parseGitUrl);
var uuid__namespace = /*#__PURE__*/_interopNamespace$1(uuid);

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => {
  __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GithubLocationAnalyzer {
  constructor(options) {
    __publicField$5(this, "catalogClient");
    __publicField$5(this, "githubCredentialsProvider");
    __publicField$5(this, "integrations");
    __publicField$5(this, "tokenManager");
    this.catalogClient = new catalogClient.CatalogClient({ discoveryApi: options.discovery });
    this.integrations = integration.ScmIntegrations.fromConfig(options.config);
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.tokenManager = options.tokenManager;
  }
  supports(url) {
    const integration = this.integrations.byUrl(url);
    return (integration == null ? void 0 : integration.type) === "github";
  }
  async analyze(options) {
    const { url, catalogFilename } = options;
    const { owner, name: repo } = parseGitUrl__default["default"](url);
    const catalogFile = catalogFilename || "catalog-info.yaml";
    const query = `filename:${catalogFile} repo:${owner}/${repo}`;
    const integration = this.integrations.github.byUrl(url);
    if (!integration) {
      throw new Error("Make sure you have a GitHub integration configured");
    }
    const { token: githubToken } = await this.githubCredentialsProvider.getCredentials({
      url
    });
    const octokitClient = new rest.Octokit({
      auth: githubToken,
      baseUrl: integration.config.apiBaseUrl
    });
    const searchResult = await octokitClient.search.code({ q: query }).catch((e) => {
      throw new Error(`Couldn't search repository for metadata file, ${e}`);
    });
    const exists = searchResult.data.total_count > 0;
    if (exists) {
      const repoInformation = await octokitClient.repos.get({ owner, repo }).catch((e) => {
        throw new Error(`Couldn't fetch repo data, ${e}`);
      });
      const defaultBranch = repoInformation.data.default_branch;
      const { token: serviceToken } = await this.tokenManager.getToken();
      const result = await Promise.all(
        searchResult.data.items.map((i) => `${lodash.trimEnd(url, "/")}/blob/${defaultBranch}/${i.path}`).map(async (target) => {
          const addLocationResult = await this.catalogClient.addLocation(
            {
              type: "url",
              target,
              dryRun: true
            },
            { token: serviceToken }
          );
          return addLocationResult.entities.map((e) => ({
            location: { type: "url", target },
            isRegistered: !!addLocationResult.exists,
            entity: e
          }));
        })
      );
      return { existing: result.flat() };
    }
    return { existing: [] };
  }
}

function readGithubMultiOrgConfig(config) {
  var _a;
  const orgConfigs = (_a = config.getOptionalConfigArray("orgs")) != null ? _a : [];
  return orgConfigs.map((c) => {
    var _a2, _b;
    return {
      name: c.getString("name"),
      groupNamespace: ((_a2 = c.getOptionalString("groupNamespace")) != null ? _a2 : c.getString("name")).toLowerCase(),
      userNamespace: (_b = c.getOptionalString("userNamespace")) != null ? _b : void 0
    };
  });
}

function buildOrgHierarchy(groups) {
  const groupsByName = new Map(groups.map((g) => [g.metadata.name, g]));
  for (const group of groups) {
    const selfName = group.metadata.name;
    const parentName = group.spec.parent;
    if (parentName) {
      const parent = groupsByName.get(parentName);
      if (parent && !parent.spec.children.includes(selfName)) {
        parent.spec.children.push(selfName);
      }
    }
  }
  for (const group of groups) {
    const selfName = group.metadata.name;
    for (const childName of group.spec.children) {
      const child = groupsByName.get(childName);
      if (child && !child.spec.parent) {
        child.spec.parent = selfName;
      }
    }
  }
}
function assignGroupsToUsers(users, groups) {
  var _a;
  const groupMemberUsers = new Map(
    groups.map((group) => {
      var _a2;
      const groupKey = group.metadata.namespace && group.metadata.namespace !== catalogModel.DEFAULT_NAMESPACE ? `${group.metadata.namespace}/${group.metadata.name}` : group.metadata.name;
      return [
        groupKey,
        ((_a2 = group.spec.members) == null ? void 0 : _a2.map(
          (m) => catalogModel.stringifyEntityRef(catalogModel.parseEntityRef(m, { defaultKind: "user" }))
        )) || []
      ];
    })
  );
  const usersByRef = new Map(users.map((u) => [catalogModel.stringifyEntityRef(u), u]));
  for (const [groupName, userRefs] of groupMemberUsers.entries()) {
    for (const ref of userRefs) {
      const user = usersByRef.get(ref);
      if (user && !((_a = user.spec.memberOf) == null ? void 0 : _a.includes(groupName))) {
        if (!user.spec.memberOf) {
          user.spec.memberOf = [];
        }
        user.spec.memberOf.push(groupName);
      }
    }
  }
}

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => {
  __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GithubDiscoveryProcessor {
  constructor(options) {
    __publicField$4(this, "integrations");
    __publicField$4(this, "logger");
    __publicField$4(this, "githubCredentialsProvider");
    this.integrations = options.integrations;
    this.logger = options.logger;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
  }
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    return new GithubDiscoveryProcessor({
      ...options,
      integrations
    });
  }
  getProcessorName() {
    return "GithubDiscoveryProcessor";
  }
  async readLocation(location, _optional, emit) {
    var _a, _b;
    if (location.type !== "github-discovery") {
      return false;
    }
    const gitHubConfig = (_a = this.integrations.github.byUrl(
      location.target
    )) == null ? void 0 : _a.config;
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
    const { repositories } = await GithubEntityProvider.getOrganizationRepositories(
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
      const branchName = branch === "-" ? (_b = repository.defaultBranchRef) == null ? void 0 : _b.name : branch;
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

function areGroupEntities(entities) {
  return entities.every((e) => catalogModel.isGroupEntity(e));
}
function areUserEntities(entities) {
  return entities.every((e) => catalogModel.isUserEntity(e));
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => {
  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GithubMultiOrgReaderProcessor {
  constructor(options) {
    this.options = options;
    __publicField$3(this, "integrations");
    __publicField$3(this, "orgs");
    __publicField$3(this, "logger");
    __publicField$3(this, "githubCredentialsProvider");
    this.integrations = options.integrations;
    this.logger = options.logger;
    this.orgs = options.orgs;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
  }
  static fromConfig(config, options) {
    const c = config.getOptionalConfig("catalog.processors.githubMultiOrg");
    const integrations = integration.ScmIntegrations.fromConfig(config);
    return new GithubMultiOrgReaderProcessor({
      ...options,
      integrations,
      orgs: c ? readGithubMultiOrgConfig(c) : []
    });
  }
  getProcessorName() {
    return "GithubMultiOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    var _a;
    if (location.type !== "github-multi-org") {
      return false;
    }
    const gitHubConfig = (_a = this.integrations.github.byUrl(
      location.target
    )) == null ? void 0 : _a.config;
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
        const { users } = await GithubEntityProvider.getOrganizationUsers(
          client,
          orgConfig.name,
          tokenType,
          async (githubUser, ctx) => {
            const result = this.options.userTransformer ? await this.options.userTransformer(githubUser, ctx) : await GithubEntityProvider.defaultUserTransformer(githubUser, ctx);
            if (result) {
              result.metadata.namespace = orgConfig.userNamespace;
            }
            return result;
          }
        );
        const { teams } = await GithubEntityProvider.getOrganizationTeams(
          client,
          orgConfig.name,
          async (team, ctx) => {
            const result = this.options.teamTransformer ? await this.options.teamTransformer(team, ctx) : await GithubEntityProvider.defaultOrganizationTeamTransformer(team, ctx);
            if (result && catalogModel.isGroupEntity(result)) {
              result.metadata.namespace = orgConfig.groupNamespace;
              result.spec.members = team.members.map(
                (user) => {
                  var _a2;
                  return `${(_a2 = orgConfig.userNamespace) != null ? _a2 : catalogModel.DEFAULT_NAMESPACE}/${user.login}`;
                }
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
        if (areGroupEntities(teams)) {
          buildOrgHierarchy(teams);
          if (areUserEntities(pendingUsers)) {
            assignGroupsToUsers(pendingUsers, teams);
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

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GithubOrgReaderProcessor {
  constructor(options) {
    __publicField$2(this, "integrations");
    __publicField$2(this, "logger");
    __publicField$2(this, "githubCredentialsProvider");
    this.integrations = options.integrations;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.logger = options.logger;
  }
  static fromConfig(config, options) {
    const integrations = integration.ScmIntegrations.fromConfig(config);
    return new GithubOrgReaderProcessor({
      ...options,
      integrations
    });
  }
  getProcessorName() {
    return "GithubOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "github-org") {
      return false;
    }
    const { client, tokenType } = await this.createClient(location.target);
    const { org } = GithubEntityProvider.parseGithubOrgUrl(location.target);
    const startTimestamp = Date.now();
    this.logger.info("Reading GitHub users and groups");
    const { users } = await GithubEntityProvider.getOrganizationUsers(client, org, tokenType);
    const { teams } = await GithubEntityProvider.getOrganizationTeams(client, org);
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${users.length} GitHub users and ${teams.length} GitHub teams in ${duration} seconds`
    );
    if (areGroupEntities(teams)) {
      buildOrgHierarchy(teams);
      if (areUserEntities(users)) {
        assignGroupsToUsers(users, teams);
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
    var _a;
    const gitHubConfig = (_a = this.integrations.github.byUrl(orgUrl)) == null ? void 0 : _a.config;
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

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GithubMultiOrgEntityProvider {
  constructor(options) {
    this.options = options;
    __publicField$1(this, "connection");
    __publicField$1(this, "scheduleFn");
  }
  static fromConfig(config, options) {
    var _a;
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const gitHubConfig = (_a = integrations.github.byUrl(options.githubUrl)) == null ? void 0 : _a.config;
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
      teamTransformer: options.teamTransformer
    });
    provider.schedule(options.schedule);
    if (options.eventBroker) {
      options.eventBroker.subscribe({
        supportsEventTopics: provider.supportsEventTopics.bind(provider),
        onEvent: provider.onEvent.bind(provider)
      });
    }
    return provider;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `GithubMultiOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    var _a;
    this.connection = connection;
    await ((_a = this.scheduleFn) == null ? void 0 : _a.call(this));
  }
  /**
   * Runs one single complete ingestion. This is only necessary if you use
   * manual scheduling.
   */
  async read(options) {
    var _a, _b;
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const logger = (_a = options == null ? void 0 : options.logger) != null ? _a : this.options.logger;
    const { markReadComplete } = trackProgress$1(logger);
    const allUsersMap = /* @__PURE__ */ new Map();
    const allTeams = [];
    const orgsToProcess = ((_b = this.options.orgs) == null ? void 0 : _b.length) ? this.options.orgs : await this.getAllOrgs(this.options.gitHubConfig);
    for (const org of orgsToProcess) {
      const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
        url: `${this.options.githubUrl}/${org}`
      });
      const client = graphql.graphql.defaults({
        baseUrl: this.options.gitHubConfig.apiBaseUrl,
        headers
      });
      logger.info(`Reading GitHub users and teams for org: ${org}`);
      const { users } = await GithubEntityProvider.getOrganizationUsers(
        client,
        org,
        tokenType,
        this.options.userTransformer
      );
      const { teams } = await GithubEntityProvider.getOrganizationTeams(
        client,
        org,
        this.defaultMultiOrgTeamTransformer.bind(this)
      );
      const pendingUsers = users.map((u) => {
        const userRef = catalogModel.stringifyEntityRef(u);
        if (!allUsersMap.has(userRef)) {
          allUsersMap.set(userRef, u);
        }
        return allUsersMap.get(userRef);
      });
      if (areGroupEntities(teams)) {
        buildOrgHierarchy(teams);
        if (areUserEntities(pendingUsers)) {
          assignGroupsToUsers(pendingUsers, teams);
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
  supportsEventTopics() {
    return [
      "github.installation",
      "github.organization",
      "github.team",
      "github.membership"
    ];
  }
  async onEvent(params) {
    var _a, _b, _c, _d;
    const { logger } = this.options;
    logger.debug(`Received event from ${params.topic}`);
    const orgs = ((_a = this.options.orgs) == null ? void 0 : _a.length) ? this.options.orgs : await this.getAllOrgs(this.options.gitHubConfig);
    const eventPayload = params.eventPayload;
    if (!orgs.includes(
      (_c = (_b = eventPayload.installation) == null ? void 0 : _b.account) == null ? void 0 : _c.login
    ) && !orgs.includes(
      (_d = eventPayload.organization) == null ? void 0 : _d.login
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
    const org = event.installation.account.login;
    const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { users } = await GithubEntityProvider.getOrganizationUsers(
      client,
      org,
      tokenType,
      this.options.userTransformer
    );
    const { teams } = await GithubEntityProvider.getOrganizationTeams(
      client,
      org,
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
        const { teams: userTeams } = await GithubEntityProvider.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          users.map(
            (u) => {
              var _a;
              return ((_a = u.metadata.annotations) == null ? void 0 : _a[GithubEntityProvider.ANNOTATION_GITHUB_USER_LOGIN]) || u.metadata.name;
            }
          ),
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (areGroupEntities(userTeams) && areUserEntities(users)) {
          assignGroupsToUsers(users, userTeams);
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
    const userTransformer = this.options.userTransformer || GithubEntityProvider.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.membership.user;
    const org = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { orgs } = await GithubEntityProvider.getOrganizationsFromUser(client, login);
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
        email: email != null ? email : void 0
      },
      {
        org,
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
        const { teams } = await GithubEntityProvider.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          [login],
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (catalogModel.isUserEntity(user) && areGroupEntities(teams)) {
          assignGroupsToUsers([user], teams);
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
    var _a, _b;
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
        description: description != null ? description : void 0,
        parentTeam: { slug: ((_b = (_a = event.team) == null ? void 0 : _a.parent) == null ? void 0 : _b.slug) || "" },
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
    var _a, _b, _c, _d, _e, _f;
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const org = event.organization.login;
    const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const teamSlug = event.team.slug;
    const { team } = await GithubEntityProvider.getOrganizationTeam(
      client,
      org,
      teamSlug,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    const { users } = await GithubEntityProvider.getOrganizationUsers(
      client,
      org,
      tokenType,
      this.options.userTransformer
    );
    const usersFromChangedGroup = catalogModel.isGroupEntity(team) ? ((_a = team.spec.members) == null ? void 0 : _a.map(
      (m) => catalogModel.stringifyEntityRef(catalogModel.parseEntityRef(m, { defaultKind: "user" }))
    )) || [] : [];
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
        const { teams } = await GithubEntityProvider.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          usersToRebuild.map(
            (u) => {
              var _a2;
              return ((_a2 = u.metadata.annotations) == null ? void 0 : _a2[GithubEntityProvider.ANNOTATION_GITHUB_USER_LOGIN]) || u.metadata.name;
            }
          ),
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (areGroupEntities(teams) && areUserEntities(usersToRebuild)) {
          assignGroupsToUsers(usersToRebuild, teams);
        }
      }
    }
    const oldName = ((_b = event.changes.name) == null ? void 0 : _b.from) || "";
    const oldSlug = oldName.toLowerCase().replaceAll(/\s/gi, "-");
    const oldGroup = await this.defaultMultiOrgTeamTransformer(
      {
        name: (_c = event.changes.name) == null ? void 0 : _c.from,
        slug: oldSlug,
        combinedSlug: `${org}/${oldSlug}`,
        description: (_d = event.changes.description) == null ? void 0 : _d.from,
        parentTeam: { slug: ((_f = (_e = event.team) == null ? void 0 : _e.parent) == null ? void 0 : _f.slug) || "" },
        // entity will be removed
        members: []
      },
      {
        org,
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
    const org = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org}`
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const teamSlug = event.team.slug;
    const { team } = await GithubEntityProvider.getOrganizationTeam(
      client,
      org,
      teamSlug,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    const userTransformer = this.options.userTransformer || GithubEntityProvider.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.member;
    const user = await userTransformer(
      {
        name,
        avatarUrl,
        login,
        email: email != null ? email : void 0
      },
      {
        org,
        client,
        query: ""
      }
    );
    const mutationEntities = [team];
    if (user && catalogModel.isUserEntity(user)) {
      const { orgs } = await GithubEntityProvider.getOrganizationsFromUser(client, login);
      const userApplicableOrgs = orgs.filter((o) => applicableOrgs.includes(o));
      for (const userOrg of userApplicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await GithubEntityProvider.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          [login],
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (areGroupEntities(teams)) {
          assignGroupsToUsers([user], teams);
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
    const result = await GithubEntityProvider.defaultOrganizationTeamTransformer(team);
    if (result && result.spec) {
      result.metadata.namespace = ctx.org.toLocaleLowerCase("en-US");
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
function trackProgress$1(logger) {
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
  var _a, _b;
  const login = ((_a = entity.metadata.annotations) == null ? void 0 : _a[GithubEntityProvider.ANNOTATION_GITHUB_USER_LOGIN]) || entity.metadata.name;
  let org = entity.metadata.namespace;
  let team = entity.metadata.name;
  const slug = (_b = entity.metadata.annotations) == null ? void 0 : _b[GithubEntityProvider.ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [slugOrg, slugTeam] = GithubEntityProvider.splitTeamSlug(slug);
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

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GithubOrgEntityProvider {
  constructor(options) {
    this.options = options;
    __publicField(this, "credentialsProvider");
    __publicField(this, "connection");
    __publicField(this, "scheduleFn");
    this.credentialsProvider = options.githubCredentialsProvider || integration.SingleInstanceGithubCredentialsProvider.create(this.options.gitHubConfig);
  }
  static fromConfig(config, options) {
    var _a;
    const integrations = integration.ScmIntegrations.fromConfig(config);
    const gitHubConfig = (_a = integrations.github.byUrl(options.orgUrl)) == null ? void 0 : _a.config;
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
      teamTransformer: options.teamTransformer
    });
    provider.schedule(options.schedule);
    return provider;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `GithubOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    var _a;
    this.connection = connection;
    await ((_a = this.scheduleFn) == null ? void 0 : _a.call(this));
  }
  /**
   * Runs one single complete ingestion. This is only necessary if you use
   * manual scheduling.
   */
  async read(options) {
    var _a;
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const logger = (_a = options == null ? void 0 : options.logger) != null ? _a : this.options.logger;
    const { markReadComplete } = trackProgress(logger);
    const { headers, type: tokenType } = await this.credentialsProvider.getCredentials({
      url: this.options.orgUrl
    });
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { org } = GithubEntityProvider.parseGithubOrgUrl(this.options.orgUrl);
    const { users } = await GithubEntityProvider.getOrganizationUsers(
      client,
      org,
      tokenType,
      this.options.userTransformer
    );
    const { teams } = await GithubEntityProvider.getOrganizationTeams(
      client,
      org,
      this.options.teamTransformer
    );
    if (areGroupEntities(teams)) {
      buildOrgHierarchy(teams);
      if (areUserEntities(users)) {
        assignGroupsToUsers(users, teams);
      }
    }
    const { markCommitComplete } = markReadComplete({ users, teams });
    await this.connection.applyMutation({
      type: "full",
      entities: [...users, ...teams].map((entity) => ({
        locationKey: `github-org-provider:${this.options.id}`,
        entity: GithubEntityProvider.withLocations(
          `https://${this.options.gitHubConfig.host}`,
          org,
          entity
        )
      }))
    });
    markCommitComplete();
  }
  /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.onEvent} */
  async onEvent(params) {
    const { logger } = this.options;
    logger.debug(`Received event from ${params.topic}`);
    const addEntitiesOperation = GithubEntityProvider.createAddEntitiesOperation(
      this.options.id,
      this.options.gitHubConfig.host
    );
    const removeEntitiesOperation = GithubEntityProvider.createRemoveEntitiesOperation(
      this.options.id,
      this.options.gitHubConfig.host
    );
    const replaceEntitiesOperation = GithubEntityProvider.createReplaceEntitiesOperation(
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
  /** {@inheritdoc @backstage/plugin-events-node#EventSubscriber.supportsEventTopics} */
  supportsEventTopics() {
    return ["github.organization", "github.team", "github.membership"];
  }
  async onTeamEditedInOrganization(event, createDeltaOperation) {
    var _a, _b;
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
    const { org } = GithubEntityProvider.parseGithubOrgUrl(this.options.orgUrl);
    const { team } = await GithubEntityProvider.getOrganizationTeam(
      client,
      org,
      teamSlug,
      this.options.teamTransformer
    );
    const { users } = await GithubEntityProvider.getOrganizationUsers(
      client,
      org,
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
    const { teams } = await GithubEntityProvider.getOrganizationTeamsFromUsers(
      client,
      org,
      usersToRebuild.map((u) => u.metadata.name),
      this.options.teamTransformer
    );
    if (areGroupEntities(teams)) {
      buildOrgHierarchy(teams);
      if (areUserEntities(usersToRebuild)) {
        assignGroupsToUsers(usersToRebuild, teams);
      }
    }
    const oldName = ((_a = event.changes.name) == null ? void 0 : _a.from) || event.team.name;
    const oldSlug = oldName.toLowerCase().replaceAll(/\s/gi, "-");
    const oldDescription = ((_b = event.changes.description) == null ? void 0 : _b.from) || event.team.description;
    const oldDescriptionSlug = oldDescription == null ? void 0 : oldDescription.toLowerCase().replaceAll(/\s/gi, "-");
    const { removed } = createDeltaOperation(org, [
      {
        ...team,
        metadata: {
          name: oldSlug,
          description: oldDescriptionSlug
        }
      }
    ]);
    const { added } = createDeltaOperation(org, [...usersToRebuild, ...teams]);
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
    const { org } = GithubEntityProvider.parseGithubOrgUrl(this.options.orgUrl);
    const { team } = await GithubEntityProvider.getOrganizationTeam(
      client,
      org,
      teamSlug,
      this.options.teamTransformer
    );
    const { users } = await GithubEntityProvider.getOrganizationUsers(
      client,
      org,
      tokenType,
      this.options.userTransformer
    );
    const usersToRebuild = users.filter((u) => u.metadata.name === userLogin);
    const { teams } = await GithubEntityProvider.getOrganizationTeamsFromUsers(
      client,
      org,
      [userLogin],
      this.options.teamTransformer
    );
    if (!teams.some((t) => t.metadata.name === team.metadata.name)) {
      teams.push(team);
    }
    if (areGroupEntities(teams)) {
      buildOrgHierarchy(teams);
      if (areUserEntities(usersToRebuild)) {
        assignGroupsToUsers(usersToRebuild, teams);
      }
    }
    const { added, removed } = createDeltaOperation(org, [
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
    var _a, _b;
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const organizationTeamTransformer = this.options.teamTransformer || GithubEntityProvider.defaultOrganizationTeamTransformer;
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
        parentTeam: { slug: ((_b = (_a = event.team) == null ? void 0 : _a.parent) == null ? void 0 : _b.slug) || "" },
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
    const userTransformer = this.options.userTransformer || GithubEntityProvider.defaultUserTransformer;
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

class GitHubOrgEntityProvider extends GithubOrgEntityProvider {
  static fromConfig(config, options) {
    options.logger.warn(
      "[Deprecated] Use GithubOrgEntityProvider instead of GitHubOrgEntityProvider."
    );
    return GithubOrgEntityProvider.fromConfig(
      config,
      options
    );
  }
}
class GitHubEntityProvider {
  constructor(delegate) {
    this.delegate = delegate;
  }
  static fromConfig(config, options) {
    options.logger.warn(
      "[Deprecated] Please use GithubEntityProvider instead of GitHubEntityProvider."
    );
    return GithubEntityProvider.GithubEntityProvider.fromConfig(config, options).map(
      (delegate) => new GitHubEntityProvider(delegate)
    );
  }
  connect(connection) {
    return this.delegate.connect(connection);
  }
  getProviderName() {
    return this.delegate.getProviderName();
  }
  refresh(logger) {
    return this.delegate.refresh(logger);
  }
}

index_cjs$1.GithubEntityProvider = GithubEntityProvider.GithubEntityProvider;
index_cjs$1.defaultOrganizationTeamTransformer = GithubEntityProvider.defaultOrganizationTeamTransformer;
index_cjs$1.defaultUserTransformer = GithubEntityProvider.defaultUserTransformer;
index_cjs$1.GitHubEntityProvider = GitHubEntityProvider;
index_cjs$1.GitHubOrgEntityProvider = GitHubOrgEntityProvider;
index_cjs$1.GithubDiscoveryProcessor = GithubDiscoveryProcessor;
index_cjs$1.GithubLocationAnalyzer = GithubLocationAnalyzer;
index_cjs$1.GithubMultiOrgEntityProvider = GithubMultiOrgEntityProvider;
index_cjs$1.GithubMultiOrgReaderProcessor = GithubMultiOrgReaderProcessor;
index_cjs$1.GithubOrgEntityProvider = GithubOrgEntityProvider;
index_cjs$1.GithubOrgReaderProcessor = GithubOrgReaderProcessor;

(function (exports) {

	Object.defineProperty(exports, '__esModule', { value: true });

	var backendCommon = require$$0$2;
	var backendPluginApi = require$$1$1;
	var backendTasks = require$$4;
	var pluginCatalogBackendModuleGithub = index_cjs$1;
	var alpha = require$$4$2;

	const githubOrgEntityProviderTransformsExtensionPoint = backendPluginApi.createExtensionPoint({
	  id: "catalog.githubOrgEntityProvider"
	});
	const catalogModuleGithubOrgEntityProvider = backendPluginApi.createBackendModule({
	  pluginId: "catalog",
	  moduleId: "github-org-entity-provider",
	  register(env) {
	    let userTransformer;
	    let teamTransformer;
	    env.registerExtensionPoint(
	      githubOrgEntityProviderTransformsExtensionPoint,
	      {
	        setUserTransformer(transformer) {
	          if (userTransformer) {
	            throw new Error("User transformer may only be set once");
	          }
	          userTransformer = transformer;
	        },
	        setTeamTransformer(transformer) {
	          if (teamTransformer) {
	            throw new Error("Team transformer may only be set once");
	          }
	          teamTransformer = transformer;
	        }
	      }
	    );
	    env.registerInit({
	      deps: {
	        catalog: alpha.catalogProcessingExtensionPoint,
	        config: backendPluginApi.coreServices.rootConfig,
	        logger: backendPluginApi.coreServices.logger,
	        scheduler: backendPluginApi.coreServices.scheduler
	      },
	      async init({ catalog, config, logger, scheduler }) {
	        for (const definition of readDefinitionsFromConfig(config)) {
	          catalog.addEntityProvider(
	            pluginCatalogBackendModuleGithub.GithubMultiOrgEntityProvider.fromConfig(config, {
	              id: definition.id,
	              githubUrl: definition.githubUrl,
	              orgs: definition.orgs,
	              schedule: scheduler.createScheduledTaskRunner(
	                definition.schedule
	              ),
	              logger: backendCommon.loggerToWinstonLogger(logger),
	              userTransformer,
	              teamTransformer
	            })
	          );
	        }
	      }
	    });
	  }
	});
	function readDefinitionsFromConfig(rootConfig) {
	  const baseKey = "catalog.providers.githubOrg";
	  const baseConfig = rootConfig.getOptional(baseKey);
	  if (!baseConfig) {
	    return [];
	  }
	  const configs = Array.isArray(baseConfig) ? rootConfig.getConfigArray(baseKey) : [rootConfig.getConfig(baseKey)];
	  return configs.map((c) => ({
	    id: c.getString("id"),
	    githubUrl: c.getString("githubUrl"),
	    orgs: c.getOptionalStringArray("orgs"),
	    schedule: backendTasks.readTaskScheduleDefinitionFromConfig(c.getConfig("schedule"))
	  }));
	}

	Object.defineProperty(exports, 'GithubMultiOrgEntityProvider', {
	  enumerable: true,
	  get: function () { return pluginCatalogBackendModuleGithub.GithubMultiOrgEntityProvider; }
	});
	exports["default"] = catalogModuleGithubOrgEntityProvider;
	exports.githubOrgEntityProviderTransformsExtensionPoint = githubOrgEntityProviderTransformsExtensionPoint;
	
} (index_cjs$2));

var index_cjs = /*@__PURE__*/getDefaultExportFromCjs(index_cjs$2);

exports["default"] = index_cjs;
//# sourceMappingURL=index.cjs.js.map
