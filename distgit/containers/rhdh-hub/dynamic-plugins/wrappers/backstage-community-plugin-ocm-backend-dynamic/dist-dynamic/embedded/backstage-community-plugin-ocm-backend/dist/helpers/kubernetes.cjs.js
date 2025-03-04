'use strict';

var clientNode = require('@kubernetes/client-node');

const hubApiClient = (clusterConfig, logger) => {
  const kubeConfig = new clientNode.KubeConfig();
  if (!clusterConfig.serviceAccountToken) {
    logger.info("Using default kubernetes config");
    kubeConfig.loadFromDefault();
    return kubeConfig.makeApiClient(clientNode.CustomObjectsApi);
  }
  logger.info("Loading kubernetes config from config file");
  const user = {
    name: "backstage",
    token: clusterConfig.serviceAccountToken
  };
  const context = {
    name: clusterConfig.hubResourceName,
    user: user.name,
    cluster: clusterConfig.hubResourceName
  };
  kubeConfig.loadFromOptions({
    clusters: [
      {
        server: clusterConfig.url,
        name: clusterConfig.hubResourceName,
        skipTLSVerify: clusterConfig.skipTLSVerify,
        caData: clusterConfig.caData
      }
    ],
    users: [user],
    contexts: [context],
    currentContext: context.name
  });
  return kubeConfig.makeApiClient(clientNode.CustomObjectsApi);
};
const kubeApiResponseHandler = (call) => {
  return call.catch((e) => {
    if ("body" in e && typeof e.body === "string") {
      let body;
      try {
        body = JSON.parse(e.body);
      } catch (error) {
      }
      if (body) {
        throw Object.assign(new Error(body.reason), {
          // Name and statusCode are required by the backstage error handler
          statusCode: body.code,
          name: body.reason,
          ...body
        });
      }
    }
    throw Object.assign(new Error(e.message), {
      // If there is no body, default to 500
      statusCode: 500,
      name: e.message
    });
  });
};
const getManagedCluster = (api, name) => {
  return kubeApiResponseHandler(
    api.getClusterCustomObject({
      plural: "managedclusters",
      version: "v1",
      group: "cluster.open-cluster-management.io",
      name
    })
  );
};
const listManagedClusters = (api) => {
  return kubeApiResponseHandler(
    api.listClusterCustomObject({
      group: "cluster.open-cluster-management.io",
      version: "v1",
      plural: "managedclusters"
    })
  );
};
const getManagedClusterInfo = (api, name) => {
  return kubeApiResponseHandler(
    api.getNamespacedCustomObject({
      group: "internal.open-cluster-management.io",
      version: "v1beta1",
      name,
      namespace: name,
      plural: "managedclusterinfos"
    })
  );
};
const listManagedClusterInfos = (api) => {
  return kubeApiResponseHandler(
    api.listClusterCustomObject({
      group: "internal.open-cluster-management.io",
      version: "v1beta1",
      plural: "managedclusterinfos"
    })
  );
};

exports.getManagedCluster = getManagedCluster;
exports.getManagedClusterInfo = getManagedClusterInfo;
exports.hubApiClient = hubApiClient;
exports.listManagedClusterInfos = listManagedClusterInfos;
exports.listManagedClusters = listManagedClusters;
//# sourceMappingURL=kubernetes.cjs.js.map
