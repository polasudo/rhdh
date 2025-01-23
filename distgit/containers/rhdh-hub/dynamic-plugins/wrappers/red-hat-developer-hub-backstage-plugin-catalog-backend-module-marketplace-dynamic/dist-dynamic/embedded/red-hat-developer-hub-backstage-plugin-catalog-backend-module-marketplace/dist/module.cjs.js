'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var MarketplacePluginProcessor = require('./processors/MarketplacePluginProcessor.cjs.js');
var MarketplacePluginListProcessor = require('./processors/MarketplacePluginListProcessor.cjs.js');
var DynamicPluginInstallStatusProcessor = require('./processors/DynamicPluginInstallStatusProcessor.cjs.js');
var LocalPluginInstallStatusProcessor = require('./processors/LocalPluginInstallStatusProcessor.cjs.js');

const catalogModuleMarketplace = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "marketplace",
  register(reg) {
    reg.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        catalog: alpha.catalogProcessingExtensionPoint,
        discovery: backendPluginApi.coreServices.discovery,
        auth: backendPluginApi.coreServices.auth
      },
      async init({ logger, catalog, discovery, auth }) {
        logger.info("Adding Marketplace processors to catalog...");
        catalog.addProcessor(new MarketplacePluginProcessor.MarketplacePluginProcessor());
        catalog.addProcessor(new MarketplacePluginListProcessor.MarketplacePluginListProcessor());
        catalog.addProcessor(new LocalPluginInstallStatusProcessor.LocalPluginInstallStatusProcessor());
        catalog.addProcessor(
          new DynamicPluginInstallStatusProcessor.DynamicPluginInstallStatusProcessor(discovery, auth)
        );
      }
    });
  }
});

exports.catalogModuleMarketplace = catalogModuleMarketplace;
//# sourceMappingURL=module.cjs.js.map
