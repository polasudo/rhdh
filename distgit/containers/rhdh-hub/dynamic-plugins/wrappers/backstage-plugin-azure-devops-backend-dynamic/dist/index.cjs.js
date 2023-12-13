'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var pluginAzureDevopsBackend = require('@backstage/plugin-azure-devops-backend');

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "azure-devops",
    createPlugin: pluginAzureDevopsBackend.createRouter
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
