import * as _backstage_plugin_permission_common from '@backstage/plugin-permission-common';

/**
 * @public
 */
type ClusterStatus = {
    available: boolean;
    reason?: string;
};
/**
 * @public
 */
type ClusterBase = {
    name: string;
};
/**
 * @public
 */
type ClusterUpdate = {
    available?: boolean;
    version?: string;
    url?: string;
};
/**
 * @public
 */
type ClusterNodesStatus = {
    status: string;
    type: string;
};
/**
 * @public
 */
type ClusterDetails = {
    consoleUrl?: string;
    kubernetesVersion?: string;
    oauthUrl?: string;
    openshiftId?: string;
    openshiftVersion?: string;
    platform?: string;
    region?: string;
    allocatableResources?: {
        cpuCores?: number;
        memorySize?: string;
        numberOfPods?: number;
    };
    availableResources?: {
        cpuCores?: number;
        memorySize?: string;
        numberOfPods?: number;
    };
    update?: ClusterUpdate;
    status: ClusterStatus;
};
/**
 * @public
 */
type Cluster = ClusterBase & ClusterDetails;
/**
 * @public
 */
type ClusterOverview = ClusterBase & {
    status: ClusterStatus;
    update: ClusterUpdate;
    platform: string;
    openshiftVersion: string;
    nodes: Array<ClusterNodesStatus>;
};

/**
 * @public
 */
declare const ocmClusterReadPermission: _backstage_plugin_permission_common.BasicPermission;
/**
 * @public
 */
declare const ocmEntityReadPermission: _backstage_plugin_permission_common.BasicPermission;
/**
 * @public
 */
declare const ocmEntityPermissions: _backstage_plugin_permission_common.BasicPermission[];

/**
 * @public
 */
declare const ANNOTATION_CLUSTER_ID = "janus-idp.io/ocm-cluster-id";
/**
 * @public
 */
declare const ANNOTATION_PROVIDER_ID = "janus-idp.io/ocm-provider-id";

export { ANNOTATION_CLUSTER_ID, ANNOTATION_PROVIDER_ID, type Cluster, type ClusterBase, type ClusterDetails, type ClusterNodesStatus, type ClusterOverview, type ClusterStatus, type ClusterUpdate, ocmClusterReadPermission, ocmEntityPermissions, ocmEntityReadPermission };
