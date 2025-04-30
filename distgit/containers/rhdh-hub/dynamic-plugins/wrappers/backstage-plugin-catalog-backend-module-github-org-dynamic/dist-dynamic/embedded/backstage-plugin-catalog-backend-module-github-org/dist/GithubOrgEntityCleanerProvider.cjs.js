'use strict';

class GithubOrgEntityCleanerProvider {
  constructor(options) {
    this.options = options;
    this.logger = options.logger.child({ target: this.getProviderName() });
  }
  logger;
  getProviderName() {
    return `GithubOrgEntityProvider:${this.options.id}`;
  }
  async connect(connection) {
    connection.applyMutation({
      type: "full",
      entities: []
    }).catch((error) => {
      this.logger.error("Failed to clean up entities", error);
    });
  }
}

exports.GithubOrgEntityCleanerProvider = GithubOrgEntityCleanerProvider;
//# sourceMappingURL=GithubOrgEntityCleanerProvider.cjs.js.map
