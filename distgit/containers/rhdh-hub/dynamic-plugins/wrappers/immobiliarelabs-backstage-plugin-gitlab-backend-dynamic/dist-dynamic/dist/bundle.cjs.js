'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var backstagePluginGitlabBackend = require('@immobiliarelabs/backstage-plugin-gitlab-backend');

const bundle = backendPluginApi.createBackendFeatureLoader({
  async loader() {
    return [backstagePluginGitlabBackend.gitlabPlugin, backstagePluginGitlabBackend.catalogPluginGitlabFillerProcessorModule];
  }
});

exports.bundle = bundle;
//# sourceMappingURL=bundle.cjs.js.map
