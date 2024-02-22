'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backstagePluginGitlabBackend = require('@immobiliarelabs/backstage-plugin-gitlab-backend');

const dynamicPluginInstaller = {
  kind: "new",
  install: () => [backstagePluginGitlabBackend.catalogPluginGitlabFillerProcessorModule(), backstagePluginGitlabBackend.gitlabPlugin()]
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
