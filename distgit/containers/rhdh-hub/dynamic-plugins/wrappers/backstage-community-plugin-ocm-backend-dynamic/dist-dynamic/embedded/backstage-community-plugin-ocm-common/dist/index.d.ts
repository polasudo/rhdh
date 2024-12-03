import * as _backstage_plugin_permission_common from '@backstage/plugin-permission-common';

type ClusterStatus = {
    available: boolean;
    reason?: string;
};
type ClusterBase = {
    name: string;
};
type ClusterUpdate = {
    available?: boolean;
    version?: string;
    url?: string;
};
type ClusterNodesStatus = {
    status: string;
    type: string;
};
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
type Cluster = ClusterBase & ClusterDetails;
type ClusterOverview = ClusterBase & {
    status: ClusterStatus;
    update: ClusterUpdate;
    platform: string;
    openshiftVersion: string;
    nodes: Array<ClusterNodesStatus>;
};

declare const ocmClusterReadPermission: _backstage_plugin_permission_common.BasicPermission;
declare const ocmEntityReadPermission: _backstage_plugin_permission_common.BasicPermission;
declare const ocmEntityPermissions: _backstage_plugin_permission_common.BasicPermission[];

declare const ANNOTATION_CLUSTER_ID = "janus-idp.io/ocm-cluster-id";
declare const ANNOTATION_PROVIDER_ID = "janus-idp.io/ocm-provider-id";

export { ANNOTATION_CLUSTER_ID, ANNOTATION_PROVIDER_ID, type Cluster, type ClusterBase, type ClusterDetails, type ClusterNodesStatus, type ClusterOverview, type ClusterStatus, type ClusterUpdate, ocmClusterReadPermission, ocmEntityPermissions, ocmEntityReadPermission };
