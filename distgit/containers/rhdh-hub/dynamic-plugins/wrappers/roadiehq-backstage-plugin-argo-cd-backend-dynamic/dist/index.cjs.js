'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var backstagePluginArgoCdBackend = require('@roadiehq/backstage-plugin-argo-cd-backend');

const dynamicPluginInstaller = {
  kind: "legacy",
  router: {
    pluginID: "argocd",
    createPlugin: backstagePluginArgoCdBackend.createRouter
  }
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
