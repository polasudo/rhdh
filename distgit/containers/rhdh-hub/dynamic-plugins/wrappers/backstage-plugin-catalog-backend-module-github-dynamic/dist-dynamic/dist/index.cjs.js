'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$1$2 = require('@backstage/plugin-catalog-node/alpha');
var require$$2$2 = require('@backstage/plugin-events-node');
var require$$0$2 = require('@backstage/integration');
var require$$1$1 = require('@backstage/plugin-catalog-node');
var require$$2 = require('@octokit/graphql');
var require$$3 = require('uuid');
var require$$0$1 = require('@backstage/catalog-model');
var require$$1 = require('lodash');
var require$$7 = require('minimatch');
var require$$0$3 = require('@backstage/catalog-client');
var require$$2$1 = require('@octokit/rest');
var require$$4 = require('git-url-parse');
var require$$5 = require('@backstage/backend-common');
var require$$6 = require('path');

var alpha_cjs = {};

var githubCatalogModule_cjs = {};

var GithubEntityProvider_cjs = {};

var GithubEntityProviderConfig_cjs = {};

var backendPluginApi$1 = require$$0;

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
  const organization = config.getString("organization");
  const catalogPath = config.getOptionalString("catalogPath") ?? DEFAULT_CATALOG_PATH;
  const host = config.getOptionalString("host") ?? "github.com";
  const repositoryPattern = config.getOptionalString("filters.repository");
  const branchPattern = config.getOptionalString("filters.branch");
  const allowForks = config.getOptionalBoolean("filters.allowForks") ?? true;
  const topicFilterInclude = config?.getOptionalStringArray(
    "filters.topic.include"
  );
  const topicFilterExclude = config?.getOptionalStringArray(
    "filters.topic.exclude"
  );
  const validateLocationsExist = config?.getOptionalBoolean("validateLocationsExist") ?? false;
  const catalogPathContainsWildcard = catalogPath.includes("*");
  const visibilityFilterInclude = config?.getOptionalStringArray("filters.visibility");
  if (validateLocationsExist && catalogPathContainsWildcard) {
    throw Error(
      `Error while processing GitHub provider config. The catalog path ${catalogPath} contains a wildcard, which is incompatible with validation of locations existing before emitting them. Ensure that validateLocationsExist is set to false.`
    );
  }
  const schedule = config.has("schedule") ? backendPluginApi$1.readSchedulerServiceTaskScheduleDefinitionFromConfig(
    config.getConfig("schedule")
  ) : void 0;
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

GithubEntityProviderConfig_cjs.readProviderConfigs = readProviderConfigs;

var github_cjs = {};

var defaultTransformers_cjs = {};

var annotation_cjs = {};

const ANNOTATION_GITHUB_USER_LOGIN = "github.com/user-login";
const ANNOTATION_GITHUB_TEAM_SLUG = "github.com/team-slug";

annotation_cjs.ANNOTATION_GITHUB_TEAM_SLUG = ANNOTATION_GITHUB_TEAM_SLUG;
annotation_cjs.ANNOTATION_GITHUB_USER_LOGIN = ANNOTATION_GITHUB_USER_LOGIN;

var annotation$1 = annotation_cjs;

