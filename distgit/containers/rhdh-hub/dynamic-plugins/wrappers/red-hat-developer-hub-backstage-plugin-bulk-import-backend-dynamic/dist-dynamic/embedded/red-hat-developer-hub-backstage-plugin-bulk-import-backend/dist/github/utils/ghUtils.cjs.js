'use strict';

var rest = require('@octokit/rest');
var types = require('../types.cjs.js');
var utils = require('./utils.cjs.js');

const GITHUB_DEFAULT_API_ENDPOINT = "https://api.github.com";
const RESPONSE_CACHE_TTL_MILLIS = 60 * 60 * 1e3;
function buildOcto(deps, input, apiBaseUrl = GITHUB_DEFAULT_API_ENDPOINT) {
  if ("error" in input.credential) {
    if (input.credential.error?.name !== "NotFoundError") {
      deps.logger.error(
        `Obtaining the Access Token Github App with appId: ${input.credential.appId} failed with ${input.credential.error}`
      );
      const credentialError = utils.createCredentialError(input.credential);
      if (credentialError) {
        deps.logger.debug(`${input.credential.appId}: ${credentialError}`);
        if (input.errors) {
          input.errors.set(input.credential.appId, credentialError);
        }
      }
    }
    return undefined;
  }
  if (types.isGithubAppCredential(input.credential) && input.owner && input.credential.accountLogin !== input.owner) {
    return undefined;
  }
  const octokit = new rest.Octokit({
    baseUrl: apiBaseUrl,
    auth: input.credential.token
  });
  registerHooks(deps, octokit);
  return octokit;
}
function registerHooks(deps, octokit) {
  const extractCacheKey = (options) => `${options.method}--${tryReplacingPlaceholdersInUrl(options)}`;
  octokit.hook.before("request", async (options) => {
    if (!options.headers) {
      options.headers = {
        accept: "application/json",
        "user-agent": "rhdh/bulk-import"
      };
    }
    const cacheKey = extractCacheKey(options);
    const existingEtag = await deps.cache.get(cacheKey)?.then((val) => val?.etag);
    if (existingEtag) {
      options.headers["If-None-Match"] = existingEtag;
    } else {
      deps.logger.debug(`cache miss for key "${cacheKey}"`);
    }
  });
  octokit.hook.after("request", async (response, options) => {
    deps.logger.debug(
      `[GH API] ${options.method} ${tryReplacingPlaceholdersInUrl(options)}: ${response.status}`
    );
    const cacheKey = extractCacheKey(options);
    await deps.cache.set(
      cacheKey,
      {
        etag: response.headers.etag,
        ...response
      },
      { ttl: RESPONSE_CACHE_TTL_MILLIS }
    );
  });
  octokit.hook.error("request", async (error, options) => {
    deps.logger.debug(
      `[GH API] ${options.method} ${tryReplacingPlaceholdersInUrl(options)}: ${error.status}`
    );
    if (error.status !== 304) {
      throw error;
    }
    return await deps.cache.get(extractCacheKey(options));
  });
}
function tryReplacingPlaceholdersInUrl(options) {
  let result = "";
  let startIdx = 0;
  const url = options.url;
  if (!url) {
    return undefined;
  }
  while (startIdx < url.length) {
    const openBraceIdx = url.indexOf("{", startIdx);
    if (openBraceIdx === -1) {
      result += url.slice(startIdx);
      break;
    }
    result += url.slice(startIdx, openBraceIdx);
    const closeBraceIdx = url.indexOf("}", openBraceIdx);
    if (closeBraceIdx === -1) {
      result += url.slice(openBraceIdx);
      break;
    }
    const key = url.slice(openBraceIdx + 1, closeBraceIdx);
    result += options[key] ?? `{${key}}`;
    startIdx = closeBraceIdx + 1;
  }
  return result;
}

exports.buildOcto = buildOcto;
//# sourceMappingURL=ghUtils.cjs.js.map
