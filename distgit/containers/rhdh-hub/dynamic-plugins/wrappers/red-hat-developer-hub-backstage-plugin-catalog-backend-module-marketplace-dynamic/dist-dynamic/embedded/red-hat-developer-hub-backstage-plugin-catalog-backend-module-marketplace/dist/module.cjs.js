'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var MarketplacePluginProcessor = require('./processors/MarketplacePluginProcessor.cjs.js');
var MarketplaceCollectionProcessor = require('./processors/MarketplaceCollectionProcessor.cjs.js');
var DynamicPackageInstallStatusProcessor = require('./processors/DynamicPackageInstallStatusProcessor.cjs.js');
var LocalPackageInstallStatusProcessor = require('./processors/LocalPackageInstallStatusProcessor.cjs.js');
var MarketplacePackageProcessor = require('./processors/MarketplacePackageProcessor.cjs.js');

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
        catalog.addProcessor(new MarketplaceCollectionProcessor.MarketplaceCollectionProcessor());
        catalog.addProcessor(new LocalPackageInstallStatusProcessor.LocalPackageInstallStatusProcessor());
        catalog.addProcessor(new MarketplacePackageProcessor.MarketplacePackageProcessor());
        catalog.addProcessor(
          new DynamicPackageInstallStatusProcessor.DynamicPackageInstallStatusProcessor(discovery, auth)
        );
      }
    });
  }
});

exports.catalogModuleMarketplace = catalogModuleMarketplace;
//# sourceMappingURL=module.cjs.js.map
