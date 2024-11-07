'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backendPluginApi = require('@backstage/backend-plugin-api');
var backstagePluginGitlabBackend = require('@immobiliarelabs/backstage-plugin-gitlab-backend');

const bundle = backendPluginApi.createBackendFeatureLoader({
  async loader() {
    return [backstagePluginGitlabBackend.gitlabPlugin, backstagePluginGitlabBackend.catalogPluginGitlabFillerProcessorModule];
  }
});

exports["default"] = bundle;
//# sourceMappingURL=index.cjs.js.map
