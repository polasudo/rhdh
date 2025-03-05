import { Config } from '@backstage/config';
import { Logger } from 'winston';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { LoggerService } from '@backstage/backend-plugin-api';
import { TemplateAction } from '@backstage/plugin-scaffolder-node';

declare const createArgoCdResources: (config: Config, logger: Logger | LoggerService) => TemplateAction<{
    argoInstance: string;
    namespace: string;
    projectName?: string;
    appName: string;
    repoUrl: string;
    path: string;
    labelValue?: string;
}>;

/**
 * @public
 * The Roadie Module for the Scaffolder Backend ArgoCD Actions
 */
declare const scaffolderBackendArgoCD: _backstage_backend_plugin_api.BackendFeature;

export { createArgoCdResources, scaffolderBackendArgoCD as default };
