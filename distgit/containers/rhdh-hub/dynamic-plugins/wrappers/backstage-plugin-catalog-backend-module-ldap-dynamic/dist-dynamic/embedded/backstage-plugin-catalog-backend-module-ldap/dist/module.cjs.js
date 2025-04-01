'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var alpha = require('@backstage/plugin-catalog-node/alpha');
var LdapOrgEntityProvider = require('./processors/LdapOrgEntityProvider.cjs.js');
require('@backstage/errors');
require('fs/promises');
require('ldapjs');
require('lodash');
require('tls');
require('lodash/mergeWith');
require('@backstage/catalog-model');
require('lodash/set');
require('lodash/cloneDeep');
require('@backstage/plugin-catalog-node');

const ldapOrgEntityProviderTransformsExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "catalog.ldapOrgEntityProvider.transforms"
});
const catalogModuleLdapOrgEntityProvider = backendPluginApi.createBackendModule({
  pluginId: "catalog",
  moduleId: "ldapOrgEntityProvider",
  register(env) {
    let userTransformer;
    let groupTransformer;
    env.registerExtensionPoint(ldapOrgEntityProviderTransformsExtensionPoint, {
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
      }
    });
    env.registerInit({
      deps: {
        catalog: alpha.catalogProcessingExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        scheduler: backendPluginApi.coreServices.scheduler
      },
      async init({ catalog, config, logger, scheduler }) {
        catalog.addEntityProvider(
          LdapOrgEntityProvider.LdapOrgEntityProvider.fromConfig(config, {
            logger,
            scheduler,
            userTransformer,
            groupTransformer
          })
        );
      }
    });
  }
});

exports.catalogModuleLdapOrgEntityProvider = catalogModuleLdapOrgEntityProvider;
exports.ldapOrgEntityProviderTransformsExtensionPoint = ldapOrgEntityProviderTransformsExtensionPoint;
//# sourceMappingURL=module.cjs.js.map
