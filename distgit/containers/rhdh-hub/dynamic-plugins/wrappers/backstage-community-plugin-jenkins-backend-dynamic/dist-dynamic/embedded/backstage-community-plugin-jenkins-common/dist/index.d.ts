import * as _backstage_plugin_permission_common from '@backstage/plugin-permission-common';

/**
 * This permission is used to determine if a user is allowed to execute an action in jenkins plugin
 *
 * @public
 */
declare const jenkinsExecutePermission: _backstage_plugin_permission_common.ResourcePermission<"catalog-entity">;
/**
 * List of all Jenkins permissions
 *
 * @public
 */
declare const jenkinsPermissions: _backstage_plugin_permission_common.ResourcePermission<"catalog-entity">[];

export { jenkinsExecutePermission, jenkinsPermissions };
