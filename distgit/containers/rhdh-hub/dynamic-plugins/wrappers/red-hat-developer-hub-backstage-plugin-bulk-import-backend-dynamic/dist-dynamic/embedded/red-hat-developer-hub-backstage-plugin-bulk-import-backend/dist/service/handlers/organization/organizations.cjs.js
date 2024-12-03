'use strict';

var handlers = require('../handlers.cjs.js');

async function findAllOrganizations(logger, githubApiService, search, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
  logger.debug(
    `Getting all organizations (search,page,size)=('${search ?? ""}',${pageNumber},${pageSize})..`
  );
  const allOrgsAccessible = await githubApiService.getOrganizationsFromIntegrations(
    search,
    pageNumber,
    pageSize
  );
  const errorList = [];
  for (const err of allOrgsAccessible.errors ?? []) {
    if (err.error?.message) {
      errorList.push(err.error.message);
    }
  }
  if (allOrgsAccessible.organizations?.length === 0 && errorList.length > 0) {
    return {
      statusCode: 500,
      responseBody: {
        errors: errorList
      }
    };
  }
  const orgMap = extractOrgMap(allOrgsAccessible);
  const organizations = sortOrgs(orgMap);
  return {
    statusCode: 200,
    responseBody: {
      errors: errorList,
      organizations,
      totalCount: allOrgsAccessible.totalCount,
      pagePerIntegration: pageNumber,
      sizePerIntegration: pageSize
    }
  };
}
function extractOrgMap(allOrgsAccessible) {
  const orgMap = /* @__PURE__ */ new Map();
  for (const org of allOrgsAccessible.organizations ?? []) {
    let totalRepoCount;
    if (org.public_repos !== void 0 || org.total_private_repos !== void 0 || org.owned_private_repos !== void 0) {
      totalRepoCount = (org.public_repos ?? 0) + (org.owned_private_repos ?? org.total_private_repos ?? 0);
    }
    orgMap.set(org.name, {
      id: `${org.id}`,
      name: org.name,
      description: org.description,
      url: org.url,
      totalRepoCount,
      errors: []
    });
  }
  return orgMap;
}
function sortOrgs(orgMap) {
  const organizations = Array.from(orgMap.values());
  organizations.sort((a, b) => {
    if (a.name === void 0 && b.name === void 0) {
      return 0;
    }
    if (a.name === void 0) {
      return -1;
    }
    if (b.name === void 0) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
  return organizations;
}

exports.findAllOrganizations = findAllOrganizations;
//# sourceMappingURL=organizations.cjs.js.map
