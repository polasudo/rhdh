'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var scaffolderBackendArgocd = require('@roadiehq/scaffolder-backend-argocd');

const dynamicPluginInstaller = {
  kind: "legacy",
  scaffolder: (env) => [scaffolderBackendArgocd.createArgoCdResources(env.config, env.logger)]
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
