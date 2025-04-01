'use strict';

var gitUrlParse = require('git-url-parse');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

function getCatalogFilename(config) {
  return config.getOptionalString("catalog.import.entityFilename") ?? "catalog-info.yaml";
}
function getBranchName(config) {
  return config.getOptionalString("catalog.import.pullRequestBranchName") ?? "backstage-integration";
}
function getCatalogUrl(config, repoUrl, defaultBranch = "main") {
  return `${repoUrl}/blob/${defaultBranch}/${getCatalogFilename(config)}`;
}
function filterLocations(res, search) {
  return search ? res.filter((loc) => {
    const split = loc.target.split("/blob/");
    if (split.length < 2) {
      return false;
    }
    const repoUrl = split[0];
    const gitUrl = gitUrlParse__default.default(repoUrl);
    return gitUrl.name.toLowerCase().includes(search.toLowerCase());
  }) : res;
}

exports.filterLocations = filterLocations;
exports.getBranchName = getBranchName;
exports.getCatalogFilename = getCatalogFilename;
exports.getCatalogUrl = getCatalogUrl;
//# sourceMappingURL=catalogUtils.cjs.js.map
