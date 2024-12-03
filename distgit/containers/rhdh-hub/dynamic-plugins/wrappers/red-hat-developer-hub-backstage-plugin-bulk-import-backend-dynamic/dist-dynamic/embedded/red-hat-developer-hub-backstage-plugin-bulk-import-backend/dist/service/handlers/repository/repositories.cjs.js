'use strict';

var gitUrlParse = require('git-url-parse');
var handlers = require('../handlers.cjs.js');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var importStatus = require('../import/importStatus.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

async function findAllRepositories(deps, reqParams) {
  const search = reqParams?.search;
  const checkStatus = reqParams?.checkStatus ?? false;
  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
  deps.logger.debug(
    `Getting all repositories - (search,page,size)=('${search ?? ""}',${pageNumber},${pageSize})..`
  );
  return deps.githubApiService.getRepositoriesFromIntegrations(search, pageNumber, pageSize).then((response) => formatResponse(deps, response, checkStatus));
}
async function findRepositoriesByOrganization(deps, orgName, search, checkStatus = false, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
  deps.logger.debug(
    `Getting all repositories for org "${orgName}" - (search,page,size)=(${search},${pageNumber},${pageSize})..`
  );
  return deps.githubApiService.getOrgRepositoriesFromIntegrations(orgName, search, pageNumber, pageSize).then((response) => formatResponse(deps, response, checkStatus));
}
function sortRepos(repoList) {
  repoList.sort((a, b) => {
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
}
async function formatResponse(deps, allReposAccessible, checkStatus) {
  const errorList = allReposAccessible.errors?.map((err) => err.error?.message)?.filter((msg) => msg) ?? [];
  if (allReposAccessible.repositories?.length === 0 && errorList.length > 0) {
    return {
      statusCode: 500,
      responseBody: {
        errors: errorList
      }
    };
  }
  let catalogLocations = [];
  if (checkStatus) {
    catalogLocations = (await deps.catalogHttpClient.listCatalogUrlLocations()).uniqueCatalogUrlLocations.keys();
  }
  const repoList = [];
  for (const repo of allReposAccessible.repositories) {
    const gitUrl = gitUrlParse__default.default(repo.html_url);
    const errors = [];
    let importStatus$1;
    if (checkStatus) {
      importStatus$1 = await importStatus.getImportStatusFromLocations(
        deps,
        repo.html_url,
        catalogLocations,
        repo.default_branch
      ).catch((error) => {
        errors.push(error.message);
        return void 0;
      });
    }
    const repoUpdatedAt = repo.updated_at ?? void 0;
    repoList.push({
      id: `${gitUrl.organization}/${repo.name}`,
      name: repo.name,
      organization: gitUrl.organization,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      importStatus: importStatus$1?.status,
      lastUpdate: importStatus$1?.lastUpdate ?? repoUpdatedAt,
      errors
    });
  }
  sortRepos(repoList);
  return {
    statusCode: 200,
    responseBody: {
      errors: errorList,
      repositories: repoList,
      totalCount: allReposAccessible.totalCount
    }
  };
}

exports.findAllRepositories = findAllRepositories;
exports.findRepositoriesByOrganization = findRepositoriesByOrganization;
//# sourceMappingURL=repositories.cjs.js.map