const defaultUserTransformer = async (item, _ctx) => {
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "User",
    metadata: {
      name: item.login,
      annotations: {
        [annotation$1.ANNOTATION_GITHUB_USER_LOGIN]: item.login
      }
    },
    spec: {
      profile: {},
      memberOf: []
    }
  };
  if (item.bio) entity.metadata.description = item.bio;
  if (item.name) entity.spec.profile.displayName = item.name;
  if (item.email) entity.spec.profile.email = item.email;
  if (item.avatarUrl) entity.spec.profile.picture = item.avatarUrl;
  return entity;
};
const defaultOrganizationTeamTransformer = async (team) => {
  const annotations = {
    [annotation$1.ANNOTATION_GITHUB_TEAM_SLUG]: team.combinedSlug
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

defaultTransformers_cjs.defaultOrganizationTeamTransformer = defaultOrganizationTeamTransformer;
defaultTransformers_cjs.defaultUserTransformer = defaultUserTransformer;

var withLocations_cjs = {};

var util_cjs = {};

function parseGithubOrgUrl(urlString) {
  const path = new URL(urlString).pathname.slice(1).split("/");
  if (path.length === 1 && path[0].length) {
    return { org: decodeURIComponent(path[0]) };
  }
  throw new Error(`Expected a URL pointing to /<org>`);
}
function satisfiesTopicFilter(topics, topicFilter) {
  if (!topicFilter) return true;
  if (!topicFilter.include && !topicFilter.exclude) return true;
  if (!topicFilter.include?.length && !topicFilter.exclude?.length) return true;
  if (topicFilter.include?.length && !topicFilter.exclude) {
    for (const topic of topics) {
      if (topicFilter.include.includes(topic)) return true;
    }
    return false;
  }
  if (!topicFilter.include && topicFilter.exclude?.length) {
    if (!topics.length) return true;
    for (const topic of topics) {
      if (topicFilter.exclude.includes(topic)) return false;
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
    if (matchesExclude) return false;
    return matchesInclude;
  }
  return true;
}
function satisfiesForkFilter(allowForks, isFork) {
  if (!allowForks && isFork) return false;
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

util_cjs.parseGithubOrgUrl = parseGithubOrgUrl;
util_cjs.satisfiesForkFilter = satisfiesForkFilter;
util_cjs.satisfiesTopicFilter = satisfiesTopicFilter;
util_cjs.satisfiesVisibilityFilter = satisfiesVisibilityFilter;
util_cjs.splitTeamSlug = splitTeamSlug;

var catalogModel = require$$0$1;
var lodash$1 = require$$1;
var annotation = annotation_cjs;
var util$1 = util_cjs;

function withLocations$1(baseUrl, org, entity) {
  const login = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || entity.metadata.name;
  let team = entity.metadata.name;
  const slug = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [_, slugTeam] = util$1.splitTeamSlug(slug);
    team = slugTeam;
  }
  const location = entity.kind === "Group" ? `url:${baseUrl}/orgs/${org}/teams/${team}` : `url:${baseUrl}/${login}`;
  return lodash$1.merge(
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

withLocations_cjs.withLocations = withLocations$1;

var defaultTransformers = defaultTransformers_cjs;
var withLocations = withLocations_cjs;

async function getOrganizationUsers(client, org, tokenType, userTransformer = defaultTransformers.defaultUserTransformer) {
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
    (r) => r.organization?.membersWithRole,
    userTransformer,
    {
      org,
      email: tokenType === "token"
    }
  );
  return { users };
}
async function getOrganizationTeams(client, org, teamTransformer = defaultTransformers.defaultOrganizationTeamTransformer) {
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
    (r) => r.organization?.teams,
    materialisedTeams,
    { org }
  );
  return { teams };
}
async function getOrganizationTeamsFromUsers(client, org, userLogins, teamTransformer = defaultTransformers.defaultOrganizationTeamTransformer) {
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
    (r) => r.organization?.teams,
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
    (r) => r.user?.organizations,
    async (o) => o.login,
    { user }
  );
  return { orgs };
}
async function getOrganizationTeam(client, org, teamSlug, teamTransformer = defaultTransformers.defaultOrganizationTeamTransformer) {
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
  if (!response.organization?.team)
    throw new Error(`Found no match for team ${teamSlug}`);
  const team = await materialisedTeam(response.organization?.team, {
    query,
    client,
    org
  });
  if (!team) throw new Error(`Can't transform for team ${teamSlug}`);
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
    (r) => r.repositoryOwner?.repositories,
    async (x) => x,
    { org, catalogPathRef }
  );
  return { repositories };
}
async function getOrganizationRepository(client, org, repoName, catalogPath) {
  let relativeCatalogPathRef;
  if (catalogPath.startsWith("/")) {
    relativeCatalogPathRef = catalogPath.substring(1);
  } else {
    relativeCatalogPathRef = catalogPath;
  }
  const catalogPathRef = `HEAD:${relativeCatalogPathRef}`;
  const query = `
    query repository($org: String!, $repoName: String!, $catalogPathRef: String!) {
      repositoryOwner(login: $org) {
        repository(name: $repoName) {
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
      }
    }`;
  const response = await client(query, {
    org,
    repoName,
    catalogPathRef
  });
  return response.repositoryOwner?.repository || null;
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
    (r) => r.organization?.team?.members,
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
    entity: withLocations.withLocations(`https://${host}`, org, entity)
  }))
});
const createRemoveEntitiesOperation = (id, host) => (org, entities) => ({
  added: [],
  removed: entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations.withLocations(`https://${host}`, org, entity)
  }))
});
const createReplaceEntitiesOperation = (id, host) => (org, entities) => {
  const entitiesToReplace = entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations.withLocations(`https://${host}`, org, entity)
  }));
  return {
    removed: entitiesToReplace,
    added: entitiesToReplace
  };
};

github_cjs.createAddEntitiesOperation = createAddEntitiesOperation;
github_cjs.createRemoveEntitiesOperation = createRemoveEntitiesOperation;
github_cjs.createReplaceEntitiesOperation = createReplaceEntitiesOperation;
github_cjs.getOrganizationRepositories = getOrganizationRepositories;
github_cjs.getOrganizationRepository = getOrganizationRepository;
github_cjs.getOrganizationTeam = getOrganizationTeam;
github_cjs.getOrganizationTeams = getOrganizationTeams;
github_cjs.getOrganizationTeamsFromUsers = getOrganizationTeamsFromUsers;
github_cjs.getOrganizationUsers = getOrganizationUsers;
github_cjs.getOrganizationsFromUser = getOrganizationsFromUser;
github_cjs.getTeamMembers = getTeamMembers;
github_cjs.queryWithPaging = queryWithPaging;

