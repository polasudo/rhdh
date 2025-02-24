'use strict';

var catalogClient = require('@backstage/catalog-client');
var integration = require('@backstage/integration');
var rest = require('@octokit/rest');
var lodash = require('lodash');
var parseGitUrl = require('git-url-parse');
var backendCommon = require('@backstage/backend-common');
var path = require('path');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var parseGitUrl__default = /*#__PURE__*/_interopDefaultCompat(parseGitUrl);

class GithubLocationAnalyzer {
  catalogClient;
  githubCredentialsProvider;
  integrations;
  auth;
  constructor(options) {
    this.catalogClient = options.catalog ?? new catalogClient.CatalogClient({ discoveryApi: options.discovery });
    this.integrations = integration.ScmIntegrations.fromConfig(options.config);
    this.githubCredentialsProvider = options.githubCredentialsProvider || integration.DefaultGithubCredentialsProvider.fromIntegrations(this.integrations);
    this.auth = backendCommon.createLegacyAuthAdapters({
      auth: options.auth,
      discovery: options.discovery,
      tokenManager: options.tokenManager
    }).auth;
  }
  supports(url) {
    const integration = this.integrations.byUrl(url);
    return integration?.type === "github";
  }
  async analyze(options) {
    const { url, catalogFilename } = options;
    const { owner, name: repo } = parseGitUrl__default.default(url);
    const catalogFile = catalogFilename || "catalog-info.yaml";
    const extension = path.extname(catalogFile);
    const extensionQuery = !lodash.isEmpty(extension) ? `extension:${extension.replace(".", "")}` : "";
    const query = `filename:${catalogFile} ${extensionQuery} repo:${owner}/${repo}`;
    const integration = this.integrations.github.byUrl(url);
    if (!integration) {
      throw new Error("Make sure you have a GitHub integration configured");
    }
    const { token: githubToken } = await this.githubCredentialsProvider.getCredentials({
      url
    });
    const octokitClient = new rest.Octokit({
      auth: githubToken,
      baseUrl: integration.config.apiBaseUrl
    });
    const searchResult = await octokitClient.search.code({ q: query }).catch((e) => {
      throw new Error(`Couldn't search repository for metadata file, ${e}`);
    });
    const exists = searchResult.data.total_count > 0;
    if (exists) {
      const repoInformation = await octokitClient.repos.get({ owner, repo }).catch((e) => {
        throw new Error(`Couldn't fetch repo data, ${e}`);
      });
      const defaultBranch = repoInformation.data.default_branch;
      const { token: serviceToken } = await this.auth.getPluginRequestToken({
        onBehalfOf: await this.auth.getOwnServiceCredentials(),
        targetPluginId: "catalog"
      });
      const result = await Promise.all(
        searchResult.data.items.map((i) => `${lodash.trimEnd(url, "/")}/blob/${defaultBranch}/${i.path}`).map(async (target) => {
          const addLocationResult = await this.catalogClient.addLocation(
            {
              type: "url",
              target,
              dryRun: true
            },
            { token: serviceToken }
          );
          return addLocationResult.entities.map((e) => ({
            location: { type: "url", target },
            isRegistered: !!addLocationResult.exists,
            entity: e
          }));
        })
      );
      return { existing: result.flat() };
    }
    return { existing: [] };
  }
}

exports.GithubLocationAnalyzer = GithubLocationAnalyzer;
//# sourceMappingURL=GithubLocationAnalyzer.cjs.js.map
