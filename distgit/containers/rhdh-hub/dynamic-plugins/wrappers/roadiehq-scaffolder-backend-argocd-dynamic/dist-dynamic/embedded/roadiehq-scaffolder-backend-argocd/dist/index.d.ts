import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types from '@backstage/types';
import { Config } from '@backstage/config';
import { Logger } from 'winston';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

declare const createArgoCdResources: (config: Config, logger: Logger) => _backstage_plugin_scaffolder_node.TemplateAction<{
    argoInstance: string;
    namespace: string;
    projectName?: string;
    appName: string;
    repoUrl: string;
    path: string;
    labelValue?: string;
}, _backstage_types.JsonObject>;

/**
 * @public
 * The Roadie Module for the Scaffolder Backend ArgoCD Actions
 */
declare const scaffolderBackendArgoCD: _backstage_backend_plugin_api.BackendFeatureCompat;

export { createArgoCdResources, scaffolderBackendArgoCD as default };
