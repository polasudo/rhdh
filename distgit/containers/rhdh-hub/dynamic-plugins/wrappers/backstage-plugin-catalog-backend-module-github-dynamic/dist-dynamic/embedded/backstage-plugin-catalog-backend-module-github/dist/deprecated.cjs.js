'use strict';

var GithubEntityProvider = require('./providers/GithubEntityProvider.cjs.js');
var GithubOrgEntityProvider = require('./providers/GithubOrgEntityProvider.cjs.js');

class GitHubOrgEntityProvider extends GithubOrgEntityProvider.GithubOrgEntityProvider {
  static fromConfig(config, options) {
    options.logger.warn(
      "[Deprecated] Use GithubOrgEntityProvider instead of GitHubOrgEntityProvider."
    );
    return GithubOrgEntityProvider.GithubOrgEntityProvider.fromConfig(
      config,
      options
    );
  }
}
class GitHubEntityProvider {
  constructor(delegate) {
    this.delegate = delegate;
  }
  static fromConfig(config, options) {
    options.logger.warn(
      "[Deprecated] Please use GithubEntityProvider instead of GitHubEntityProvider."
    );
    return GithubEntityProvider.GithubEntityProvider.fromConfig(config, options).map(
      (delegate) => new GitHubEntityProvider(delegate)
    );
  }
  connect(connection) {
    return this.delegate.connect(connection);
  }
  getProviderName() {
    return this.delegate.getProviderName();
  }
  refresh(logger) {
    return this.delegate.refresh(logger);
  }
}

exports.GitHubEntityProvider = GitHubEntityProvider;
exports.GitHubOrgEntityProvider = GitHubOrgEntityProvider;
//# sourceMappingURL=deprecated.cjs.js.map
