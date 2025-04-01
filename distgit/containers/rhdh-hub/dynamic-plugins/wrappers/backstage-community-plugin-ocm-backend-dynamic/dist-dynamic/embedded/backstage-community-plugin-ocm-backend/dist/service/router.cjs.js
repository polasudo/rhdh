'use strict';

var rootHttpRouter = require('@backstage/backend-defaults/rootHttpRouter');
var backendPluginApi = require('@backstage/backend-plugin-api');
var errors = require('@backstage/errors');
var pluginPermissionCommon = require('@backstage/plugin-permission-common');
var pluginPermissionNode = require('@backstage/plugin-permission-node');
var express = require('express');
var pluginOcmCommon = require('@backstage-community/plugin-ocm-common');
var config = require('../helpers/config.cjs.js');
var kubernetes = require('../helpers/kubernetes.cjs.js');
var parser = require('../helpers/parser.cjs.js');
var openapi_generated = require('../schema/openapi.generated.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);

async function createRouter(deps) {
  const { config: config$1, logger, httpAuth, permissions } = deps;
  const router = await openapi_generated.createOpenApiRouter();
  const permissionsIntegrationRouter = pluginPermissionNode.createPermissionIntegrationRouter({
    permissions: pluginOcmCommon.ocmEntityPermissions
  });
  router.use(express__default.default.json());
  router.use(permissionsIntegrationRouter);
  const clients = Object.fromEntries(
    config.readOcmConfigs(config$1).map((provider) => [
      provider.id,
      {
        client: kubernetes.hubApiClient(provider, logger),
        hubResourceName: provider.hubResourceName
      }
    ])
  );
  const authorize = async (request, permission) => {
    const decision = (await permissions.authorize([{ permission }], {
      credentials: await httpAuth.credentials(request)
    }))[0];
    return decision;
  };
  router.get("/status/:providerId/:clusterName", async (request, response) => {
    const decision = await authorize(request, pluginOcmCommon.ocmEntityReadPermission);
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    const { clusterName, providerId } = request.params;
    logger.debug(
      `Incoming status request for ${clusterName} cluster on ${providerId} hub`
    );
    if (!clients.hasOwnProperty(providerId)) {
      throw Object.assign(new Error("Hub not found"), {
        statusCode: 404,
        name: "HubNotFound"
      });
    }
    const normalizedClusterName = parser.translateResourceToOCM(
      clusterName,
      clients[providerId].hubResourceName
    );
    const mc = await kubernetes.getManagedCluster(
      clients[providerId].client,
      normalizedClusterName
    );
    const mci = await kubernetes.getManagedClusterInfo(
      clients[providerId].client,
      normalizedClusterName
    );
    response.send({
      name: clusterName,
      ...parser.parseManagedCluster(mc),
      ...parser.parseUpdateInfo(mci)
    });
  });
  router.get("/status", async (request, response) => {
    const decision = await authorize(request, pluginOcmCommon.ocmClusterReadPermission);
    if (decision.result === pluginPermissionCommon.AuthorizeResult.DENY) {
      throw new errors.NotAllowedError("Unauthorized");
    }
    logger.debug(`Incoming status request for all clusters`);
    const allClusters = await Promise.all(
      Object.values(clients).map(async (c) => {
        const mcs = await kubernetes.listManagedClusters(c.client);
        const mcis = await kubernetes.listManagedClusterInfos(c.client);
        return mcs.items.map((mc) => {
          const mci = mcis.items.find(
            (info) => info.metadata?.name === mc.metadata.name
          ) || {};
          return {
            name: parser.translateOCMToResource(mc.metadata.name, c.hubResourceName),
            status: parser.parseClusterStatus(mc),
            platform: parser.getClaim(mc, "platform.open-cluster-management.io"),
            openshiftVersion: mc.metadata.labels?.openshiftVersion ?? parser.getClaim(mc, "version.openshift.io"),
            nodes: parser.parseNodeStatus(mci),
            ...parser.parseUpdateInfo(mci)
          };
        });
      })
    );
    return response.send(allClusters.flat());
  });
  const middleware = rootHttpRouter.MiddlewareFactory.create({ logger, config: config$1 });
  router.use(middleware.error());
  return router;
}
const ocmPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "ocm",
  register(env) {
    env.registerInit({
      deps: {
        logger: backendPluginApi.coreServices.logger,
        config: backendPluginApi.coreServices.rootConfig,
        http: backendPluginApi.coreServices.httpRouter,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        permissions: backendPluginApi.coreServices.permissions
      },
      async init({ config, logger, http, httpAuth, permissions }) {
        http.use(await createRouter({ config, logger, httpAuth, permissions }));
      }
    });
  }
});

exports.ocmPlugin = ocmPlugin;
//# sourceMappingURL=router.cjs.js.map
