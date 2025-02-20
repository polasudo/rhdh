import * as _backstage_plugin_scaffolder_node from '@backstage/plugin-scaffolder-node';
import * as _backstage_types from '@backstage/types';
import { ToStringOptions } from 'yaml';
export { default } from './new-backend.js';
import '@backstage/backend-plugin-api';

declare function createZipAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    outputPath: string;
}, _backstage_types.JsonObject>;

declare function createWriteFileAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    content: string;
    preserveFormatting?: boolean;
}, _backstage_types.JsonObject>;

declare function createAppendFileAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    content: string;
}, _backstage_types.JsonObject>;

declare function createParseFileAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    parser?: "yaml" | "json" | "multiyaml";
}, _backstage_types.JsonObject>;

declare function createReplaceInFileAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    files: Array<{
        file: string;
        find: string;
        matchRegex: boolean;
        replaceWith: string;
    }>;
}, _backstage_types.JsonObject>;

type stringifyOptions = Omit<ToStringOptions, 'commentString'>;

declare function createMergeJSONAction({ actionId }: {
    actionId?: string;
}): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    content: any;
    mergeArrays?: boolean;
    matchFileIndent?: boolean;
}, _backstage_types.JsonObject>;
declare function createMergeAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    content: any;
    mergeArrays?: boolean;
    preserveYamlComments?: boolean;
    options?: stringifyOptions;
}, _backstage_types.JsonObject>;

declare function createSleepAction(options?: {
    maxSleep?: number;
}): _backstage_plugin_scaffolder_node.TemplateAction<{
    amount: number;
}, _backstage_types.JsonObject>;

declare function createJSONataAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    data: any;
    expression: string;
}, _backstage_types.JsonObject>;

declare function createYamlJSONataTransformAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    expression: string;
    options?: stringifyOptions;
    loadAll?: boolean;
    as?: "string" | "object";
}, _backstage_types.JsonObject>;

declare function createJsonJSONataTransformAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    path: string;
    expression: string;
    replacer?: string[];
    space?: string;
    as?: "string" | "object";
}, _backstage_types.JsonObject>;

declare function createSerializeJsonAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    data: any;
    replacer?: string[];
    space?: string;
}, _backstage_types.JsonObject>;

declare function createSerializeYamlAction(): _backstage_plugin_scaffolder_node.TemplateAction<{
    data: any;
    options?: stringifyOptions;
}, _backstage_types.JsonObject>;

export { createAppendFileAction, createJSONataAction, createJsonJSONataTransformAction, createMergeAction, createMergeJSONAction, createParseFileAction, createReplaceInFileAction, createSerializeJsonAction, createSerializeYamlAction, createSleepAction, createWriteFileAction, createYamlJSONataTransformAction, createZipAction };
