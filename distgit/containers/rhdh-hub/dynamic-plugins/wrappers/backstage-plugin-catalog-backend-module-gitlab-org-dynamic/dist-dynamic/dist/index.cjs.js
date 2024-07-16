'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/backend-plugin-api');
var require$$2 = require('@backstage/plugin-catalog-backend-module-gitlab');
var require$$3 = require('@backstage/plugin-catalog-node/alpha');
var require$$4 = require('@backstage/plugin-events-node');

var index_cjs = {};

Object.defineProperty(index_cjs, '__esModule', { value: true });

var backendCommon = require$$0;
var backendPluginApi = require$$1;
var pluginCatalogBackendModuleGitlab = require$$2;
var alpha = require$$3;
var pluginEventsNode = require$$4;

const catalogModuleGitlabOrgDiscoveryEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "gitlabOrgDiscoveryEntityProvider",
  register(env) {
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        catalog: alpha.catalogProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        events: pluginEventsNode.eventsServiceRef
      },
      async init({ config, catalog, logger, scheduler, events }) {
        const gitlabOrgDiscoveryEntityProvider = pluginCatalogBackendModuleGitlab.GitlabOrgDiscoveryEntityProvider.fromConfig(config, {
          logger: backendCommon.loggerToWinstonLogger(logger),
          events,
          scheduler
        });
        catalog.addEntityProvider(gitlabOrgDiscoveryEntityProvider);
      }
    });
  }
});

var _default = index_cjs.default = catalogModuleGitlabOrgDiscoveryEntityProvider;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
