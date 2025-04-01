'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var pluginEventsNode = require('@backstage/plugin-events-node');
var GithubEntityProvider = require('../providers/GithubEntityProvider.cjs.js');
var GithubLocationAnalyzer = require('../analyzers/GithubLocationAnalyzer.cjs.js');

const githubCatalogModule = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "github",
  register(env) {
    env.registerInit({
      deps: {
        catalogAnalyzers: alpha.catalogAnalysisExtensionPoint,
        auth: backendPluginApi.coreServices.auth,
        catalogProcessing: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        discovery: backendPluginApi.coreServices.discovery,
        events: pluginEventsNode.eventsServiceRef,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler,
        catalog: alpha.catalogServiceRef
      },
      async init({
        catalogProcessing,
        config,
        events,
        logger,
        scheduler,
        catalogAnalyzers,
        discovery,
        auth,
        catalog
      }) {
        catalogAnalyzers.addScmLocationAnalyzer(
          new GithubLocationAnalyzer.GithubLocationAnalyzer({
            discovery,
            config,
            auth,
            catalog
          })
        );
        catalogProcessing.addEntityProvider(
          GithubEntityProvider.GithubEntityProvider.fromConfig(config, {
            events,
            logger,
            scheduler
          })
        );
      }
    });
  }
});

exports.githubCatalogModule = githubCatalogModule;
//# sourceMappingURL=githubCatalogModule.cjs.js.map
