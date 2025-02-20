'use strict';

var gitUrlParse = require('git-url-parse');
var catalogUtils = require('../../../catalog/catalogUtils.cjs.js');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var loggingUtils = require('../../../helpers/loggingUtils.cjs.js');
var pagination = require('../../../helpers/pagination.cjs.js');
var utils = require('../../../helpers/utils.cjs.js');
var handlers = require('../handlers.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

function sortImports(imports, sortColumn = handlers.DefaultSortColumn, sortOrder = handlers.DefaultSortOrder) {
  imports.sort((a, b) => {
    const value1 = utils.getNestedValue(a, sortColumn);
    const value2 = utils.getNestedValue(b, sortColumn);
    if (value1 === undefined && value2 === undefined) return 0;
    if (value1 === undefined) return sortOrder === "asc" ? -1 : 1;
    if (value2 === undefined) return sortOrder === "asc" ? 1 : -1;
    if (sortColumn === "lastUpdate") {
      const date1 = new Date(value1);
      const date2 = new Date(value2);
      return sortOrder === "asc" ? date2.getTime() - date1.getTime() : date1.getTime() - date2.getTime();
    }
    return sortOrder === "asc" ? value1.localeCompare(value2) : value2.localeCompare(value1);
  });
}
async function findAllImports(deps, requestHeaders, queryParams) {
  const apiVersion = requestHeaders?.apiVersion ?? "v1";
  const search = queryParams?.search;
  const pageNumber = queryParams?.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = queryParams?.pageSize ?? handlers.DefaultPageSize;
  const sortColumn = queryParams?.sortColumn ?? handlers.DefaultSortColumn;
  const sortOrder = queryParams?.sortOrder ?? handlers.DefaultSortOrder;
  const catalogFilename = catalogUtils.getCatalogFilename(deps.config);
  const allLocations = (await deps.catalogHttpClient.listCatalogUrlLocations(
    search,
    pageNumber,
    pageSize
  )).uniqueCatalogUrlLocations;
  const defaultBranchByRepoUrl = await resolveReposDefaultBranches(
    deps.logger,
    deps.githubApiService,
    allLocations.keys(),
    catalogFilename
  );
  const importCandidates = findImportCandidates(
    allLocations.keys(),
    defaultBranchByRepoUrl,
    catalogFilename
  );
  const importsReachableFromGHIntegrations = await deps.githubApiService.filterLocationsAccessibleFromIntegrations(
    importCandidates
  );
  const repoUrlToLocation = /* @__PURE__ */ new Map();
  const importStatusPromises = [];
  for (const loc of importsReachableFromGHIntegrations) {
    const repoUrl = repoUrlFromLocation(loc);
    if (!repoUrl) {
      continue;
    }
    repoUrlToLocation.set(repoUrl, loc);
    importStatusPromises.push(
      findImportStatusByRepo(
        deps,
        repoUrl,
        defaultBranchByRepoUrl.get(repoUrl),
        false
      )
    );
  }
  const result = await Promise.all(importStatusPromises);
  const imports = result.filter((res) => res.responseBody).map((res) => res.responseBody).map((res) => {
    const key = res?.repository?.url;
    const location = key ? repoUrlToLocation.get(key) : undefined;
    return {
      ...res,
      source: location ? allLocations.get(location)?.source : undefined
    };
  });
  sortImports(imports, sortColumn, sortOrder);
  const paginated = pagination.paginateArray(imports, pageNumber, pageSize);
  if (apiVersion === "v1") {
    return {
      statusCode: 200,
      responseBody: paginated.result
    };
  }
  return {
    statusCode: 200,
    responseBody: {
      imports: paginated.result,
      totalCount: paginated.totalCount,
      page: pageNumber,
      size: pageSize
    }
  };
}
async function resolveReposDefaultBranches(logger, githubApiService, allLocations, catalogFilename) {
  const defaultBranchByRepoUrlPromises = [];
  for (const loc of allLocations) {
    if (!loc.endsWith(catalogFilename)) {
      logger.debug(
        `Ignored location ${loc} because it does not point to a file named ${catalogFilename}`
      );
      continue;
    }
    const repoUrl = repoUrlFromLocation(loc);
    if (!repoUrl) {
      continue;
    }
    defaultBranchByRepoUrlPromises.push(
      githubApiService.getRepositoryFromIntegrations(repoUrl).then((resp) => {
        return { repoUrl, defaultBranch: resp?.repository?.default_branch };
      }).catch((err) => {
        loggingUtils.logErrorIfNeeded(
          logger,
          `Ignored repo ${repoUrl} due to an error while fetching details from GitHub`,
          err
        );
        return {
          repoUrl,
          defaultBranch: undefined
        };
      })
    );
  }
  const defaultBranchesResponses = await Promise.all(
    defaultBranchByRepoUrlPromises
  );
  return new Map(
    defaultBranchesResponses.flat().filter((r) => r.defaultBranch).map((r) => [r.repoUrl, r.defaultBranch])
  );
}
function repoUrlFromLocation(loc) {
  const split = loc.split("/blob/");
  if (split.length < 2) {
    return undefined;
  }
  return split[0];
}
function findImportCandidates(allLocations, defaultBranchByRepoUrl, catalogFilename) {
  const filteredLocations = [];
  for (const loc of allLocations) {
    const repoUrl = repoUrlFromLocation(loc);
    if (!repoUrl) {
      continue;
    }
    const defaultBranch = defaultBranchByRepoUrl.get(repoUrl);
    if (!defaultBranch) {
      continue;
    }
    if (loc !== `${repoUrl}/blob/${defaultBranch}/${catalogFilename}`) {
      continue;
    }
    filteredLocations.push(loc);
  }
  return filteredLocations;
}
async function createPR(githubApiService, logger, req, gitUrl, catalogInfoGenerator, config) {
  const appTitle = config.getOptionalString("app.title") ?? "Red Hat Developer Hub";
  const appBaseUrl = config.getString("app.baseUrl");
  const catalogFileName = catalogUtils.getCatalogFilename(config);
  return await githubApiService.submitPrToRepo(logger, {
    repoUrl: req.repository.url,
    gitUrl,
    defaultBranch: req.repository.defaultBranch,
    catalogInfoContent: req.catalogInfoContent ?? await catalogInfoGenerator.generateDefaultCatalogInfoContent(
      req.repository.url
    ),
    prTitle: req.github?.pullRequest?.title ?? `Add ${catalogFileName}`,
    prBody: req.github?.pullRequest?.body ?? `
This pull request adds a **Backstage entity metadata file** to this repository so that the component can be added to a Backstage application.

After this pull request is merged, the component will become available in the [${appTitle} software catalog](${appBaseUrl}).

For more information, read an [overview of the Backstage software catalog](https://backstage.io/docs/features/software-catalog/).
`
  });
}
async function handleAddedReposFromCreateImportJobs(deps, importRequests) {
  const result = [];
  for (const req of importRequests) {
    const repoCatalogUrl = catalogUtils.getCatalogUrl(
      deps.config,
      req.repository.url,
      req.repository.defaultBranch
    );
    const hasLocation = await deps.catalogHttpClient.verifyLocationExistence(repoCatalogUrl);
    if (!hasLocation) {
      continue;
    }
    const hasCatalogInfoFileInRepo = await deps.githubApiService.hasFileInRepo({
      repoUrl: req.repository.url,
      defaultBranch: req.repository.defaultBranch,
      fileName: catalogUtils.getCatalogFilename(deps.config)
    });
    if (!hasCatalogInfoFileInRepo) {
      continue;
    }
    const ghRepo = await deps.githubApiService.getRepositoryFromIntegrations(
      req.repository.url
    );
    await deps.catalogHttpClient.refreshLocationByRepoUrl(
      req.repository.url,
      req.repository.defaultBranch
    );
    const gitUrl = gitUrlParse__default.default(req.repository.url);
    result.push({
      status: "ADDED",
      lastUpdate: ghRepo?.repository?.updated_at ?? undefined,
      repository: {
        url: req.repository.url,
        name: gitUrl.name,
        organization: gitUrl.organization
      }
    });
  }
  return result;
}
async function handlePrCreationRequest(deps, req, gitUrl) {
  const repoCatalogUrl = catalogUtils.getCatalogUrl(
    deps.config,
    req.repository.url,
    req.repository.defaultBranch
  );
  const prToRepo = await createPR(
    deps.githubApiService,
    deps.logger,
    req,
    gitUrl,
    deps.catalogInfoGenerator,
    deps.config
  );
  if (prToRepo.errors && prToRepo.errors.length > 0) {
    return {
      errors: prToRepo.errors,
      status: "PR_ERROR",
      repository: req.repository
    };
  }
  if (prToRepo.prUrl) {
    deps.logger.debug(`Created new PR from request: ${prToRepo.prUrl}`);
  }
  await deps.catalogHttpClient.possiblyCreateLocation(repoCatalogUrl);
  if (prToRepo.hasChanges === false) {
    deps.logger.debug(
      `No bulk import PR created on ${req.repository.url} since its default branch (${req.repository.defaultBranch}) already contains a catalog-info file`
    );
    await deps.catalogHttpClient.refreshLocationByRepoUrl(
      req.repository.url,
      req.repository.defaultBranch
    );
    return {
      status: "ADDED",
      lastUpdate: prToRepo.lastUpdate,
      repository: {
        url: req.repository.url,
        name: gitUrl.name,
        organization: gitUrl.organization
      }
    };
  }
  return {
    errors: prToRepo.errors,
    status: "WAIT_PR_APPROVAL",
    lastUpdate: prToRepo.lastUpdate,
    repository: {
      url: req.repository.url,
      name: gitUrl.name,
      organization: gitUrl.organization
    },
    github: {
      pullRequest: {
        url: prToRepo.prUrl,
        number: prToRepo.prNumber
      }
    }
  };
}
async function createImportJobs(deps, reqParams) {
  const dryRun = reqParams.dryRun ?? false;
  const importRequests = reqParams.importRequests;
  deps.logger.debug(
    `Handling request to import ${importRequests?.length} repo(s) (dryRun=${dryRun})..`
  );
  if (importRequests.length === 0) {
    deps.logger.debug("Missing import requests from request body");
    return {
      statusCode: 400,
      responseBody: []
    };
  }
  if (dryRun) {
    return {
      statusCode: 202,
      responseBody: await dryRunCreateImportJobs(deps, importRequests)
    };
  }
  const result = [];
  const addedRepos = await handleAddedReposFromCreateImportJobs(
    deps,
    importRequests
  );
  result.push(...addedRepos);
  const addedReposMap = new Map(
    addedRepos.map((res) => [res.repository?.url, res])
  );
  const remainingRequests = importRequests.filter(
    (req) => !addedReposMap.has(req.repository.url)
  );
  for (const req of remainingRequests) {
    const gitUrl = gitUrlParse__default.default(req.repository.url);
    try {
      result.push(await handlePrCreationRequest(deps, req, gitUrl));
    } catch (error) {
      result.push({
        errors: [error.message],
        status: "PR_ERROR",
        repository: {
          url: req.repository.url,
          name: gitUrl.name,
          organization: gitUrl.organization
        }
      });
    }
  }
  sortImports(result);
  return {
    statusCode: 202,
    responseBody: result
  };
}
async function dryRunCreateImportJobs(deps, importRequests) {
  const result = [];
  for (const req of importRequests) {
    const gitUrl = gitUrlParse__default.default(req.repository.url);
    const dryRunChecks = await performDryRunChecks(deps, req);
    if (dryRunChecks.errors?.length > 0) {
      deps.logger.warn(
        `Errors while performing dry-run checks: ${dryRunChecks.errors}`
      );
    }
    result.push({
      errors: dryRunChecks.dryRunStatuses,
      catalogEntityName: req.catalogEntityName,
      repository: {
        url: req.repository.url,
        name: gitUrl.name,
        organization: gitUrl.organization
      }
    });
  }
  return result;
}
async function performDryRunChecks(deps, req) {
  const checkCatalog = async (catalogEntityName) => {
    const hasEntity = await deps.catalogHttpClient.hasEntityInCatalog(catalogEntityName);
    if (hasEntity) {
      return { dryRunStatuses: ["CATALOG_ENTITY_CONFLICT"] };
    }
    return {};
  };
  const checkEmptyRepo = async () => {
    const empty = await deps.githubApiService.isRepoEmpty({
      repoUrl: req.repository.url
    });
    if (empty) {
      return {
        dryRunStatuses: ["REPO_EMPTY"]
      };
    }
    return {};
  };
  const checkCatalogInfoPresenceInRepo = async () => {
    const exists = await deps.githubApiService.hasFileInRepo({
      repoUrl: req.repository.url,
      defaultBranch: req.repository.defaultBranch,
      fileName: catalogUtils.getCatalogFilename(deps.config)
    });
    if (exists) {
      return {
        dryRunStatuses: ["CATALOG_INFO_FILE_EXISTS_IN_REPO"]
      };
    }
    return {};
  };
  const checkCodeOwnersFileInRepo = async () => {
    const exists = await deps.githubApiService.hasFileInRepo({
      repoUrl: req.repository.url,
      defaultBranch: req.repository.defaultBranch,
      fileName: ".github/CODEOWNERS"
    });
    if (!exists) {
      return {
        dryRunStatuses: ["CODEOWNERS_FILE_NOT_FOUND_IN_REPO"]
      };
    }
    return {};
  };
  const dryRunStatuses = [];
  const errors = [];
  const allChecksFn = [checkEmptyRepo(), checkCatalogInfoPresenceInRepo()];
  if (req.catalogEntityName?.trim()) {
    allChecksFn.push(checkCatalog(req.catalogEntityName));
  }
  if (req.codeOwnersFileAsEntityOwner) {
    allChecksFn.push(checkCodeOwnersFileInRepo());
  }
  const allChecks = await Promise.all(allChecksFn);
  allChecks.flat().forEach((res) => {
    if (res.dryRunStatuses) {
      dryRunStatuses.push(...res.dryRunStatuses);
    }
    if (res.errors) {
      errors.push(...res.errors);
    }
  });
  dryRunStatuses.sort((a, b) => a.localeCompare(b));
  return {
    dryRunStatuses,
    errors
  };
}
async function findImportStatusByRepo(deps, repoUrl, defaultBranch, includeCatalogInfoContent) {
  deps.logger.debug(`Getting bulk import job status for ${repoUrl}..`);
  const gitUrl = gitUrlParse__default.default(repoUrl);
  const errors = [];
  const result = {
    id: repoUrl,
    repository: {
      url: repoUrl,
      name: gitUrl.name,
      organization: gitUrl.organization,
      id: `${gitUrl.organization}/${gitUrl.name}`,
      defaultBranch
    },
    approvalTool: "GIT",
    status: null
  };
  try {
    const openImportPr = await deps.githubApiService.findImportOpenPr(
      deps.logger,
      {
        repoUrl,
        includeCatalogInfoContent
      }
    );
    if (!openImportPr.prUrl) {
      const catalogLocations = (await deps.catalogHttpClient.listCatalogUrlLocations()).uniqueCatalogUrlLocations.keys();
      const catalogUrl = catalogUtils.getCatalogUrl(deps.config, repoUrl, defaultBranch);
      let exists = false;
      for (const loc of catalogLocations) {
        if (loc === catalogUrl) {
          exists = true;
          break;
        }
      }
      if (exists && await deps.githubApiService.hasFileInRepo({
        repoUrl,
        defaultBranch,
        fileName: catalogUtils.getCatalogFilename(deps.config)
      })) {
        result.status = "ADDED";
        await deps.catalogHttpClient.refreshLocationByRepoUrl(
          repoUrl,
          defaultBranch
        );
      }
      const ghRepo = await deps.githubApiService.getRepositoryFromIntegrations(repoUrl);
      result.lastUpdate = ghRepo.repository?.updated_at ?? void 0;
      return {
        statusCode: 200,
        responseBody: result
      };
    }
    result.status = "WAIT_PR_APPROVAL";
    result.github = {
      pullRequest: {
        number: openImportPr.prNum,
        url: openImportPr.prUrl,
        title: openImportPr.prTitle,
        body: openImportPr.prBody,
        catalogInfoContent: openImportPr.prCatalogInfoContent
      }
    };
    result.lastUpdate = openImportPr.lastUpdate;
  } catch (error) {
    errors.push(error.message);
    result.errors = errors;
    if (error.message?.includes("Not Found")) {
      return {
        statusCode: 404,
        responseBody: result
      };
    }
    result.status = "PR_ERROR";
  }
  return {
    statusCode: 200,
    responseBody: result
  };
}
async function deleteImportByRepo(deps, repoUrl, defaultBranch) {
  deps.logger.debug(`Deleting bulk import job status for ${repoUrl}..`);
  const openImportPr = await deps.githubApiService.findImportOpenPr(
    deps.logger,
    {
      repoUrl
    }
  );
  const gitUrl = gitUrlParse__default.default(repoUrl);
  if (openImportPr.prUrl) {
    const appTitle = deps.config.getOptionalString("app.title") ?? "Red Hat Developer Hub";
    const appBaseUrl = deps.config.getString("app.baseUrl");
    await deps.githubApiService.closeImportPR(deps.logger, {
      repoUrl,
      gitUrl,
      comment: `Closing PR upon request for bulk import deletion. This request was created from [${appTitle}](${appBaseUrl}).`
    });
  }
  await deps.githubApiService.deleteImportBranch({
    repoUrl,
    gitUrl
  });
  const catalogUrl = catalogUtils.getCatalogUrl(deps.config, repoUrl, defaultBranch);
  const findLocationFrom = (list) => {
    for (const loc of list) {
      if (loc.target === catalogUrl) {
        return loc.id;
      }
    }
    return undefined;
  };
  const locationId = findLocationFrom(
    (await deps.catalogHttpClient.listCatalogUrlLocationsByIdFromLocationsEndpoint()).locations
  );
  if (locationId) {
    await deps.catalogHttpClient.deleteCatalogLocationById(locationId);
  }
  return {
    statusCode: 204,
    responseBody: undefined
  };
}

exports.createImportJobs = createImportJobs;
exports.deleteImportByRepo = deleteImportByRepo;
exports.findAllImports = findAllImports;
exports.findImportStatusByRepo = findImportStatusByRepo;
//# sourceMappingURL=bulkImports.cjs.js.map
