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
  return call.then((r) => {
    return r.body;
  }).catch((r) => {
    if (!r.body) {
      throw Object.assign(new Error(r.message), {
        // If there is no body, there is no status code, default to 500
        statusCode: 500,
        name: r.message
      });
    } else if (typeof r.body === "string") {
      throw Object.assign(new Error(r.body), {
        statusCode: r.body.code || r.statusCode,
        name: r.body
      });
    }
    throw Object.assign(new Error(r.body.reason), {
      // Name and statusCode are required by the backstage error handler
      statusCode: r.body.code || r.statusCode,
      name: r.body.reason,
      ...r.body
    });
  });
};
const getManagedCluster = (api, name) => {
  return kubeApiResponseHandler(
    api.getClusterCustomObject(
      "cluster.open-cluster-management.io",
      "v1",
      "managedclusters",
      name
    )
  );
};
const listManagedClusters = (api) => {
  return kubeApiResponseHandler(
    api.listClusterCustomObject(
      "cluster.open-cluster-management.io",
      "v1",
      "managedclusters"
    )
  );
};
const getManagedClusterInfo = (api, name) => {
  return kubeApiResponseHandler(
    api.getNamespacedCustomObject(
      "internal.open-cluster-management.io",
      "v1beta1",
      name,
      "managedclusterinfos",
      name
    )
  );
};
const listManagedClusterInfos = (api) => {
  return kubeApiResponseHandler(
    api.listClusterCustomObject(
      "internal.open-cluster-management.io",
      "v1beta1",
      "managedclusterinfos"
    )
  );
};

exports.getManagedCluster = getManagedCluster;
exports.getManagedClusterInfo = getManagedClusterInfo;
exports.hubApiClient = hubApiClient;
exports.listManagedClusterInfos = listManagedClusterInfos;
exports.listManagedClusters = listManagedClusters;
//# sourceMappingURL=kubernetes.cjs.js.map
