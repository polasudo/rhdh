import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types_index from '@backstage/types/index';
import { CatalogClient } from '@backstage/catalog-client';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

type TemplateActionParameters = {
    namespace: string;
    clusterRef?: string;
    url?: string;
    token: string;
    skipTLSVerify?: boolean;
    caData?: string;
    labels?: string;
};
declare function createKubernetesNamespaceAction(catalogClient: CatalogClient): _backstage_plugin_scaffolder_node.TemplateAction<TemplateActionParameters, _backstage_types_index.JsonObject>;

declare const scaffolderModuleKubernetesAction: _backstage_backend_plugin_api.BackendFeature;

export { createKubernetesNamespaceAction, scaffolderModuleKubernetesAction as default };
