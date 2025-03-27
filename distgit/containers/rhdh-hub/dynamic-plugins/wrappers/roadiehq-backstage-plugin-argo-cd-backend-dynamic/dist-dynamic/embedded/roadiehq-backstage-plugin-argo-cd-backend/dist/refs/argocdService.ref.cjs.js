'use strict';

var backendPluginApi = require('@backstage/backend-plugin-api');
var argocd_service = require('../service/argocd.service.cjs.js');

const argocdServiceRef = backendPluginApi.createServiceRef({
  id: "argocd-service-backend",
  defaultFactory: async (service) => backendPluginApi.createServiceFactory({
    service,
    deps: {
      config: backendPluginApi.coreServices.rootConfig,
      logger: backendPluginApi.coreServices.logger
    },
    async factory({ config, logger }) {
      const argoUserName = config.getOptionalString("argocd.username") ?? "argocdUsername";
      const argoPassword = config.getOptionalString("argocd.password") ?? "argocdPassword";
      return new argocd_service.ArgoService(argoUserName, argoPassword, config, logger);
    }
  })
});

exports.argocdServiceRef = argocdServiceRef;
//# sourceMappingURL=argocdService.ref.cjs.js.map
