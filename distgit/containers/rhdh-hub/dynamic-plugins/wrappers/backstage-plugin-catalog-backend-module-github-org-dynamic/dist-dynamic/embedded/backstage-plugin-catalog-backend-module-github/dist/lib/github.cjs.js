'use strict';

var defaultTransformers = require('./defaultTransformers.cjs.js');
var withLocations = require('./withLocations.cjs.js');
var core = require('@octokit/core');
var pluginThrottling = require('@octokit/plugin-throttling');

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
const createGraphqlClient = (args) => {
  const { headers, baseUrl, logger } = args;
  const ThrottledOctokit = core.Octokit.plugin(pluginThrottling.throttling);
  const octokit = new ThrottledOctokit({
    throttle: {
      onRateLimit: (retryAfter, rateLimitData, _, retryCount) => {
        logger.warn(
          `Request quota exhausted for request ${rateLimitData?.method} ${rateLimitData?.url}`
        );
        if (retryCount < 2) {
          logger.warn(
            `Retrying after ${retryAfter} seconds for the ${retryCount} time due to Rate Limit!`
          );
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (retryAfter, rateLimitData, _, retryCount) => {
        logger.warn(
          `Secondary Rate Limit Exhausted for request ${rateLimitData?.method} ${rateLimitData?.url}`
        );
        if (retryCount < 2) {
          logger.warn(
            `Retrying after ${retryAfter} seconds for the ${retryCount} time due to Secondary Rate Limit!`
          );
          return true;
        }
        return false;
      }
    }
  });
  const client = octokit.graphql.defaults({
    headers,
    baseUrl
  });
  return client;
};

exports.createAddEntitiesOperation = createAddEntitiesOperation;
exports.createGraphqlClient = createGraphqlClient;
exports.createRemoveEntitiesOperation = createRemoveEntitiesOperation;
exports.createReplaceEntitiesOperation = createReplaceEntitiesOperation;
exports.getOrganizationRepositories = getOrganizationRepositories;
exports.getOrganizationRepository = getOrganizationRepository;
exports.getOrganizationTeam = getOrganizationTeam;
exports.getOrganizationTeams = getOrganizationTeams;
exports.getOrganizationTeamsFromUsers = getOrganizationTeamsFromUsers;
exports.getOrganizationUsers = getOrganizationUsers;
exports.getOrganizationsFromUser = getOrganizationsFromUser;
exports.getTeamMembers = getTeamMembers;
exports.queryWithPaging = queryWithPaging;
//# sourceMappingURL=github.cjs.js.map
