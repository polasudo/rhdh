'use strict';

var gitUrlParse = require('git-url-parse');
var catalogUtils = require('../../catalog/catalogUtils.cjs.js');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
require('just-kebab-case');
var loggingUtils = require('../../helpers/loggingUtils.cjs.js');
var handlers = require('../../service/handlers/handlers.cjs.js');
var orgUtils = require('./orgUtils.cjs.js');
var utils = require('./utils.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

async function validateAndBuildRepoData(githubCredentialsProvider, integrations, config, input) {
  const ghConfig = integrations.github.byUrl(input.repoUrl)?.config;
  if (!ghConfig) {
    throw new Error(`Could not find GH integration from ${input.repoUrl}`);
  }
  const gitUrl = gitUrlParse__default.default(input.repoUrl);
  const owner = gitUrl.organization;
  const repo = gitUrl.name;
  const credentials = await githubCredentialsProvider.getAllCredentials({
    host: ghConfig.host
  });
  if (credentials.length === 0) {
    throw new Error(`No credentials for GH integration`);
  }
  const branchName = catalogUtils.getBranchName(config);
  return { ghConfig, owner, repo, credentials, branchName };
}
async function searchRepos(octokit, ghSearchQuery, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
  const repoSearchResp = await octokit.rest.search.repos({
    q: ghSearchQuery,
    order: "asc",
    page: pageNumber,
    per_page: pageSize
  });
  return {
    totalCount: repoSearchResp?.data?.total_count,
    repositories: repoSearchResp?.data?.items?.map((repo) => {
      return {
        name: repo.name,
        full_name: repo.full_name,
        url: repo.url,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at
      };
    }) ?? []
  };
}
async function addGithubAppRepositories(deps, octokit, credential, ghConfig, repositories, errors, reqParams) {
  const search = reqParams?.search;
  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
  let totalCount;
  try {
    if (search) {
      const allOrgsMap = await orgUtils.getAllAppOrgs(
        deps.githubCredentialsProvider,
        ghConfig,
        credential.accountLogin
      );
      const orgSearch = [];
      for (const [_orgUrl, ghOrg] of allOrgsMap) {
        orgSearch.push(`org:${ghOrg.name}`);
      }
      const query = `${search} in:name ${orgSearch.join(" ")}`;
      const searchResp = await searchRepos(
        octokit,
        query,
        pageNumber,
        pageSize
      );
      totalCount = searchResp.totalCount;
      searchResp.repositories.forEach(
        (repo) => repositories.set(repo.full_name, repo)
      );
    } else {
      const resp = await octokit.apps.listReposAccessibleToInstallation({
        page: pageNumber,
        per_page: pageSize
      });
      const repos = resp?.data?.repositories ?? resp?.data;
      repos?.forEach((repo) => {
        repositories.set(repo.full_name, {
          name: repo.name,
          full_name: repo.full_name,
          url: repo.url,
          html_url: repo.html_url,
          default_branch: repo.default_branch,
          updated_at: repo.updated_at
        });
      });
      totalCount = resp?.data?.total_count;
    }
  } catch (err) {
    loggingUtils.logErrorIfNeeded(
      deps.logger,
      `Fetching repositories with access token for github app ${credential.appId}`,
      err
    );
    const credentialError = utils.createCredentialError(credential, err);
    if (credentialError) {
      errors.set(credential.appId, credentialError);
    }
  }
  return { totalCount };
}
async function addGithubTokenRepositories(deps, octokit, credential, repositories, errors, reqParams) {
  const search = reqParams?.search;
  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
  let totalCount;
  try {
    if (search) {
      const username = (await octokit.rest.users.getAuthenticated())?.data?.login;
      let query = `${search} in:name user:${username}`;
      const allOrgsResp = await octokit.paginate(
        octokit.rest.orgs.listForAuthenticatedUser,
        {
          sort: "full_name",
          direction: "asc"
        }
      );
      const orgSearch = [];
      allOrgsResp?.forEach((org) => orgSearch.push(`org:${org.login}`));
      if (orgSearch.length > 0) {
        query += ` ${orgSearch.join(" ")}`;
      }
      const searchResp = await searchRepos(
        octokit,
        query,
        pageNumber,
        pageSize
      );
      totalCount = searchResp.totalCount;
      searchResp.repositories.forEach(
        (repo) => repositories.set(repo.full_name, repo)
      );
    } else {
      const resp = await octokit.rest.repos.listForAuthenticatedUser({
        page: pageNumber,
        per_page: pageSize,
        sort: "full_name",
        direction: "asc"
      });
      resp?.data?.forEach((repo) => {
        repositories.set(repo.full_name, {
          name: repo.name,
          full_name: repo.full_name,
          url: repo.url,
          html_url: repo.html_url,
          default_branch: repo.default_branch,
          updated_at: repo.updated_at
        });
      });
      totalCount = await utils.computeTotalCountFromGitHubToken(
        deps,
        async (lastPageNumber) => octokit.repos.listForAuthenticatedUser({
          page: lastPageNumber,
          per_page: 100
        }).then((lastPageResp) => lastPageResp.data.length),
        "repos.listForAuthenticatedUser",
        resp?.data?.length,
        resp?.headers?.link
      );
    }
  } catch (err) {
    utils.handleError(
      deps,
      "Fetching repositories with token from token",
      credential,
      errors,
      err
    );
  }
  return { totalCount };
}
async function addGithubTokenOrgRepositories(deps, octokit, credential, org, repositories, errors, reqParams) {
  const search = reqParams?.search;
  const pageNumber = reqParams?.pageNumber ?? handlers.DefaultPageNumber;
  const pageSize = reqParams?.pageSize ?? handlers.DefaultPageSize;
  let totalCount;
  try {
    if (search) {
      const query = `${search} in:name org:${org}`;
      const searchResp = await searchRepos(
        octokit,
        query,
        pageNumber,
        pageSize
      );
      totalCount = searchResp.totalCount;
      searchResp.repositories.forEach(
        (repo) => repositories.set(repo.full_name, repo)
      );
    } else {
      const resp = await octokit.rest.repos.listForOrg({
        org,
        page: pageNumber,
        per_page: pageSize,
        sort: "full_name",
        direction: "asc"
      });
      resp?.data?.forEach((repo) => {
        const githubRepo = {
          name: repo.name,
          full_name: repo.full_name,
          url: repo.url,
          html_url: repo.html_url,
          default_branch: repo.default_branch ?? "main",
          updated_at: repo.updated_at
        };
        repositories.set(githubRepo.full_name, githubRepo);
      });
      totalCount = await utils.computeTotalCountFromGitHubToken(
        deps,
        async (lastPageNumber) => octokit.repos.listForOrg({
          org,
          page: lastPageNumber,
          per_page: 100
        }).then((lastPageResp) => lastPageResp.data.length),
        "repos.listForOrg",
        resp?.data?.length,
        resp?.headers?.link
      );
    }
  } catch (err) {
    utils.handleError(
      deps,
      "Fetching org repositories with token from token",
      credential,
      errors,
      err
    );
  }
  return { totalCount };
}
async function fileExistsInDefaultBranch(logger, octo, owner, repo, fileName, defaultBranch = "main") {
  try {
    await octo.rest.repos.getContent({
      owner,
      repo,
      path: fileName,
      ref: defaultBranch
    });
    return true;
  } catch (error) {
    if (error.status === 404) {
      return false;
    }
    logger.debug(
      `Unable to determine if a file named ${fileName} already exists in repo ${repo}: ${error}`
    );
    return undefined;
  }
}
async function createOrUpdateFileInBranch(octo, owner, repo, branchName, fileName, fileContent) {
  try {
    const { data: existingFile } = await octo.rest.repos.getContent({
      owner,
      repo,
      path: fileName,
      ref: branchName
    });
    if (Array.isArray(existingFile) || !("sha" in existingFile)) {
      throw new Error(
        `The content at path ${fileName} is not a file or the response from GitHub does not contain the 'sha' property.`
      );
    }
    await octo.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: fileName,
      message: `Add ${fileName} config file`,
      content: btoa(fileContent),
      sha: existingFile.sha,
      branch: branchName
    });
  } catch (error) {
    if (error.status === 404) {
      await octo.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: fileName,
        message: `Add ${fileName} config file`,
        content: btoa(fileContent),
        branch: branchName
      });
    } else {
      throw error;
    }
  }
}

exports.addGithubAppRepositories = addGithubAppRepositories;
exports.addGithubTokenOrgRepositories = addGithubTokenOrgRepositories;
exports.addGithubTokenRepositories = addGithubTokenRepositories;
exports.createOrUpdateFileInBranch = createOrUpdateFileInBranch;
exports.fileExistsInDefaultBranch = fileExistsInDefaultBranch;
exports.searchRepos = searchRepos;
exports.validateAndBuildRepoData = validateAndBuildRepoData;
//# sourceMappingURL=repoUtils.cjs.js.map
