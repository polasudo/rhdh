'use strict';

require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
var loggingUtils = require('../../helpers/loggingUtils.cjs.js');
var pagination = require('../../helpers/pagination.cjs.js');
var handlers = require('../../service/handlers/handlers.cjs.js');
var utils = require('./utils.cjs.js');

async function getAllAppOrgs(githubCredentialsProvider, ghConfig, credentialAccountLogin) {
  const result = /* @__PURE__ */ new Map();
  const resp = await githubCredentialsProvider.getAllAppInstallations(ghConfig);
  for (const installation of resp ?? []) {
    if (!(installation.account && installation.target_type?.toLowerCase() === "organization")) {
      continue;
    }
    const acc = installation.account;
    if (credentialAccountLogin !== acc.login) {
      continue;
    }
    result.set(acc.url, {
      id: acc.id,
      description: acc.description ?? undefined,
      name: acc.login,
      url: acc.html_url,
      html_url: acc.html_url,
      repos_url: acc.repos_url,
      events_url: acc.events_url
    });
  }
  return result;
}
async function addGithubAppOrgs(deps, octokit, ghConfig, params) {
  const credentialAccountLogin = params.credentialAccountLogin;
  const search = params.search;
  const orgs = params.orgs;
  const errors = params.errors;
  let totalCount = 0;
  try {
    const resp = await getAllAppOrgs(
      deps.githubCredentialsProvider,
      ghConfig,
      credentialAccountLogin
    );
    for (const [orgUrl, ghOrg] of resp) {
      if (search && !ghOrg.name.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }
      const orgData = await octokit.request(
        orgUrl.replace("/users/", "/orgs/")
      );
      orgs.set(ghOrg.name, {
        ...ghOrg,
        public_repos: orgData?.data?.public_repos,
        total_private_repos: orgData?.data?.total_private_repos,
        owned_private_repos: orgData?.data?.owned_private_repos
      });
      totalCount++;
    }
  } catch (err) {
    loggingUtils.logErrorIfNeeded(
      deps.logger,
      `Fetching organizations with access token for github app`,
      err
    );
    errors.set(-1, err.message);
  }
  return { totalCount };
}
async function addGithubTokenOrgs(deps, octokit, credential, params) {
  const search = params.search;
  const orgs = params.orgs;
  const errors = params.errors;
  const pageNumber = params.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = params.pageSize ?? handlers.DefaultPageSize;
  let totalCount;
  try {
    let matchingOrgs;
    if (search) {
      const resp = await octokit.paginate(
        octokit.rest.orgs.listForAuthenticatedUser,
        {
          sort: "full_name",
          direction: "asc"
        }
      );
      const allMatchingOrgs = resp?.filter(
        (org) => org.login.toLowerCase().includes(search.toLowerCase())
      ) ?? [];
      const matchingOrgsPage = pagination.paginateArray(
        allMatchingOrgs,
        pageNumber,
        pageSize
      );
      matchingOrgs = matchingOrgsPage.result;
      totalCount = matchingOrgsPage.totalCount;
    } else {
      const resp = await octokit.rest.orgs.listForAuthenticatedUser({
        page: pageNumber,
        per_page: pageSize,
        sort: "full_name",
        direction: "asc"
      });
      matchingOrgs = resp?.data ?? [];
      totalCount = await utils.computeTotalCountFromGitHubToken(
        deps,
        async (lastPageNumber) => octokit.orgs.listForAuthenticatedUser({
          page: lastPageNumber,
          per_page: 100
        }).then((lastPageResp) => lastPageResp.data.length),
        "orgs.listForAuthenticatedUser",
        resp?.data?.length,
        resp?.headers?.link
      );
    }
    for (const org of matchingOrgs) {
      const orgData = await octokit.request(org.url);
      const ghOrg = {
        id: org.id,
        name: org.login,
        description: org.description ?? void 0,
        url: orgData?.data?.html_url ?? org.url,
        repos_url: org.repos_url,
        hooks_url: org.hooks_url,
        issues_url: org.issues_url,
        members_url: org.members_url,
        public_members_url: org.public_members_url,
        avatar_url: org.avatar_url,
        public_repos: orgData?.data?.public_repos,
        total_private_repos: orgData?.data?.total_private_repos,
        owned_private_repos: orgData?.data?.owned_private_repos
      };
      orgs.set(org.login, ghOrg);
    }
  } catch (err) {
    utils.handleError(
      { logger: deps.logger },
      "Fetching orgs with token from token",
      credential,
      errors,
      err
    );
  }
  return { totalCount };
}

exports.addGithubAppOrgs = addGithubAppOrgs;
exports.addGithubTokenOrgs = addGithubTokenOrgs;
exports.getAllAppOrgs = getAllAppOrgs;
//# sourceMappingURL=orgUtils.cjs.js.map