var integration$1 = require$$0$2;
var pluginCatalogNode = require$$1$1;
var graphql = require$$2;
var uuid = require$$3;
var GithubEntityProviderConfig = GithubEntityProviderConfig_cjs;
var github = github_cjs;
var util = util_cjs;
var minimatch = require$$7;

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
class GithubEntityProvider$1 {
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
    const integrations = integration$1.ScmIntegrations.fromConfig(config);
    return GithubEntityProviderConfig.readProviderConfigs(config).map((providerConfig) => {
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
      const taskRunner = options.schedule ?? options.scheduler.createScheduledTaskRunner(providerConfig.schedule);
      return new GithubEntityProvider$1(
        providerConfig,
        integration,
        options.logger,
        taskRunner,
        options.events
      );
    });
  }
  constructor(config, integration$1$1, logger, taskRunner, events) {
    this.config = config;
    this.events = events;
    this.integration = integration$1$1.config;
    this.logger = logger.child({
      target: this.getProviderName()
    });
    this.scheduleFn = this.createScheduleFn(taskRunner);
    this.githubCredentialsProvider = integration$1.SingleInstanceGithubCredentialsProvider.create(integration$1$1.config);
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `github-provider:${this.config.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
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
            class: GithubEntityProvider$1.prototype.constructor.name,
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
      const location = GithubEntityProvider$1.toLocationSpec(target);
      return pluginCatalogNode.locationSpecToLocationEntity({ location });
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  toDeferredEntitiesFromRepos(repositories) {
    return repositories.map((repository) => this.createLocationUrl(repository)).map(GithubEntityProvider$1.toLocationSpec).map((location) => {
      return {
        locationKey: this.getProviderName(),
        entity: pluginCatalogNode.locationSpecToLocationEntity({ location })
      };
    });
  }
}

GithubEntityProvider_cjs.GithubEntityProvider = GithubEntityProvider$1;

var GithubLocationAnalyzer_cjs = {};

var catalogClient = require$$0$3;
var integration = require$$0$2;
var rest = require$$2$1;
var lodash = require$$1;
var parseGitUrl = require$$4;
var backendCommon = require$$5;
var path = require$$6;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var parseGitUrl__default = /*#__PURE__*/_interopDefaultCompat(parseGitUrl);

class GithubLocationAnalyzer$1 {
  catalogClient;
  githubCredentialsProvider;
  integrations;
  auth;
  constructor(options) {
    this.catalogClient = options.catalog ?? new catalogClient.CatalogClient({ discoveryApi: options.discovery });
    this.integrations = integration.ScmIntegrations.fromConfig(options.config);
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.auth = backendCommon.createLegacyAuthAdapters({
      auth: options.auth,
      discovery: options.discovery,
      tokenManager: options.tokenManager
    }).auth;
  }
  supports(url) {
    const integration = this.integrations.byUrl(url);
    return integration?.type === "github";
  }
  async analyze(options) {
    const { url, catalogFilename } = options;
    const { owner, name: repo } = parseGitUrl__default.default(url);
    const catalogFile = catalogFilename || "catalog-info.yaml";
    const extension = path.extname(catalogFile);
    const extensionQuery = !lodash.isEmpty(extension) ? `extension:${extension.replace(".", "")}` : "";
    const query = `filename:${catalogFile} ${extensionQuery} repo:${owner}/${repo}`;
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
      const { token: serviceToken } = await this.auth.getPluginRequestToken({
        onBehalfOf: await this.auth.getOwnServiceCredentials(),
        targetPluginId: "catalog"
      });
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

GithubLocationAnalyzer_cjs.GithubLocationAnalyzer = GithubLocationAnalyzer$1;

var backendPluginApi = require$$0;
var alpha = require$$1$2;
var pluginEventsNode = require$$2$2;
var GithubEntityProvider = GithubEntityProvider_cjs;
var GithubLocationAnalyzer = GithubLocationAnalyzer_cjs;

const githubCatalogModule$1 = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "github",
  register(env) {
    env.registerInit({
      deps: {
        catalogAnalyzers: alpha.catalogAnalysisExtensionPoint,
        auth: backendPluginApi.coreServices.auth,
        catalogProcessing: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        discovery: backendPluginApi.coreServices.discovery,
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        catalog: alpha.catalogServiceRef
      },
      async init({
        catalogProcessing,
        config,
        events,
        logger,
        scheduler,
        catalogAnalyzers,
        discovery,
        auth,
        catalog
      }) {
        catalogAnalyzers.addScmLocationAnalyzer(
          new GithubLocationAnalyzer.GithubLocationAnalyzer({
            discovery,
            config,
            auth,
            catalog
          })
        );
        catalogProcessing.addEntityProvider(
          GithubEntityProvider.GithubEntityProvider.fromConfig(config, {
            events,
            logger,
            scheduler
          })
        );
      }
    });
  }
});

githubCatalogModule_cjs.githubCatalogModule = githubCatalogModule$1;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var githubCatalogModule = githubCatalogModule_cjs;

const _feature = githubCatalogModule.githubCatalogModule;

var _default = alpha_cjs.default = _feature;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
