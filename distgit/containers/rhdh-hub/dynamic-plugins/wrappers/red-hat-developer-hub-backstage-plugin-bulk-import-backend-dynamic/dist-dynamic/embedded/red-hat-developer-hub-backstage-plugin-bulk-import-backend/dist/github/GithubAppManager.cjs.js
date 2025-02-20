'use strict';

var authApp = require('@octokit/auth-app');
var rest = require('@octokit/rest');
var gitUrlParse = require('git-url-parse');
var luxon = require('luxon');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);

class Cache {
  tokenCache = /* @__PURE__ */ new Map();
  isExpired(date) {
    return luxon.DateTime.local() > date;
  }
  async getOrCreateToken(key, supplier) {
    let existingInstallationData = this.tokenCache.get(key);
    if (!existingInstallationData || this.isExpired(existingInstallationData.expiresAt)) {
      existingInstallationData = await supplier();
      existingInstallationData.expiresAt = existingInstallationData.expiresAt.minus({ minutes: 10 });
      this.tokenCache.set(key, existingInstallationData);
    }
    return {
      accessToken: existingInstallationData.token,
      installationAccountLogin: existingInstallationData.installationAccountLogin
    };
  }
}
const HEADERS = {
  Accept: "application/vnd.github.machine-man-preview+json"
};
class GithubAppManager {
  appClient;
  baseUrl;
  baseAuthConfig;
  cache = new Cache();
  allowedInstallationOwners;
  // undefined allows all installations
  constructor(config, baseUrl) {
    this.allowedInstallationOwners = config.allowedInstallationOwners;
    this.baseUrl = baseUrl;
    this.baseAuthConfig = {
      appId: config.appId,
      privateKey: config.privateKey.replace(/\\n/gm, "\n")
    };
    this.appClient = new rest.Octokit({
      baseUrl,
      headers: HEADERS,
      authStrategy: authApp.createAppAuth,
      auth: this.baseAuthConfig
    });
  }
  getAppId() {
    return this.baseAuthConfig.appId;
  }
  async getInstallationCredentials(host) {
    const creds = [];
    const installationData = await this.getInstallationData();
    let installationDataFiltered = [];
    if (this.allowedInstallationOwners) {
      for (const installation of installationData) {
        if (installation.accountLogin && !this.allowedInstallationOwners.includes(installation.accountLogin)) {
          continue;
        }
        installationDataFiltered.push(installation);
      }
    } else {
      installationDataFiltered = installationData;
    }
    if (installationDataFiltered.length === 0) {
      return Array.of({ accessToken: undefined });
    }
    for (const installation of installationDataFiltered) {
      const installationId = installation.installationId;
      if (installation.suspended) {
        throw new Error(
          `The GitHub application for ${installationId} is suspended`
        );
      }
      const cred = await this.cache.getOrCreateToken(
        `${host}-${installationId}`,
        async () => {
          const result = await this.appClient.apps.createInstallationAccessToken({
            installation_id: installationId,
            headers: HEADERS
          });
          if (!result) {
            return {
              token: "",
              expiresAt: luxon.DateTime.now().plus({ minutes: 1 }),
              repositories: [],
              installationAccountLogin: installation.accountLogin
            };
          }
          let repositoryNames;
          if (result.data.repository_selection === "selected") {
            const installationClient = new rest.Octokit({
              baseUrl: this.baseUrl,
              auth: result.data.token
            });
            const repos = await installationClient.paginate(
              installationClient.apps.listReposAccessibleToInstallation
            );
            const repositories = repos.repositories ?? repos;
            repositoryNames = repositories.map((repository) => repository.name);
          }
          return {
            token: result.data.token,
            expiresAt: luxon.DateTime.fromISO(result.data.expires_at),
            repositories: repositoryNames,
            installationAccountLogin: installation.accountLogin
          };
        }
      );
      creds.push(cred);
    }
    return creds;
  }
  getInstallations() {
    return this.appClient.paginate(this.appClient.apps.listInstallations);
  }
  async getInstallationData() {
    const allInstallations = await this.getInstallations();
    return allInstallations.map((installation) => {
      return {
        installationId: installation.id,
        accountLogin: installation.account?.login,
        suspended: Boolean(installation.suspended_by)
      };
    });
  }
}
class GithubAppsCredentialManager {
  apps;
  constructor(config) {
    this.apps = config.apps?.map((ac) => new GithubAppManager(ac, config.apiBaseUrl)) ?? [];
  }
  async getAllInstallations() {
    if (!this.apps.length) {
      return [];
    }
    const installs = await Promise.all(
      this.apps.map((app) => app.getInstallations())
    );
    return installs.flat();
  }
  async getAppToken(host) {
    if (this.apps.length === 0) {
      return undefined;
    }
    const results = await Promise.all(
      this.apps.map(
        (app) => app.getInstallationCredentials(host).then(
          (credentials) => ({ credentials, error: undefined }),
          (error) => ({ credentials: undefined, error })
        )
      )
    );
    const result = results.find(
      (resultItem) => resultItem.credentials && resultItem.credentials.length !== 0 && resultItem.credentials[0]?.accessToken
    );
    if (result?.credentials) {
      return result.credentials[0].accessToken;
    }
    const errors = results.map((r) => r.error);
    const notNotFoundError = errors.find((err) => err?.name !== "NotFoundError");
    if (notNotFoundError) {
      throw notNotFoundError;
    }
    return undefined;
  }
  /**
   * Returns an array of app access tokens.
   *
   * Some values in the array might not contain a token and will have an error field instead. This will need to be resolved on the user side
   */
  async getAllAppTokens(host) {
    if (this.apps.length === 0) return [];
    const appCredentials = await Promise.all(
      this.apps.map(
        (app) => app.getInstallationCredentials(host).then(
          (credentials2) => ({
            appId: app.getAppId(),
            credentials: credentials2,
            error: undefined
          }),
          (error) => ({ appId: app.getAppId(), credentials: undefined, error })
        )
      )
    );
    const credentials = [];
    for (const cred of appCredentials) {
      if (cred.credentials) {
        for (const credElement of cred.credentials) {
          credentials.push({
            appId: cred.appId,
            accessToken: credElement.accessToken,
            installationAccountLogin: credElement.installationAccountLogin
          });
        }
      } else {
        credentials.push({
          appId: cred.appId,
          error: cred.error
        });
      }
    }
    return credentials;
  }
}
class CustomSingleInstanceGithubCredentialsProvider {
  constructor(githubAppsCredentialManager, token) {
    this.githubAppsCredentialManager = githubAppsCredentialManager;
    this.token = token;
  }
  static create = (config) => {
    return new CustomSingleInstanceGithubCredentialsProvider(
      new GithubAppsCredentialManager(config),
      config.token
    );
  };
  /**
   * Returns {@link GithubCredentials} for a given URL.
   *
   * @remarks
   *
   * Consecutive calls to this method with the same URL will return cached
   * credentials.
   *
   * The shortest lifetime for a token returned is 10 minutes.
   *
   * @example
   * ```ts
   * const { token, headers } = await getCredentials({
   *   url: 'github.com/backstage/foobar'
   * })
   * ```
   *
   * @param opts - The organization or repository URL
   * @returns A promise of {@link GithubCredentials}.
   */
  async getCredentials(opts) {
    const parsed = gitUrlParse__default.default(opts.url);
    const owner = parsed.owner || parsed.name;
    let type = "app";
    let token = await this.githubAppsCredentialManager.getAppToken(owner);
    if (!token) {
      type = "token";
      token = this.token;
    }
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      token,
      type
    };
  }
  /**
   * Returns {@link ExtendedGithubCredentials[]} for a given URL.
   *
   * @remarks
   *
   * Consecutive calls to this method with the same URL will return cached
   * credentials.
   *
   * The shortest lifetime for a token returned is 10 minutes.
   *
   * Errors may be included in the returned array if the app credentials could not be fetched
   * These need to be dealt with by the user.
   *
   * @example
   * ```ts
   * const credentialList = await getCredentials({
   *   url: 'github.com/backstage/foobar'
   * })
   * for (const credential of credentialList){
   *   if (credential.type === 'app'){
   *     // Deal with the error if it exists
   *     if (credentials.error){
   *       console.error(`Error generating credential for ${credential.appId}: ${credential.error}`)
   *     }
   *     else {
   *       // Do something with the token
   *     }
   *   }
   *   else{
   *     // Do something with the token
   *   }
   *
   * }
   * ```
   *
   * @param opts - The organization or repository URL
   * @returns A promise of {@link ExtendedGithubCredentials[]}.
   */
  async getAllCredentials(opts) {
    const appCredentials = await this.githubAppsCredentialManager.getAllAppTokens(opts.host);
    const credentials = [];
    if (this.token) {
      credentials.push({
        headers: { Authorization: `Bearer ${this.token}` },
        token: this.token,
        type: "token"
      });
    }
    for (const app of appCredentials) {
      if ("accessToken" in app) {
        credentials.push({
          headers: { Authorization: `Bearer ${app.accessToken}` },
          token: app.accessToken,
          type: "app",
          appId: app.appId,
          accountLogin: app.installationAccountLogin
        });
      } else {
        credentials.push({
          type: "app",
          error: app.error,
          appId: app.appId
        });
      }
    }
    return credentials;
  }
}
class CustomGithubCredentialsProvider {
  constructor(providers) {
    this.providers = providers;
  }
  static fromIntegrations(integrations) {
    const credentialsProviders = /* @__PURE__ */ new Map();
    integrations.github.list().forEach((integration) => {
      const credentialsProvider = CustomSingleInstanceGithubCredentialsProvider.create(
        integration.config
      );
      credentialsProviders.set(integration.config.host, credentialsProvider);
    });
    return new CustomGithubCredentialsProvider(credentialsProviders);
  }
  /**
   * Returns {@link GithubCredentials} for a given URL.
   *
   * @remarks
   *
   * Consecutive calls to this method with the same URL will return cached
   * credentials.
   *
   * The shortest lifetime for a token returned is 10 minutes.
   *
   * @example
   * ```ts
   * const { token, headers } = await getCredentials({
   *   url: 'https://github.com/backstage/foobar'
   * })
   *
   * const { token, headers } = await getCredentials({
   *   url: 'https://github.com/backstage'
   * })
   * ```
   *
   * @param opts - The organization or repository URL
   * @returns A promise of {@link GithubCredentials}.
   */
  async getCredentials(opts) {
    const parsed = new URL(opts.url);
    const provider = this.providers.get(parsed.host);
    if (!provider) {
      throw new Error(
        `There is no GitHub integration that matches ${opts.url}. Please add a configuration for an integration.`
      );
    }
    return provider.getCredentials(opts);
  }
  async getAllCredentials(opts) {
    const provider = this.providers.get(opts.host);
    if (!provider) {
      throw new Error(
        `There is no GitHub integration that matches ${opts.host}. Please add a configuration for an integration.`
      );
    }
    return provider.getAllCredentials(opts);
  }
  async getAllAppInstallations(config) {
    return new GithubAppsCredentialManager(config).getAllInstallations();
  }
  async getAppInstallationsForOrg(config, org) {
    const all = await this.getAllAppInstallations(config);
    return all.filter((install) => install.account?.login === org);
  }
}

exports.CustomGithubCredentialsProvider = CustomGithubCredentialsProvider;
exports.CustomSingleInstanceGithubCredentialsProvider = CustomSingleInstanceGithubCredentialsProvider;
exports.GithubAppsCredentialManager = GithubAppsCredentialManager;
//# sourceMappingURL=GithubAppManager.cjs.js.map
