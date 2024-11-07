'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-plugin-api');
var require$$1$2 = require('@backstage/plugin-catalog-node/alpha');
var require$$2$2 = require('@backstage/plugin-events-node');
var require$$1 = require('@backstage/integration');
var require$$1$1 = require('@backstage/plugin-catalog-node');
var require$$2 = require('@octokit/graphql');
var require$$3$1 = require('uuid');
var require$$0$1 = require('@backstage/catalog-model');
var require$$3 = require('lodash');
var require$$7 = require('minimatch');
var require$$0$2 = require('@backstage/catalog-client');
var require$$2$1 = require('@octokit/rest');
var require$$4 = require('git-url-parse');
var require$$5 = require('@backstage/backend-common');
var require$$6 = require('path');

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var index_cjs$2 = {};

var module_cjs = {};

var index_cjs$1 = {};

var githubCatalogModule_cjs = {};

var GithubEntityProvider_cjs = {};

var GithubEntityProviderConfig_cjs = {};

var backendPluginApi$2 = require$$0;

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
  const schedule = config.has("schedule") ? backendPluginApi$2.readSchedulerServiceTaskScheduleDefinitionFromConfig(
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

var annotation$2 = annotation_cjs;

const defaultUserTransformer = async (item, _ctx) => {
  const entity = {
    apiVersion: "backstage.io/v1alpha1",
    kind: "User",
    metadata: {
      name: item.login,
      annotations: {
        [annotation$2.ANNOTATION_GITHUB_USER_LOGIN]: item.login
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
    [annotation$2.ANNOTATION_GITHUB_TEAM_SLUG]: team.combinedSlug
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

var catalogModel$5 = require$$0$1;
var lodash$2 = require$$3;
var annotation$1 = annotation_cjs;
var util$4 = util_cjs;

function withLocations$3(baseUrl, org, entity) {
  const login = entity.metadata.annotations?.[annotation$1.ANNOTATION_GITHUB_USER_LOGIN] || entity.metadata.name;
  let team = entity.metadata.name;
  const slug = entity.metadata.annotations?.[annotation$1.ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [_, slugTeam] = util$4.splitTeamSlug(slug);
    team = slugTeam;
  }
  const location = entity.kind === "Group" ? `url:${baseUrl}/orgs/${org}/teams/${team}` : `url:${baseUrl}/${login}`;
  return lodash$2.merge(
    {
      metadata: {
        annotations: {
          [catalogModel$5.ANNOTATION_LOCATION]: location,
          [catalogModel$5.ANNOTATION_ORIGIN_LOCATION]: location
        }
      }
    },
    entity
  );
}

withLocations_cjs.withLocations = withLocations$3;

var defaultTransformers$4 = defaultTransformers_cjs;
var withLocations$2 = withLocations_cjs;

async function getOrganizationUsers(client, org, tokenType, userTransformer = defaultTransformers$4.defaultUserTransformer) {
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
async function getOrganizationTeams(client, org, teamTransformer = defaultTransformers$4.defaultOrganizationTeamTransformer) {
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
async function getOrganizationTeamsFromUsers(client, org, userLogins, teamTransformer = defaultTransformers$4.defaultOrganizationTeamTransformer) {
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
async function getOrganizationTeam(client, org, teamSlug, teamTransformer = defaultTransformers$4.defaultOrganizationTeamTransformer) {
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
    entity: withLocations$2.withLocations(`https://${host}`, org, entity)
  }))
});
const createRemoveEntitiesOperation = (id, host) => (org, entities) => ({
  added: [],
  removed: entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations$2.withLocations(`https://${host}`, org, entity)
  }))
});
const createReplaceEntitiesOperation = (id, host) => (org, entities) => {
  const entitiesToReplace = entities.map((entity) => ({
    locationKey: `github-org-provider:${id}`,
    entity: withLocations$2.withLocations(`https://${host}`, org, entity)
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

var integration$6 = require$$1;
var pluginCatalogNode$3 = require$$1$1;
var graphql$5 = require$$2;
var uuid$2 = require$$3$1;
var GithubEntityProviderConfig = GithubEntityProviderConfig_cjs;
var github$5 = github_cjs;
var util$3 = util_cjs;
var minimatch = require$$7;

function _interopNamespaceCompat$2(e) {
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

var uuid__namespace$2 = /*#__PURE__*/_interopNamespaceCompat$2(uuid$2);

const EVENT_TOPICS$2 = ["github.push", "github.repository"];
class GithubEntityProvider$3 {
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
    const integrations = integration$6.ScmIntegrations.fromConfig(config);
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
      return new GithubEntityProvider$3(
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
    this.githubCredentialsProvider = integration$6.SingleInstanceGithubCredentialsProvider.create(integration$1.config);
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
      topics: EVENT_TOPICS$2,
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
            class: GithubEntityProvider$3.prototype.constructor.name,
            taskId,
            taskInstanceId: uuid__namespace$2.v4()
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
    return graphql$5.graphql.defaults({
      baseUrl: this.integration.apiBaseUrl,
      headers
    });
  }
  // go to the server and get all repositories
  async findCatalogFiles() {
    const organization = this.config.organization;
    const catalogPath = this.config.catalogPath;
    const client = await this.createGraphqlClient();
    const { repositories: repositoriesFromGithub } = await github$5.getOrganizationRepositories(client, organization, catalogPath);
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
      return !r.isArchived && (!repositoryFilter || repositoryFilter.test(r.name)) && util$3.satisfiesTopicFilter(repoTopics, topicFilters) && util$3.satisfiesForkFilter(allowForks, r.isFork) && util$3.satisfiesVisibilityFilter(visibilities, r.visibility) && r.defaultBranchRef;
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
    if (EVENT_TOPICS$2.some((topic) => topic === params.topic)) {
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
    return EVENT_TOPICS$2;
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
      const repositoryFromGithub = await github$5.getOrganizationRepository(
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
      const location = GithubEntityProvider$3.toLocationSpec(target);
      return pluginCatalogNode$3.locationSpecToLocationEntity({ location });
    }).map((entity) => {
      return {
        locationKey: this.getProviderName(),
        entity
      };
    });
  }
  toDeferredEntitiesFromRepos(repositories) {
    return repositories.map((repository) => this.createLocationUrl(repository)).map(GithubEntityProvider$3.toLocationSpec).map((location) => {
      return {
        locationKey: this.getProviderName(),
        entity: pluginCatalogNode$3.locationSpecToLocationEntity({ location })
      };
    });
  }
}

GithubEntityProvider_cjs.GithubEntityProvider = GithubEntityProvider$3;

var GithubLocationAnalyzer_cjs = {};

var catalogClient = require$$0$2;
var integration$5 = require$$1;
var rest = require$$2$1;
var lodash$1 = require$$3;
var parseGitUrl = require$$4;
var backendCommon = require$$5;
var path = require$$6;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var parseGitUrl__default = /*#__PURE__*/_interopDefaultCompat(parseGitUrl);

class GithubLocationAnalyzer$2 {
  catalogClient;
  githubCredentialsProvider;
  integrations;
  auth;
  constructor(options) {
    this.catalogClient = options.catalog ?? new catalogClient.CatalogClient({ discoveryApi: options.discovery });
    this.integrations = integration$5.ScmIntegrations.fromConfig(options.config);
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration$5.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
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
    const extensionQuery = !lodash$1.isEmpty(extension) ? `extension:${extension.replace(".", "")}` : "";
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
        searchResult.data.items.map((i) => `${lodash$1.trimEnd(url, "/")}/blob/${defaultBranch}/${i.path}`).map(async (target) => {
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

GithubLocationAnalyzer_cjs.GithubLocationAnalyzer = GithubLocationAnalyzer$2;

var backendPluginApi$1 = require$$0;
var alpha$1 = require$$1$2;
var pluginEventsNode$1 = require$$2$2;
var GithubEntityProvider$2 = GithubEntityProvider_cjs;
var GithubLocationAnalyzer$1 = GithubLocationAnalyzer_cjs;

const githubCatalogModule$1 = backendPluginApi$1.createBackendModule({
  pluginId: "catalog",
  moduleId: "github",
  register(env) {
    env.registerInit({
      deps: {
        catalogAnalyzers: alpha$1.catalogAnalysisExtensionPoint,
        auth: backendPluginApi$1.coreServices.auth,
        catalogProcessing: alpha$1.catalogProcessingExtensionPoint,
        config: backendPluginApi$1.coreServices.rootConfig,
        discovery: backendPluginApi$1.coreServices.discovery,
        events: pluginEventsNode$1.eventsServiceRef,
        logger: backendPluginApi$1.coreServices.logger,
        scheduler: backendPluginApi$1.coreServices.scheduler,
        catalog: alpha$1.catalogServiceRef
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
          new GithubLocationAnalyzer$1.GithubLocationAnalyzer({
            discovery,
            config,
            auth,
            catalog
          })
        );
        catalogProcessing.addEntityProvider(
          GithubEntityProvider$2.GithubEntityProvider.fromConfig(config, {
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

var GithubDiscoveryProcessor_cjs = {};

var integration$4 = require$$1;
var pluginCatalogNode$2 = require$$1$1;
var graphql$4 = require$$2;
var github$4 = github_cjs;


class GithubDiscoveryProcessor$1 {
  integrations;
  logger;
  githubCredentialsProvider;
  static fromConfig(config, options) {
    const integrations = integration$4.ScmIntegrations.fromConfig(config);
    return new GithubDiscoveryProcessor$1({
      ...options,
      integrations
    });
  }
  constructor(options) {
    this.integrations = options.integrations;
    this.logger = options.logger;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration$4.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
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
    const client = graphql$4.graphql.defaults({
      baseUrl: gitHubConfig.apiBaseUrl,
      headers
    });
    const startTimestamp = Date.now();
    this.logger.info(`Reading GitHub repositories from ${location.target}`);
    const { repositories } = await github$4.getOrganizationRepositories(
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
        pluginCatalogNode$2.processingResult.location({
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

GithubDiscoveryProcessor_cjs.GithubDiscoveryProcessor = GithubDiscoveryProcessor$1;
GithubDiscoveryProcessor_cjs.escapeRegExp = escapeRegExp;
GithubDiscoveryProcessor_cjs.parseUrl = parseUrl;

var GithubMultiOrgReaderProcessor_cjs = {};

var config_cjs = {};

function readGithubMultiOrgConfig(config) {
  const orgConfigs = config.getOptionalConfigArray("orgs") ?? [];
  return orgConfigs.map((c) => ({
    name: c.getString("name"),
    groupNamespace: (c.getOptionalString("groupNamespace") ?? c.getString("name")).toLowerCase(),
    userNamespace: c.getOptionalString("userNamespace") ?? void 0
  }));
}

config_cjs.readGithubMultiOrgConfig = readGithubMultiOrgConfig;

var org_cjs = {};

var catalogModel$4 = require$$0$1;

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
  const groupMemberUsers = new Map(
    groups.map((group) => {
      const groupKey = group.metadata.namespace && group.metadata.namespace !== catalogModel$4.DEFAULT_NAMESPACE ? `${group.metadata.namespace}/${group.metadata.name}` : group.metadata.name;
      return [
        groupKey,
        group.spec.members?.map(
          (m) => catalogModel$4.stringifyEntityRef(catalogModel$4.parseEntityRef(m, { defaultKind: "user" }))
        ) || []
      ];
    })
  );
  const usersByRef = new Map(users.map((u) => [catalogModel$4.stringifyEntityRef(u), u]));
  for (const [groupName, userRefs] of groupMemberUsers.entries()) {
    for (const ref of userRefs) {
      const user = usersByRef.get(ref);
      if (user && !user.spec.memberOf?.includes(groupName)) {
        if (!user.spec.memberOf) {
          user.spec.memberOf = [];
        }
        user.spec.memberOf.push(groupName);
      }
    }
  }
}

org_cjs.assignGroupsToUsers = assignGroupsToUsers;
org_cjs.buildOrgHierarchy = buildOrgHierarchy;

var guards_cjs = {};

var catalogModel$3 = require$$0$1;

function areGroupEntities(entities) {
  return entities.every((e) => catalogModel$3.isGroupEntity(e));
}
function areUserEntities(entities) {
  return entities.every((e) => catalogModel$3.isUserEntity(e));
}

guards_cjs.areGroupEntities = areGroupEntities;
guards_cjs.areUserEntities = areUserEntities;

var catalogModel$2 = require$$0$1;
var integration$3 = require$$1;
var pluginCatalogNode$1 = require$$1$1;
var graphql$3 = require$$2;
var config = config_cjs;
var github$3 = github_cjs;
var defaultTransformers$3 = defaultTransformers_cjs;
var org$3 = org_cjs;
var guards$3 = guards_cjs;

class GithubMultiOrgReaderProcessor$1 {
  constructor(options) {
    this.options = options;
    this.integrations = options.integrations;
    this.logger = options.logger;
    this.orgs = options.orgs;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration$3.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
  }
  integrations;
  orgs;
  logger;
  githubCredentialsProvider;
  static fromConfig(config$1, options) {
    const c = config$1.getOptionalConfig("catalog.processors.githubMultiOrg");
    const integrations = integration$3.ScmIntegrations.fromConfig(config$1);
    return new GithubMultiOrgReaderProcessor$1({
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
        const client = graphql$3.graphql.defaults({
          baseUrl: gitHubConfig.apiBaseUrl,
          headers
        });
        const startTimestamp = Date.now();
        this.logger.info(
          `Reading GitHub users and teams for org: ${orgConfig.name}`
        );
        const { users } = await github$3.getOrganizationUsers(
          client,
          orgConfig.name,
          tokenType,
          async (githubUser, ctx) => {
            const result = this.options.userTransformer ? await this.options.userTransformer(githubUser, ctx) : await defaultTransformers$3.defaultUserTransformer(githubUser, ctx);
            if (result) {
              result.metadata.namespace = orgConfig.userNamespace;
            }
            return result;
          }
        );
        const { teams } = await github$3.getOrganizationTeams(
          client,
          orgConfig.name,
          async (team, ctx) => {
            const result = this.options.teamTransformer ? await this.options.teamTransformer(team, ctx) : await defaultTransformers$3.defaultOrganizationTeamTransformer(team, ctx);
            if (result && catalogModel$2.isGroupEntity(result)) {
              result.metadata.namespace = orgConfig.groupNamespace;
              result.spec.members = team.members.map(
                (user) => `${orgConfig.userNamespace ?? catalogModel$2.DEFAULT_NAMESPACE}/${user.login}`
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
          const userRef = catalogModel$2.stringifyEntityRef(u);
          if (!allUsersMap.has(userRef)) {
            allUsersMap.set(userRef, u);
          }
          return allUsersMap.get(userRef);
        });
        if (guards$3.areGroupEntities(teams)) {
          org$3.buildOrgHierarchy(teams);
          if (guards$3.areUserEntities(pendingUsers)) {
            org$3.assignGroupsToUsers(pendingUsers, teams);
          }
        }
        for (const team of teams) {
          emit(pluginCatalogNode$1.processingResult.entity(location, team));
        }
      } catch (e) {
        this.logger.error(
          `Failed to read GitHub org data for ${orgConfig.name}: ${e}`
        );
      }
    }
    const allUsers = Array.from(allUsersMap.values());
    for (const user of allUsers) {
      emit(pluginCatalogNode$1.processingResult.entity(location, user));
    }
    return true;
  }
  // Note: Does not support usage of PATs
  async getAllOrgs(gitHubConfig) {
    const githubAppMux = new integration$3.GithubAppCredentialsMux(gitHubConfig);
    const installs = await githubAppMux.getAllInstallations();
    return installs.map(
      (install) => install.target_type === "Organization" && install.account && "login" in install.account && install.account.login ? {
        name: install.account.login,
        groupNamespace: install.account.login.toLowerCase()
      } : void 0
    ).filter(Boolean);
  }
}

GithubMultiOrgReaderProcessor_cjs.GithubMultiOrgReaderProcessor = GithubMultiOrgReaderProcessor$1;

var GithubOrgReaderProcessor_cjs = {};

var integration$2 = require$$1;
var pluginCatalogNode = require$$1$1;
var graphql$2 = require$$2;
var github$2 = github_cjs;
var org$2 = org_cjs;
var util$2 = util_cjs;
var guards$2 = guards_cjs;

class GithubOrgReaderProcessor$1 {
  integrations;
  logger;
  githubCredentialsProvider;
  static fromConfig(config, options) {
    const integrations = integration$2.ScmIntegrations.fromConfig(config);
    return new GithubOrgReaderProcessor$1({
      ...options,
      integrations
    });
  }
  constructor(options) {
    this.integrations = options.integrations;
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration$2.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
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
    const { org: org$1 } = util$2.parseGithubOrgUrl(location.target);
    const startTimestamp = Date.now();
    this.logger.info("Reading GitHub users and groups");
    const { users } = await github$2.getOrganizationUsers(client, org$1, tokenType);
    const { teams } = await github$2.getOrganizationTeams(client, org$1);
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${users.length} GitHub users and ${teams.length} GitHub teams in ${duration} seconds`
    );
    if (guards$2.areGroupEntities(teams)) {
      org$2.buildOrgHierarchy(teams);
      if (guards$2.areUserEntities(users)) {
        org$2.assignGroupsToUsers(users, teams);
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
    const client = graphql$2.graphql.defaults({
      baseUrl: gitHubConfig.apiBaseUrl,
      headers
    });
    return { client, tokenType };
  }
}

GithubOrgReaderProcessor_cjs.GithubOrgReaderProcessor = GithubOrgReaderProcessor$1;

var GithubMultiOrgEntityProvider_cjs = {};

var catalogModel$1 = require$$0$1;
var integration$1 = require$$1;
var graphql$1 = require$$2;
var lodash = require$$3;
var uuid$1 = require$$3$1;
var github$1 = github_cjs;
var defaultTransformers$2 = defaultTransformers_cjs;
var org$1 = org_cjs;
var util$1 = util_cjs;
var annotation = annotation_cjs;
var guards$1 = guards_cjs;

function _interopNamespaceCompat$1(e) {
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

var uuid__namespace$1 = /*#__PURE__*/_interopNamespaceCompat$1(uuid$1);

const EVENT_TOPICS$1 = [
  "github.installation",
  "github.membership",
  "github.organization",
  "github.team"
];
class GithubMultiOrgEntityProvider$1 {
  constructor(options) {
    this.options = options;
  }
  connection;
  scheduleFn;
  static fromConfig(config, options) {
    const integrations = integration$1.ScmIntegrations.fromConfig(config);
    const gitHubConfig = integrations.github.byUrl(options.githubUrl)?.config;
    if (!gitHubConfig) {
      throw new Error(
        `There is no GitHub integration that matches ${options.githubUrl}. Please add a configuration entry for it under integrations.github.`
      );
    }
    const logger = options.logger.child({
      target: options.githubUrl
    });
    const provider = new GithubMultiOrgEntityProvider$1({
      id: options.id,
      gitHubConfig,
      githubCredentialsProvider: options.githubCredentialsProvider || integration$1.DefaultGithubCredentialsProvider.fromIntegrations(integrations),
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
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `GithubMultiOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
  async connect(connection) {
    this.connection = connection;
    await this.options.events?.subscribe({
      id: this.getProviderName(),
      topics: EVENT_TOPICS$1,
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
    const { markReadComplete } = trackProgress$1(logger);
    const allUsersMap = /* @__PURE__ */ new Map();
    const allTeams = [];
    const orgsToProcess = this.options.orgs?.length ? this.options.orgs : await this.getAllOrgs(this.options.gitHubConfig);
    for (const org$1$1 of orgsToProcess) {
      const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
        url: `${this.options.githubUrl}/${org$1$1}`
      });
      const client = graphql$1.graphql.defaults({
        baseUrl: this.options.gitHubConfig.apiBaseUrl,
        headers
      });
      logger.info(`Reading GitHub users and teams for org: ${org$1$1}`);
      const { users } = await github$1.getOrganizationUsers(
        client,
        org$1$1,
        tokenType,
        this.options.userTransformer
      );
      const { teams } = await github$1.getOrganizationTeams(
        client,
        org$1$1,
        this.defaultMultiOrgTeamTransformer.bind(this)
      );
      const pendingUsers = users.map((u) => {
        const userRef = catalogModel$1.stringifyEntityRef(u);
        if (!allUsersMap.has(userRef)) {
          allUsersMap.set(userRef, u);
        }
        return allUsersMap.get(userRef);
      });
      if (guards$1.areGroupEntities(teams)) {
        org$1.buildOrgHierarchy(teams);
        if (guards$1.areUserEntities(pendingUsers)) {
          org$1.assignGroupsToUsers(pendingUsers, teams);
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
        entity: withLocations$1(
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
    const org$1$1 = event.installation.account.login;
    const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1$1}`
    });
    const client = graphql$1.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { users } = await github$1.getOrganizationUsers(
      client,
      org$1$1,
      tokenType,
      this.options.userTransformer
    );
    const { teams } = await github$1.getOrganizationTeams(
      client,
      org$1$1,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    if (users.length) {
      for (const userOrg of applicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql$1.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams: userTeams } = await github$1.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          users.map(
            (u) => u.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || u.metadata.name
          ),
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (guards$1.areGroupEntities(userTeams) && guards$1.areUserEntities(users)) {
          org$1.assignGroupsToUsers(users, userTeams);
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
    const userTransformer = this.options.userTransformer || defaultTransformers$2.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.membership.user;
    const org$1$1 = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1$1}`
    });
    const client = graphql$1.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const { orgs } = await github$1.getOrganizationsFromUser(client, login);
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
        org: org$1$1,
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
        const orgClient = graphql$1.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await github$1.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          [login],
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (catalogModel$1.isUserEntity(user) && guards$1.areGroupEntities(teams)) {
          org$1.assignGroupsToUsers([user], teams);
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
    const client = graphql$1.graphql.defaults({
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
        parentTeam: { slug: event.team?.parent?.slug || "" },
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
    const org$1$1 = event.organization.login;
    const { headers, type: tokenType } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1$1}`
    });
    const client = graphql$1.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const teamSlug = event.team.slug;
    const { team } = await github$1.getOrganizationTeam(
      client,
      org$1$1,
      teamSlug,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    const { users } = await github$1.getOrganizationUsers(
      client,
      org$1$1,
      tokenType,
      this.options.userTransformer
    );
    const usersFromChangedGroup = catalogModel$1.isGroupEntity(team) ? team.spec.members?.map(
      (m) => catalogModel$1.stringifyEntityRef(catalogModel$1.parseEntityRef(m, { defaultKind: "user" }))
    ) || [] : [];
    const usersToRebuild = users.filter(
      (u) => usersFromChangedGroup.includes(catalogModel$1.stringifyEntityRef(u))
    );
    if (usersToRebuild.length) {
      for (const userOrg of applicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql$1.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await github$1.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          usersToRebuild.map(
            (u) => u.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || u.metadata.name
          ),
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (guards$1.areGroupEntities(teams) && guards$1.areUserEntities(usersToRebuild)) {
          org$1.assignGroupsToUsers(usersToRebuild, teams);
        }
      }
    }
    const oldName = event.changes.name?.from || "";
    const oldSlug = oldName.toLowerCase().replaceAll(/\s/gi, "-");
    const oldGroup = await this.defaultMultiOrgTeamTransformer(
      {
        name: event.changes.name?.from,
        slug: oldSlug,
        combinedSlug: `${org$1$1}/${oldSlug}`,
        description: event.changes.description?.from,
        parentTeam: { slug: event.team?.parent?.slug || "" },
        // entity will be removed
        members: []
      },
      {
        org: org$1$1,
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
    const org$1$1 = event.organization.login;
    const { headers } = await this.options.githubCredentialsProvider.getCredentials({
      url: `${this.options.githubUrl}/${org$1$1}`
    });
    const client = graphql$1.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
    });
    const teamSlug = event.team.slug;
    const { team } = await github$1.getOrganizationTeam(
      client,
      org$1$1,
      teamSlug,
      this.defaultMultiOrgTeamTransformer.bind(this)
    );
    const userTransformer = this.options.userTransformer || defaultTransformers$2.defaultUserTransformer;
    const { name, avatar_url: avatarUrl, email, login } = event.member;
    const user = await userTransformer(
      {
        name,
        avatarUrl,
        login,
        email: email ?? void 0
      },
      {
        org: org$1$1,
        client,
        query: ""
      }
    );
    const mutationEntities = [team];
    if (user && catalogModel$1.isUserEntity(user)) {
      const { orgs } = await github$1.getOrganizationsFromUser(client, login);
      const userApplicableOrgs = orgs.filter((o) => applicableOrgs.includes(o));
      for (const userOrg of userApplicableOrgs) {
        const { headers: orgHeaders } = await this.options.githubCredentialsProvider.getCredentials({
          url: `${this.options.githubUrl}/${userOrg}`
        });
        const orgClient = graphql$1.graphql.defaults({
          baseUrl: this.options.gitHubConfig.apiBaseUrl,
          headers: orgHeaders
        });
        const { teams } = await github$1.getOrganizationTeamsFromUsers(
          orgClient,
          userOrg,
          [login],
          this.defaultMultiOrgTeamTransformer.bind(this)
        );
        if (guards$1.areGroupEntities(teams)) {
          org$1.assignGroupsToUsers([user], teams);
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
            class: GithubMultiOrgEntityProvider$1.prototype.constructor.name,
            taskId: id,
            taskInstanceId: uuid__namespace$1.v4()
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
    const result = await defaultTransformers$2.defaultOrganizationTeamTransformer(team);
    if (result && result.spec) {
      if (!this.options.alwaysUseDefaultNamespace) {
        result.metadata.namespace = ctx.org.toLocaleLowerCase("en-US");
      }
      result.spec.members = team.members.map(
        (user) => `${catalogModel$1.DEFAULT_NAMESPACE}/${user.login}`
      );
    }
    return result;
  }
  // Note: Does not support usage of PATs
  async getAllOrgs(gitHubConfig) {
    const githubAppMux = new integration$1.GithubAppCredentialsMux(gitHubConfig);
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
        entity: withLocations$1(
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
        entity: withLocations$1(
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
function withLocations$1(baseUrl, entity) {
  const login = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_USER_LOGIN] || entity.metadata.name;
  let org = entity.metadata.namespace;
  let team = entity.metadata.name;
  const slug = entity.metadata.annotations?.[annotation.ANNOTATION_GITHUB_TEAM_SLUG];
  if (slug) {
    const [slugOrg, slugTeam] = util$1.splitTeamSlug(slug);
    org = slugOrg;
    team = slugTeam;
  }
  const location = entity.kind === "Group" ? `url:${baseUrl}/orgs/${org}/teams/${team}` : `url:${baseUrl}/${login}`;
  return lodash.merge(
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

GithubMultiOrgEntityProvider_cjs.GithubMultiOrgEntityProvider = GithubMultiOrgEntityProvider$1;
GithubMultiOrgEntityProvider_cjs.withLocations = withLocations$1;

var GithubOrgEntityProvider_cjs = {};

var catalogModel = require$$0$1;
var integration = require$$1;
var graphql = require$$2;
var uuid = require$$3$1;
var defaultTransformers$1 = defaultTransformers_cjs;
var github = github_cjs;
var org = org_cjs;
var util = util_cjs;
var withLocations = withLocations_cjs;
var guards = guards_cjs;

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
class GithubOrgEntityProvider$2 {
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
    const provider = new GithubOrgEntityProvider$2({
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
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.getProviderName} */
  getProviderName() {
    return `GithubOrgEntityProvider:${this.options.id}`;
  }
  /** {@inheritdoc @backstage/plugin-catalog-backend#EntityProvider.connect} */
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
    const client = graphql.graphql.defaults({
      baseUrl: this.options.gitHubConfig.apiBaseUrl,
      headers
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
    const organizationTeamTransformer = this.options.teamTransformer || defaultTransformers$1.defaultOrganizationTeamTransformer;
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
        parentTeam: { slug: event.team?.parent?.slug || "" },
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
    const userTransformer = this.options.userTransformer || defaultTransformers$1.defaultUserTransformer;
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
            class: GithubOrgEntityProvider$2.prototype.constructor.name,
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

GithubOrgEntityProvider_cjs.GithubOrgEntityProvider = GithubOrgEntityProvider$2;

var deprecated_cjs = {};

var GithubEntityProvider$1 = GithubEntityProvider_cjs;
var GithubOrgEntityProvider$1 = GithubOrgEntityProvider_cjs;

class GitHubOrgEntityProvider extends GithubOrgEntityProvider$1.GithubOrgEntityProvider {
  static fromConfig(config, options) {
    options.logger.warn(
      "[Deprecated] Use GithubOrgEntityProvider instead of GitHubOrgEntityProvider."
    );
    return GithubOrgEntityProvider$1.GithubOrgEntityProvider.fromConfig(
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
    return GithubEntityProvider$1.GithubEntityProvider.fromConfig(config, options).map(
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

deprecated_cjs.GitHubEntityProvider = GitHubEntityProvider;
deprecated_cjs.GitHubOrgEntityProvider = GitHubOrgEntityProvider;

Object.defineProperty(index_cjs$1, '__esModule', { value: true });

var githubCatalogModule = githubCatalogModule_cjs;
var GithubLocationAnalyzer = GithubLocationAnalyzer_cjs;
var GithubDiscoveryProcessor = GithubDiscoveryProcessor_cjs;
var GithubMultiOrgReaderProcessor = GithubMultiOrgReaderProcessor_cjs;
var GithubOrgReaderProcessor = GithubOrgReaderProcessor_cjs;
var GithubEntityProvider = GithubEntityProvider_cjs;
var GithubMultiOrgEntityProvider = GithubMultiOrgEntityProvider_cjs;
var GithubOrgEntityProvider = GithubOrgEntityProvider_cjs;
var defaultTransformers = defaultTransformers_cjs;


var deprecated = deprecated_cjs;



index_cjs$1.default = githubCatalogModule.githubCatalogModule;
index_cjs$1.GithubLocationAnalyzer = GithubLocationAnalyzer.GithubLocationAnalyzer;
index_cjs$1.GithubDiscoveryProcessor = GithubDiscoveryProcessor.GithubDiscoveryProcessor;
index_cjs$1.GithubMultiOrgReaderProcessor = GithubMultiOrgReaderProcessor.GithubMultiOrgReaderProcessor;
index_cjs$1.GithubOrgReaderProcessor = GithubOrgReaderProcessor.GithubOrgReaderProcessor;
index_cjs$1.GithubEntityProvider = GithubEntityProvider.GithubEntityProvider;
index_cjs$1.GithubMultiOrgEntityProvider = GithubMultiOrgEntityProvider.GithubMultiOrgEntityProvider;
index_cjs$1.GithubOrgEntityProvider = GithubOrgEntityProvider.GithubOrgEntityProvider;
index_cjs$1.defaultOrganizationTeamTransformer = defaultTransformers.defaultOrganizationTeamTransformer;
index_cjs$1.defaultUserTransformer = defaultTransformers.defaultUserTransformer;
index_cjs$1.GitHubEntityProvider = deprecated.GitHubEntityProvider;
index_cjs$1.GitHubOrgEntityProvider = deprecated.GitHubOrgEntityProvider;

var GithubOrgEntityCleanerProvider_cjs = {};

class GithubOrgEntityCleanerProvider$1 {
  constructor(options) {
    this.options = options;
    this.logger = options.logger.child({ target: this.getProviderName() });
  }
  logger;
  getProviderName() {
    return `GithubOrgEntityProvider:${this.options.id}`;
  }
  async connect(connection) {
    connection.applyMutation({
      type: "full",
      entities: []
    }).catch((error) => {
      this.logger.error("Failed to clean up entities", error);
    });
  }
}

GithubOrgEntityCleanerProvider_cjs.GithubOrgEntityCleanerProvider = GithubOrgEntityCleanerProvider$1;

var backendPluginApi = require$$0;
var pluginCatalogBackendModuleGithub = index_cjs$1;
var alpha = require$$1$2;
var pluginEventsNode = require$$2$2;
var GithubOrgEntityCleanerProvider = GithubOrgEntityCleanerProvider_cjs;

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
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, events, logger, scheduler }) {
        const definitions = readDefinitionsFromConfig(config);
        for (const definition of definitions) {
          catalog.addEntityProvider(
            new GithubOrgEntityCleanerProvider.GithubOrgEntityCleanerProvider({ id: definition.id, logger })
          );
          catalog.addEntityProvider(
            pluginCatalogBackendModuleGithub.GithubMultiOrgEntityProvider.fromConfig(config, {
              id: definition.id,
              githubUrl: definition.githubUrl,
              orgs: definition.orgs,
              events,
              schedule: scheduler.createScheduledTaskRunner(
                definition.schedule
              ),
              logger,
              userTransformer,
              teamTransformer,
              alwaysUseDefaultNamespace: definitions.length === 1 && definition.orgs?.length === 1
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
    schedule: backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
      c.getConfig("schedule")
    )
  }));
}

module_cjs.catalogModuleGithubOrgEntityProvider = catalogModuleGithubOrgEntityProvider;
module_cjs.githubOrgEntityProviderTransformsExtensionPoint = githubOrgEntityProviderTransformsExtensionPoint;

(function (exports) {

	Object.defineProperty(exports, '__esModule', { value: true });

	var module$1 = module_cjs;
	var pluginCatalogBackendModuleGithub = index_cjs$1;



	exports.default = module$1.catalogModuleGithubOrgEntityProvider;
	exports.githubOrgEntityProviderTransformsExtensionPoint = module$1.githubOrgEntityProviderTransformsExtensionPoint;
	Object.defineProperty(exports, "GithubMultiOrgEntityProvider", {
	  enumerable: true,
	  get: function () { return pluginCatalogBackendModuleGithub.GithubMultiOrgEntityProvider; }
	});
	
} (index_cjs$2));

var index_cjs = /*@__PURE__*/getDefaultExportFromCjs(index_cjs$2);

exports["default"] = index_cjs;
//# sourceMappingURL=index.cjs.js.map
