import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types from '@backstage/types';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

type TemplateActionParameters = {
    name: string;
    visibility: string;
    description: string;
    token: string;
    baseUrl?: string;
    namespace?: string;
    repoKind?: string;
};
declare function createQuayRepositoryAction(): _backstage_plugin_scaffolder_node.TemplateAction<TemplateActionParameters, _backstage_types.JsonObject>;

declare const scaffolderModuleQuayAction: _backstage_backend_plugin_api.BackendFeature;

export { createQuayRepositoryAction, scaffolderModuleQuayAction as default };
