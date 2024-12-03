'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var MicrosoftGraphOrgEntityProvider = require('../processors/MicrosoftGraphOrgEntityProvider.cjs.js');
require('@backstage/plugin-catalog-node');
require('@azure/identity');
require('node-fetch');
require('qs');
require('lodash');
require('@backstage/catalog-model');
require('p-limit');

const microsoftGraphOrgEntityProviderTransformExtensionPoint = backendPluginApi.createExtensionPoint(
  {
    id: "catalog.microsoftGraphOrgEntityProvider.transforms"
  }
);
const catalogModuleMicrosoftGraphOrgEntityProvider = backendPluginApi.createBackendModule(
  {
    pluginId: "catalog",
    moduleId: "microsoftGraphOrgEntityProvider",
    register(env) {
      let userTransformer;
      let groupTransformer;
      let organizationTransformer;
      let providerConfigTransformer;
      env.registerExtensionPoint(
        microsoftGraphOrgEntityProviderTransformExtensionPoint,
        {
          setUserTransformer(transformer) {
            if (userTransformer) {
              throw new Error("User transformer may only be set once");
            }
            userTransformer = transformer;
          },
          setGroupTransformer(transformer) {
            if (groupTransformer) {
              throw new Error("Group transformer may only be set once");
            }
            groupTransformer = transformer;
          },
          setOrganizationTransformer(transformer) {
            if (organizationTransformer) {
              throw new Error("Organization transformer may only be set once");
            }
            organizationTransformer = transformer;
          },
          setProviderConfigTransformer(transformer) {
            if (providerConfigTransformer) {
              throw new Error("Provider transformer may only be set once");
            }
            providerConfigTransformer = transformer;
          }
        }
      );
      env.registerInit({
        deps: {
          catalog: alpha.catalogProcessingExtensionPoint,
          config: backendPluginApi.coreServices.rootConfig,
          logger: backendPluginApi.coreServices.logger,
          scheduler: backendPluginApi.coreServices.scheduler
        },
        async init({ catalog, config, logger, scheduler }) {
          catalog.addEntityProvider(
            MicrosoftGraphOrgEntityProvider.MicrosoftGraphOrgEntityProvider.fromConfig(config, {
              logger,
              scheduler,
              userTransformer,
              groupTransformer,
              organizationTransformer,
              providerConfigTransformer
            })
          );
        }
      });
    }
  }
);

exports.catalogModuleMicrosoftGraphOrgEntityProvider = catalogModuleMicrosoftGraphOrgEntityProvider;
exports.microsoftGraphOrgEntityProviderTransformExtensionPoint = microsoftGraphOrgEntityProviderTransformExtensionPoint;
//# sourceMappingURL=catalogModuleMicrosoftGraphOrgEntityProvider.cjs.js.map
