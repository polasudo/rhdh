'use strict';

var semver = require('semver');
var constants = require('../constants.cjs.js');

const convertCpus = (cpus) => {
  if (!cpus) {
    return undefined;
  }
  if (cpus.endsWith("m")) {
    return parseInt(cpus.slice(0, cpus.length - 1), 10) / 1e3;
  }
  return parseInt(cpus, 10);
};
const parseResources = (resources) => ({
  cpuCores: convertCpus(resources?.cpu),
  memorySize: resources?.memory,
  numberOfPods: parseInt(resources?.pods, 10) || undefined
});
const getClaim = (cluster, claimName) => cluster.status?.clusterClaims?.find((value) => value.name === claimName)?.value ?? "";
const parseClusterStatus = (mc) => {
  const available = mc.status?.conditions.find(
    (value) => value.type === "ManagedClusterConditionAvailable"
  );
  return {
    available: available?.status.toLowerCase() === "true",
    reason: available?.message
  };
};
const parseManagedCluster = (mc) => ({
  status: parseClusterStatus(mc),
  consoleUrl: getClaim(mc, constants.CONSOLE_CLAIM),
  kubernetesVersion: getClaim(mc, "kubeversion.open-cluster-management.io"),
  oauthUrl: getClaim(mc, "oauthredirecturis.openshift.io"),
  openshiftId: mc.metadata.labels?.clusterID ?? getClaim(mc, "id.openshift.io"),
  openshiftVersion: mc.metadata.labels?.openshiftVersion ?? getClaim(mc, "version.openshift.io"),
  platform: getClaim(mc, "platform.open-cluster-management.io"),
  region: getClaim(mc, "region.open-cluster-management.io"),
  allocatableResources: parseResources(mc.status?.allocatable || {}),
  availableResources: parseResources(mc.status?.capacity || {})
});
const parseUpdateInfo = (clusterInfo) => {
  const { availableUpdates, versionAvailableUpdates } = clusterInfo.status?.distributionInfo.ocp || {};
  if (!availableUpdates || availableUpdates?.length === 0 || !versionAvailableUpdates || versionAvailableUpdates?.length === 0) {
    return {
      update: {
        available: false
      }
    };
  }
  const version = semver.maxSatisfying(availableUpdates, "*");
  return {
    update: {
      available: true,
      version,
      url: versionAvailableUpdates[availableUpdates.indexOf(version)]?.url
    }
  };
};
const parseNodeStatus = (clusterInfo) => clusterInfo.status?.nodeList?.map((node) => {
  if (node.conditions.length !== 1) {
    throw new Error("Found more node conditions then one");
  }
  const condition = node.conditions[0];
  return {
    status: condition.status,
    type: condition.type
  };
}) || [];
const translateResourceToOCM = (clusterName, hubResourceName) => clusterName === hubResourceName ? constants.HUB_CLUSTER_NAME_IN_OCM : clusterName;
const translateOCMToResource = (clusterName, hubResourceName) => clusterName === constants.HUB_CLUSTER_NAME_IN_OCM ? hubResourceName : clusterName;

exports.getClaim = getClaim;
exports.parseClusterStatus = parseClusterStatus;
exports.parseManagedCluster = parseManagedCluster;
exports.parseNodeStatus = parseNodeStatus;
exports.parseResources = parseResources;
exports.parseUpdateInfo = parseUpdateInfo;
exports.translateOCMToResource = translateOCMToResource;
exports.translateResourceToOCM = translateResourceToOCM;
//# sourceMappingURL=parser.cjs.js.map
