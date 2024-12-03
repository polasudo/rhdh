'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var errors = require('@backstage/errors');
var node = require('@gitbeaker/node');

function createGitlabApi(options) {
  const { integrations, token: providedToken, repoUrl } = options;
  const { host } = pluginScaffolderNode.parseRepoUrl(repoUrl, integrations);
  const integrationConfig = integrations.gitlab.byHost(host);
  if (!integrationConfig) {
    throw new errors.InputError(
      `No matching integration configuration for host ${host}, please check your integrations config`
    );
  }
  if (!integrationConfig.config.token && !providedToken) {
    throw new errors.InputError(`No token available for host ${host}`);
  }
  const token = providedToken ?? integrationConfig.config.token;
  const tokenType = providedToken ? "oauthToken" : "token";
  return new node.Gitlab({
    host: integrationConfig.config.baseUrl,
    [tokenType]: token
  });
}

exports.createGitlabApi = createGitlabApi;
//# sourceMappingURL=helpers.cjs.js.map
