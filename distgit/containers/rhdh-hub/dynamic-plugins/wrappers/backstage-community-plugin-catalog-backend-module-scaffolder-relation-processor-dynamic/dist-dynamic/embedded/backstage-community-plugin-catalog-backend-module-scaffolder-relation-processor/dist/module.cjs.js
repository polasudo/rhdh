'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var ScaffolderRelationEntityProcessor = require('./ScaffolderRelationEntityProcessor.cjs.js');

const catalogModuleScaffolderRelationProcessor = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "scaffolder-relation-processor",
  register(env) {
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        logger: backendPluginApi.coreServices.logger
      },
      async init({ catalog, logger }) {
        logger.debug(
          "Registering the scaffolder-relation-processor catalog module"
        );
        catalog.addProcessor(new ScaffolderRelationEntityProcessor.ScaffolderRelationEntityProcessor());
      }
    });
  }
});

exports.catalogModuleScaffolderRelationProcessor = catalogModuleScaffolderRelationProcessor;
//# sourceMappingURL=module.cjs.js.map
