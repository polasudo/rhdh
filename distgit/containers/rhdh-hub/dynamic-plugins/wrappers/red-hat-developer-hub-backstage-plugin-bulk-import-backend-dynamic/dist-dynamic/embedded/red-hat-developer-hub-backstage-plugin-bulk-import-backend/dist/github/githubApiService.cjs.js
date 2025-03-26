'use strict';

var integration = require('@backstage/integration');
var gitUrlParse = require('git-url-parse');
var catalogUtils = require('../catalog/catalogUtils.cjs.js');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
require('just-kebab-case');
var loggingUtils = require('../helpers/loggingUtils.cjs.js');
var handlers = require('../service/handlers/handlers.cjs.js');
var GithubAppManager = require('./GithubAppManager.cjs.js');
var types = require('./types.cjs.js');
var ghUtils = require('./utils/ghUtils.cjs.js');
var orgUtils = require('./utils/orgUtils.cjs.js');
var prUtils = require('./utils/prUtils.cjs.js');
var repoUtils = require('./utils/repoUtils.cjs.js');
var utils = require('./utils/utils.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

class GithubApiService {
  logger;
  integrations;
  githubCredentialsProvider;
  config;
  // Cache for storing ETags (used for efficient caching of unchanged data returned by GitHub)
  cache;
  constructor(logger, config, cacheService) {
    this.logger = logger;
    this.config = config;
    this.integrations = integration.ScmIntegrations.fromConfig(config);
    this.githubCredentialsProvider = GithubAppManager.CustomGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.cache = cacheService;
  }
  async getRepositoryFromIntegrations(repoUrl) {
    const gitUrl = gitUrlParse__default.default(repoUrl);
    const ghConfig = this.integrations.github.byUrl(repoUrl)?.config;
    if (!ghConfig) {
      throw new Error(
        `No GitHub integration config found for repo ${repoUrl}. Please add a configuration entry under 'integrations.github`
      );
    }
    const credentials = await utils.getCredentialsForConfig(
      this.githubCredentialsProvider,
      ghConfig
    );
    const errors = /* @__PURE__ */ new Map();
    let repository = undefined;
    for (const credential of credentials) {
      const octokit = ghUtils.buildOcto(
        {
          logger: this.logger,
          cache: this.cache
        },
        { credential, errors, owner: gitUrl.owner },
        ghConfig.apiBaseUrl
      );
      if (!octokit) {
        continue;
      }
      const resp = await octokit.rest.repos.get({
        owner: gitUrl.owner,
        repo: gitUrl.name
      });
      const repo = resp?.data;
      if (!repo) {
        continue;
      }
      repository = {
        name: repo.name,
        full_name: repo.full_name,
        url: repo.url,
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at
      };
      break;
    }
    return {
      repository,
      errors: Array.from(errors.values())
    };
  }
  async getOrganizationsFromIntegrations(search, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
    const orgs = /* @__PURE__ */ new Map();
    const result = await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          const dataFetchErrors = /* @__PURE__ */ new Map();
          const resp = types.isGithubAppCredential(credential) ? await orgUtils.addGithubAppOrgs(
            {
              logger: this.logger,
              githubCredentialsProvider: this.githubCredentialsProvider
            },
            octokit,
            ghConfig,
            {
              credentialAccountLogin: credential.accountLogin,
              search,
              orgs,
              errors: dataFetchErrors
            }
          ) : await orgUtils.addGithubTokenOrgs(
            {
              logger: this.logger
            },
            octokit,
            credential,
            {
              search,
              orgs,
              pageNumber,
              pageSize,
              errors: dataFetchErrors
            }
          );
          this.logger.debug(
            `Got ${resp.totalCount} org(s) for ${ghConfig.host}`
          );
          return {
            result: resp.totalCount ?? 0,
            errors: Array.from(dataFetchErrors.values())
          };
        }
      }
    );
    const orgList = Array.from(orgs.values());
    const totalCount = utils.computeTotalCount(orgList, result.data, pageSize);
    return {
      organizations: orgList,
      errors: Array.from(result.errors?.values() ?? []),
      totalCount
    };
  }
  async getOrgRepositoriesFromIntegrations(orgName, search, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
    const repositories = /* @__PURE__ */ new Map();
    const result = await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          const dataFetchErrors = /* @__PURE__ */ new Map();
          let resp;
          if (types.isGithubAppCredential(credential)) {
            if (credential.accountLogin !== orgName) {
              return {};
            }
            resp = await repoUtils.addGithubAppRepositories(
              {
                logger: this.logger,
                githubCredentialsProvider: this.githubCredentialsProvider
              },
              octokit,
              credential,
              ghConfig,
              repositories,
              dataFetchErrors,
              {
                search,
                pageNumber,
                pageSize
              }
            );
          } else {
            resp = await repoUtils.addGithubTokenOrgRepositories(
              {
                logger: this.logger
              },
              octokit,
              credential,
              orgName,
              repositories,
              dataFetchErrors,
              {
                search,
                pageNumber,
                pageSize
              }
            );
          }
          this.logger.debug(
            `Got ${resp.totalCount} org repo(s) for ${ghConfig.host}`
          );
          return {
            stopFetchingData: true,
            result: resp.totalCount ?? 0,
            errors: Array.from(dataFetchErrors.values())
          };
        }
      }
    );
    const repoList = Array.from(repositories.values());
    const totalCount = utils.computeTotalCount(repoList, result.data, pageSize);
    return {
      repositories: repoList,
      errors: Array.from(result.errors?.values() ?? []),
      totalCount
    };
  }
  /**
   * Returns GithubRepositoryResponse containing:
   *   - a list of unique repositories the github integrations have access to
   *   - a list of errors encountered by each app and/or token (if any exist)
   */
  async getRepositoriesFromIntegrations(search, pageNumber = handlers.DefaultPageNumber, pageSize = handlers.DefaultPageSize) {
    const repositories = /* @__PURE__ */ new Map();
    const result = await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          const dataFetchErrors = /* @__PURE__ */ new Map();
          const resp = types.isGithubAppCredential(credential) ? await repoUtils.addGithubAppRepositories(
            {
              logger: this.logger,
              githubCredentialsProvider: this.githubCredentialsProvider
            },
            octokit,
            credential,
            ghConfig,
            repositories,
            dataFetchErrors,
            {
              search,
              pageNumber,
              pageSize
            }
          ) : await repoUtils.addGithubTokenRepositories(
            {
              logger: this.logger
            },
            octokit,
            credential,
            repositories,
            dataFetchErrors,
            {
              search,
              pageNumber,
              pageSize
            }
          );
          this.logger.debug(
            `Got ${resp.totalCount} repo(s) for ${ghConfig.host}`
          );
          return {
            result: resp.totalCount ?? 0,
            errors: Array.from(dataFetchErrors.values())
          };
        }
      }
    );
    const repoList = Array.from(repositories.values());
    const totalCount = utils.computeTotalCount(repoList, result.data, pageSize);
    return {
      repositories: repoList,
      errors: Array.from(result.errors?.values() ?? []),
      totalCount
    };
  }
  async filterLocationsAccessibleFromIntegrations(locationUrls) {
    const locationGitOwnerMap = utils.extractLocationOwnerMap(locationUrls);
    const allAccessibleAppOrgs = /* @__PURE__ */ new Set();
    const allAccessibleTokenOrgs = /* @__PURE__ */ new Set();
    const allAccessibleUsernames = /* @__PURE__ */ new Set();
    await utils.fetchFromAllIntegrations(
      {
        logger: this.logger,
        cache: this.cache,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        dataFetcher: async (octokit, credential, ghConfig) => {
          if (types.isGithubAppCredential(credential)) {
            const appOrgMap = await orgUtils.getAllAppOrgs(
              this.githubCredentialsProvider,
              ghConfig,
              credential.accountLogin
            );
            for (const [_, ghOrg] of appOrgMap) {
              allAccessibleAppOrgs.add(ghOrg.name);
            }
          } else {
            const username = (await octokit.rest.users.getAuthenticated())?.data?.login;
            if (username) {
              allAccessibleUsernames.add(username);
            }
            (await octokit.paginate(octokit.rest.orgs.listForAuthenticatedUser))?.map((org) => org.login)?.forEach((orgName) => allAccessibleTokenOrgs.add(orgName));
          }
          return {};
        }
      }
    );
    return locationUrls.filter((loc) => {
      if (!locationGitOwnerMap.has(loc)) {
        return false;
      }
      const owner = locationGitOwnerMap.get(loc);
      return allAccessibleAppOrgs.has(owner) || allAccessibleTokenOrgs.has(owner) || allAccessibleUsernames.has(owner);
    });
  }
  async findImportOpenPr(logger, input) {
    const ghConfig = this.integrations.github.byUrl(input.repoUrl)?.config;
    if (!ghConfig) {
      throw new Error(`Could not find GH integration from ${input.repoUrl}`);
    }
    const gitUrl = gitUrlParse__default.default(input.repoUrl);
    const owner = gitUrl.organization;
    const repo = gitUrl.name;
    const credentials = await this.githubCredentialsProvider.getAllCredentials({
      host: ghConfig.host
    });
    if (credentials.length === 0) {
      throw new Error(`No credentials for GH integration`);
    }
    const branchName = catalogUtils.getBranchName(this.config);
    for (const credential of credentials) {
      const octo = ghUtils.buildOcto(
        {
          logger: this.logger,
          cache: this.cache
        },
        { credential, owner },
        ghConfig.apiBaseUrl
      );
      if (!octo) {
        continue;
      }
      try {
        return await prUtils.findOpenPRForBranch(
          logger,
          this.config,
          octo,
          owner,
          repo,
          branchName,
          input.includeCatalogInfoContent
        );
      } catch (error) {
        loggingUtils.logErrorIfNeeded(this.logger, "Error fetching pull requests", error);
      }
    }
    return {};
  }
  async submitPrToRepo(logger, input) {
    const fileName = catalogUtils.getCatalogFilename(this.config);
    const errors = [];
    const result = await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo, branchName } = validatedRepo;
          try {
            const catalogInfoFileExists = await repoUtils.fileExistsInDefaultBranch(
              logger,
              octo,
              owner,
              repo,
              fileName,
              input.defaultBranch
            );
            if (catalogInfoFileExists) {
              return {
                successful: true,
                result: {
                  hasChanges: false
                }
              };
            }
            const existingPrForBranch = await prUtils.findOpenPRForBranch(
              logger,
              this.config,
              octo,
              owner,
              repo,
              branchName
            );
            const repoData = await octo.rest.repos.get({
              owner,
              repo
            });
            const parentRef = await octo.rest.git.getRef({
              owner,
              repo,
              ref: `heads/${repoData.data.default_branch}`
            });
            if (existingPrForBranch.prNum) {
              await repoUtils.createOrUpdateFileInBranch(
                octo,
                owner,
                repo,
                branchName,
                fileName,
                input.catalogInfoContent
              );
              const pullRequestResponse2 = await octo.rest.pulls.update({
                owner,
                repo,
                pull_number: existingPrForBranch.prNum,
                title: input.prTitle,
                body: input.prBody,
                head: branchName,
                base: repoData.data.default_branch
              });
              return {
                successful: true,
                result: {
                  prNumber: existingPrForBranch.prNum,
                  prUrl: pullRequestResponse2.data.html_url,
                  lastUpdate: pullRequestResponse2.data.updated_at
                }
              };
            }
            let branchExists = false;
            try {
              await octo.rest.git.getRef({
                owner,
                repo,
                ref: `heads/${branchName}`
              });
              branchExists = true;
            } catch (error) {
              if (error.status === 404) {
                await octo.rest.git.createRef({
                  owner,
                  repo,
                  ref: `refs/heads/${branchName}`,
                  sha: parentRef.data.object.sha
                });
              } else {
                throw error;
              }
            }
            if (branchExists) {
              try {
                await octo.repos.merge({
                  owner,
                  repo,
                  base: branchName,
                  head: repoData.data.default_branch
                });
              } catch (error) {
                loggingUtils.logErrorIfNeeded(
                  this.logger,
                  `Could not merge default branch ${repoData.data.default_branch} into import branch ${branchName}`,
                  error
                );
              }
            }
            await repoUtils.createOrUpdateFileInBranch(
              octo,
              owner,
              repo,
              branchName,
              fileName,
              input.catalogInfoContent
            );
            const pullRequestResponse = await octo.rest.pulls.create({
              owner,
              repo,
              title: input.prTitle,
              body: input.prBody,
              head: branchName,
              base: repoData.data.default_branch
            });
            return {
              successful: true,
              result: {
                prNumber: pullRequestResponse.data.number,
                prUrl: pullRequestResponse.data.html_url,
                lastUpdate: pullRequestResponse.data.updated_at,
                hasChanges: true
              }
            };
          } catch (e) {
            loggingUtils.logErrorIfNeeded(
              this.logger,
              `Couldn't create PR in ${input.repoUrl}`,
              e
            );
            errors.push(e.message);
            return { successful: false };
          }
        }
      }
    );
    if (result) {
      return result;
    }
    logger.warn(
      `Tried all possible GitHub credentials, but could not create PR in ${input.repoUrl}. Please try again later...`
    );
    return {
      errors
    };
  }
  async hasFileInRepo(input) {
    const fileExists = await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo } = validatedRepo;
          const exists = await repoUtils.fileExistsInDefaultBranch(
            this.logger,
            octo,
            owner,
            repo,
            input.fileName,
            input.defaultBranch
          );
          if (exists === undefined) {
            return { successful: false };
          }
          return { successful: true, result: exists };
        }
      }
    );
    if (fileExists === undefined) {
      throw new Error(
        `Could not determine if repo at ${input.repoUrl} already has a file named ${input.fileName} in its default branch (${input.defaultBranch})`
      );
    }
    return fileExists;
  }
  async closeImportPR(logger, input) {
    await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo, branchName } = validatedRepo;
          try {
            const existingPrForBranch = await prUtils.findOpenPRForBranch(
              logger,
              this.config,
              octo,
              owner,
              repo,
              branchName
            );
            if (existingPrForBranch.prNum) {
              await prUtils.closePRWithComment(
                octo,
                owner,
                repo,
                existingPrForBranch.prNum,
                input.comment
              );
            }
            return { successful: true };
          } catch (e) {
            loggingUtils.logErrorIfNeeded(
              this.logger,
              `Couldn't close PR in ${input.repoUrl}`,
              e
            );
            return { successful: false };
          }
        }
      }
    );
  }
  async deleteImportBranch(input) {
    await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo, branchName } = validatedRepo;
          try {
            await octo.git.deleteRef({
              owner,
              repo,
              ref: `heads/${branchName}`
            });
            return { successful: true };
          } catch (e) {
            loggingUtils.logErrorIfNeeded(
              this.logger,
              `Couldn't close import PR and/or delete import branch in ${input.repoUrl}`,
              e
            );
            return { successful: false };
          }
        }
      }
    );
  }
  async isRepoEmpty(input) {
    return await utils.executeFunctionOnFirstSuccessfulIntegration(
      {
        logger: this.logger,
        cache: this.cache,
        config: this.config,
        githubCredentialsProvider: this.githubCredentialsProvider
      },
      this.integrations,
      {
        repoUrl: input.repoUrl,
        fn: async (validatedRepo, octo) => {
          const { owner, repo } = validatedRepo;
          const resp = await octo.rest.repos.listContributors({
            owner,
            repo,
            page: 1,
            per_page: 1
          });
          const status = resp.status;
          return { successful: true, result: status === 204 };
        }
      }
    );
  }
}

exports.GithubApiService = GithubApiService;
//# sourceMappingURL=githubApiService.cjs.js.map
