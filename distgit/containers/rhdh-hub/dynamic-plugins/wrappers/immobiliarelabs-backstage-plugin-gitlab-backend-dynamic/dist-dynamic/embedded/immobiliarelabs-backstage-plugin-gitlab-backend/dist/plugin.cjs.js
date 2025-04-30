'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var backendCommon = require('@backstage/backend-common');
var processor = require('./processor/processor.cjs.js');
var router = require('./service/router.cjs.js');

const catalogPluginGitlabFillerProcessorModule = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "gitlabFillerProcessor",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        extensionPoint: alpha.catalogProcessingExtensionPoint
      },
      async init({ config, extensionPoint }) {
        extensionPoint.addProcessor(new processor.GitlabFillerProcessor(config));
      }
    });
  }
});
const gitlabPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "gitlab",
  register(env) {
    env.registerInit({
      deps: {
        http: backendPluginApi.coreServices.httpRouter,
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ config, logger, http }) {
        const winstonLogger = backendCommon.loggerToWinstonLogger(logger);
        http.use(
          await router.createRouter({
            logger: winstonLogger,
            config
          })
        );
      }
    });
  }
});

exports.catalogPluginGitlabFillerProcessorModule = catalogPluginGitlabFillerProcessorModule;
exports.gitlabPlugin = gitlabPlugin;
//# sourceMappingURL=plugin.cjs.js.map
