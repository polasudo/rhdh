'use strict';

var integration = require('@backstage/integration');
var urls = require('./urls.cjs.js');
var annotations = require('../annotations.cjs.js');

class GitlabFillerProcessor {
  allowedKinds;
  gitLabIntegrationsConfig;
  constructor(config) {
    const allowedKinds = config.getOptionalStringArray(
      "gitlab.allowedKinds"
    ) || ["Component"];
    this.gitLabIntegrationsConfig = integration.readGitLabIntegrationConfigs(
      config.getConfigArray("integrations.gitlab")
    );
    this.allowedKinds = new Set(
      allowedKinds.map((str) => str.toLowerCase())
    );
  }
  getProcessorName() {
    return "GitlabFillerProcessor";
  }
  async postProcessEntity(entity, location, _emit) {
    if (this.isAllowedEntity(entity)) {
      const gitlabInstanceConfig = this.getGitlabInstanceConfig(
        location.target
      );
      if (gitlabInstanceConfig) {
        if (!entity.metadata.annotations)
          entity.metadata.annotations = {};
        if (!entity.metadata.annotations[annotations.GITLAB_INSTANCE] && entity.metadata.annotations[annotations.GITLAB_INSTANCE] !== "") {
          entity.metadata.annotations[annotations.GITLAB_INSTANCE] = gitlabInstanceConfig?.host;
        }
        if (!entity.metadata.annotations[annotations.GITLAB_PROJECT_ID] && entity.metadata.annotations[annotations.GITLAB_PROJECT_ID] !== "" && !entity.metadata.annotations[annotations.GITLAB_PROJECT_SLUG] && entity.metadata.annotations[annotations.GITLAB_PROJECT_SLUG] !== "") {
          entity.metadata.annotations[annotations.GITLAB_PROJECT_SLUG] = urls.getProjectPath(
            location.target,
            this.getGitlabSubPath(gitlabInstanceConfig)
          );
        }
      }
    }
    return entity;
  }
  getGitlabSubPath(config) {
    if (config.baseUrl) return new URL(config.baseUrl).pathname;
    return;
  }
  getGitlabInstanceConfig(target) {
    let url;
    try {
      url = new URL(target);
    } catch (e) {
      return undefined;
    }
    const gitlabConfig = this.gitLabIntegrationsConfig.find((config) => {
      const baseUrl = config.baseUrl ? new URL(config.baseUrl) : new URL(`https://${config.host}`);
      return baseUrl.origin === url.origin;
    });
    return gitlabConfig;
  }
  isAllowedEntity(entity) {
    return this.allowedKinds.has(entity.kind.toLowerCase());
  }
}

exports.GitlabFillerProcessor = GitlabFillerProcessor;
//# sourceMappingURL=processor.cjs.js.map
