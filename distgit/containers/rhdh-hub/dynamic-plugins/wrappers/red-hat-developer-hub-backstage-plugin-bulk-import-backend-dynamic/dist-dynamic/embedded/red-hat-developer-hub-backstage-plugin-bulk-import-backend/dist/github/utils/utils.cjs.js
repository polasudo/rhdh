'use strict';

var gitUrlParse = require('git-url-parse');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var loggingUtils = require('../../helpers/loggingUtils.cjs.js');
var types = require('../types.cjs.js');
var ghUtils = require('./ghUtils.cjs.js');
var repoUtils = require('./repoUtils.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

function createCredentialError(credential, err) {
  if (err) {
    if (types.isGithubAppCredential(credential)) {
      return {
        appId: credential.appId,
        type: "app",
        error: {
          name: err.name,
          message: err.message
        }
      };
    }
    return {
      type: "token",
      error: {
        name: err.name,
        message: err.message
      }
    };
  }
  if ("error" in credential) {
    return {
      appId: credential.appId,
      type: "app",
      error: {
        name: credential.error.name,
        message: credential.error.message
      }
    };
  }
  return undefined;
}
function verifyAndGetIntegrations(deps, integrations) {
  const ghConfigs = integrations.github.list().map((ghInt) => ghInt.config);
  if (ghConfigs.length === 0) {
    deps.logger.debug(
      "No GitHub Integration in config => returning an empty list of repositories."
    );
    throw new Error(
      "Looks like there is no GitHub Integration in config. Please add a configuration entry under 'integrations.github"
    );
  }
  return ghConfigs;
}
async function getCredentialsFromIntegrations(githubCredentialsProvider, ghConfigs) {
  const credentialsByConfig = /* @__PURE__ */ new Map();
  for (const ghConfig of ghConfigs) {
    const creds = await getCredentialsForConfig(
      githubCredentialsProvider,
      ghConfig
    );
    credentialsByConfig.set(ghConfig, creds);
  }
  return credentialsByConfig;
}
async function getCredentialsForConfig(githubCredentialsProvider, ghConfig) {
  return await githubCredentialsProvider.getAllCredentials({
    host: ghConfig.host
  });
}
function handleError(deps, desc, credential, errors, err) {
  loggingUtils.logErrorIfNeeded(deps.logger, `${desc} failed`, err);
  const credentialError = createCredentialError(credential, err);
  if (credentialError) {
    errors.set(-1, credentialError);
  }
}
async function computeTotalCountFromGitHubToken(deps, lastPageDataLengthProviderFn, ghApiName, pageSize, linkHeader) {
  if (!linkHeader) {
    deps.logger.debug(
      `No link header found in response from ${ghApiName} GH endpoint => returning current page size`
    );
    return pageSize;
  }
  const lastPageLink = linkHeader.split(",").find((s) => s.includes('rel="last"'));
  if (!lastPageLink) {
    deps.logger.debug(
      `No rel='last' link found in response headers from ${ghApiName} GH endpoint => returning current page size`
    );
    return pageSize;
  }
  const match = lastPageLink.match(/page=(\d+)/);
  if (!match || match.length < 2) {
    deps.logger.debug(
      `Unable to extract page number from rel='last' link found in response headers from ${ghApiName} GH endpoint => returning current page size`
    );
    return pageSize;
  }
  const lastPageNumber = parseInt(match[1], 10);
  const lastPageDataLength = await lastPageDataLengthProviderFn(lastPageNumber);
  return pageSize ? (lastPageNumber - 1) * pageSize + lastPageDataLength : undefined;
}
async function executeFunctionOnFirstSuccessfulIntegration(deps, integrations, params) {
  const validatedRepo = await repoUtils.validateAndBuildRepoData(
    deps.githubCredentialsProvider,
    integrations,
    deps.config,
    params
  );
  for (const credential of validatedRepo.credentials) {
    const octo = ghUtils.buildOcto(
      {
        logger: deps.logger,
        cache: deps.cache
      },
      { credential, owner: validatedRepo.owner },
      validatedRepo.ghConfig.apiBaseUrl
    );
    if (!octo) {
      continue;
    }
    const res = await params.fn(validatedRepo, octo);
    if (!res.successful) {
      continue;
    }
    return res.result;
  }
  return undefined;
}
async function fetchFromAllIntegrations(deps, integrations, params) {
  const ghConfigs = verifyAndGetIntegrations(deps, integrations);
  const credentialsByConfig = await getCredentialsFromIntegrations(
    deps.githubCredentialsProvider,
    ghConfigs
  );
  const errors = /* @__PURE__ */ new Map();
  const data = [];
  const dataErrs = [];
  let stopFetchingData = false;
  for (const [ghConfig, credentials] of credentialsByConfig) {
    if (stopFetchingData) {
      break;
    }
    deps.logger.debug(
      `Got ${credentials.length} credential(s) for ${ghConfig.host}`
    );
    for (const credential of credentials) {
      const octokit = ghUtils.buildOcto(
        deps,
        { credential, errors },
        ghConfig.apiBaseUrl
      );
      if (!octokit) {
        continue;
      }
      const res = await params.dataFetcher(octokit, credential, ghConfig);
      res.errors?.forEach((err) => dataErrs.push(err));
      if (res.result) {
        data.push(res.result);
      }
      stopFetchingData = res.stopFetchingData;
    }
  }
  const aggregatedErrors = /* @__PURE__ */ new Map();
  errors.forEach((err, num) => aggregatedErrors.set(num, err));
  dataErrs.forEach((err, idx) => aggregatedErrors.set(idx, err));
  return { data, errors: aggregatedErrors };
}
function computeTotalCount(data, countList, pageSize) {
  let totalCount = countList.reduce(
    (accumulator, currentValue) => accumulator + currentValue,
    0
  );
  if (totalCount < pageSize) {
    totalCount = data.length;
  }
  return totalCount;
}
function extractLocationOwnerMap(locationUrls) {
  const locationGitOwnerMap = /* @__PURE__ */ new Map();
  for (const locationUrl of locationUrls) {
    const split = locationUrl.split("/blob/");
    if (split.length < 2) {
      continue;
    }
    locationGitOwnerMap.set(locationUrl, gitUrlParse__default.default(split[0]).owner);
  }
  return locationGitOwnerMap;
}

exports.computeTotalCount = computeTotalCount;
exports.computeTotalCountFromGitHubToken = computeTotalCountFromGitHubToken;
exports.createCredentialError = createCredentialError;
exports.executeFunctionOnFirstSuccessfulIntegration = executeFunctionOnFirstSuccessfulIntegration;
exports.extractLocationOwnerMap = extractLocationOwnerMap;
exports.fetchFromAllIntegrations = fetchFromAllIntegrations;
exports.getCredentialsForConfig = getCredentialsForConfig;
exports.getCredentialsFromIntegrations = getCredentialsFromIntegrations;
exports.handleError = handleError;
exports.verifyAndGetIntegrations = verifyAndGetIntegrations;
//# sourceMappingURL=utils.cjs.js.map
