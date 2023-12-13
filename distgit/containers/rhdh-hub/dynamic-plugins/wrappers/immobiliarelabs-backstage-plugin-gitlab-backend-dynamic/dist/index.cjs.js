'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backstagePluginGitlabBackend = require('@immobiliarelabs/backstage-plugin-gitlab-backend');

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "gitlab",
    createPlugin: backstagePluginGitlabBackend.createRouter
  },
  async catalog(builder, env) {
    builder.addProcessor(new backstagePluginGitlabBackend.GitlabFillerProcessor(env.config));
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
