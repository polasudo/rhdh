'use strict';

var permissions = require('./permissions.cjs.js');

const ANNOTATION_CLUSTER_ID = "janus-idp.io/ocm-cluster-id";
const ANNOTATION_PROVIDER_ID = "janus-idp.io/ocm-provider-id";

exports.ocmClusterReadPermission = permissions.ocmClusterReadPermission;
exports.ocmEntityPermissions = permissions.ocmEntityPermissions;
exports.ocmEntityReadPermission = permissions.ocmEntityReadPermission;
exports.ANNOTATION_CLUSTER_ID = ANNOTATION_CLUSTER_ID;
exports.ANNOTATION_PROVIDER_ID = ANNOTATION_PROVIDER_ID;
//# sourceMappingURL=index.cjs.js.map
