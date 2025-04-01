'use strict';

var catalogUtils = require('../../../catalog/catalogUtils.cjs.js');

async function getImportStatusFromLocations(deps, repoUrl, catalogUrlLocations, defaultBranch) {
  return getImportStatusWithCheckerFn(
    deps,
    repoUrl,
    async (catalogUrl) => {
      for (const loc of catalogUrlLocations) {
        if (catalogUrl === loc) {
          return true;
        }
      }
      return false;
    },
    defaultBranch
  );
}
async function getImportStatusWithCheckerFn(deps, repoUrl, catalogExistenceCheckFn, defaultBranch) {
  const openImportPr = await deps.githubApiService.findImportOpenPr(
    deps.logger,
    {
      repoUrl
    }
  );
  if (!openImportPr.prUrl) {
    const existsInCatalog = await catalogExistenceCheckFn(
      catalogUtils.getCatalogUrl(deps.config, repoUrl, defaultBranch)
    );
    const existsInRepo = await deps.githubApiService.hasFileInRepo({
      repoUrl,
      defaultBranch,
      fileName: catalogUtils.getCatalogFilename(deps.config)
    });
    if (existsInCatalog && existsInRepo) {
      await deps.catalogHttpClient.refreshLocationByRepoUrl(
        repoUrl,
        defaultBranch
      );
      return { status: "ADDED" };
    }
    return null;
  }
  return { status: "WAIT_PR_APPROVAL", lastUpdate: openImportPr.lastUpdate };
}

exports.getImportStatusFromLocations = getImportStatusFromLocations;
//# sourceMappingURL=importStatus.cjs.js.map
