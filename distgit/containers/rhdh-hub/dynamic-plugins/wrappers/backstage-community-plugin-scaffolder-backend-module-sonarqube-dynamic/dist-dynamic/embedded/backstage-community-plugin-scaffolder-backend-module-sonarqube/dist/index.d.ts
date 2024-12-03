import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types from '@backstage/types';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

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
declare const createSonarQubeProjectAction: () => _backstage_plugin_scaffolder_node.TemplateAction<TemplateActionParameters, _backstage_types.JsonObject>;

declare const scaffolderModuleSonarqubeActions: _backstage_backend_plugin_api.BackendFeature;

export { createSonarQubeProjectAction, scaffolderModuleSonarqubeActions as default };
