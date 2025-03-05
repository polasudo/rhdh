import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types_index from '@backstage/types/index';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

/**
 * @public
 */
type TemplateActionParameters = {
    name: string;
    visibility: string;
    description: string;
    token: string;
    baseUrl?: string;
    namespace?: string;
    repoKind?: string;
};
/**
 * @public
 */
declare function createQuayRepositoryAction(): _backstage_plugin_scaffolder_node.TemplateAction<TemplateActionParameters, _backstage_types_index.JsonObject>;

/**
 * @public
 */
declare const scaffolderModuleQuayAction: _backstage_backend_plugin_api.BackendFeature;

export { type TemplateActionParameters, createQuayRepositoryAction, scaffolderModuleQuayAction as default };
