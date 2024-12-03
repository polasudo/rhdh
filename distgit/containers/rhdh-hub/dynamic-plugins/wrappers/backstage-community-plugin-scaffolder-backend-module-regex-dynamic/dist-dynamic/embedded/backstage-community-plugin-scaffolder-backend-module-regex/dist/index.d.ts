import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types from '@backstage/types';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

declare const createReplaceAction: () => _backstage_plugin_scaffolder_node.TemplateAction<{
    regExps: {
        values: {
            value: string;
            key: string;
        }[];
        pattern: string;
        replacement: string;
        flags?: ("g" | "m" | "i" | "y" | "u" | "s" | "d")[] | undefined;
    }[];
}, _backstage_types.JsonObject>;

declare const scaffolderModuleRegexActions: _backstage_backend_plugin_api.BackendFeature;

export { createReplaceAction, scaffolderModuleRegexActions as default };
