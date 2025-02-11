import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types_index from '@backstage/types/index';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

/**
 * @public
 */
type TemplateActionParameters = {
    baseUrl: string;
    token?: string;
    username?: string;
    password?: string;
    name: string;
    key: string;
    branch?: string;
    visibility?: string;
};
/**
 * @public
 */
declare const createSonarQubeProjectAction: () => _backstage_plugin_scaffolder_node.TemplateAction<TemplateActionParameters, _backstage_types_index.JsonObject>;

/**
 * @public
 */
declare const scaffolderModuleSonarqubeActions: _backstage_backend_plugin_api.BackendFeature;

export { type TemplateActionParameters, createSonarQubeProjectAction, scaffolderModuleSonarqubeActions as default };
