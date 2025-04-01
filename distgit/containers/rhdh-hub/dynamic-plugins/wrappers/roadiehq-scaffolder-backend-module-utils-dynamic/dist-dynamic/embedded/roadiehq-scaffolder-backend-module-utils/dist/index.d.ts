import { TemplateAction } from '@backstage/plugin-scaffolder-node';
import { ToStringOptions } from 'yaml';
import { JsonObject } from '@backstage/config/index';
export { default } from './new-backend.js';
import '@backstage/backend-plugin-api';

declare function createZipAction(): TemplateAction<{
    path: string;
    outputPath: string;
}>;

declare function createWriteFileAction(): TemplateAction<{
    path: string;
    content: string;
    preserveFormatting?: boolean;
}>;

declare function createAppendFileAction(): TemplateAction<{
    path: string;
    content: string;
}>;

declare function createParseFileAction(): TemplateAction<{
    path: string;
    parser?: 'yaml' | 'json' | 'multiyaml';
}>;

declare function createReplaceInFileAction(): TemplateAction<{
    files: Array<{
        file: string;
        find: string;
        matchRegex: boolean;
        replaceWith: string;
    }>;
}>;

type stringifyOptions = Omit<ToStringOptions, 'commentString'>;

declare function createMergeJSONAction({ actionId, }: {
    actionId?: string;
}): TemplateAction<{
    path: string;
    content: any;
    mergeArrays?: boolean;
    matchFileIndent?: boolean;
}>;
declare function createMergeAction(): TemplateAction<{
    path: string;
    content: any;
    useDocumentIncludingField?: {
        key: string;
        value: string;
    };
    mergeArrays?: boolean;
    preserveYamlComments?: boolean;
    options?: stringifyOptions;
}>;

declare function createSleepAction(options?: {
    maxSleep?: number;
}): TemplateAction<{
    amount: number;
}>;

declare function createJSONataAction(): TemplateAction<{
    data: any;
    expression: string;
}>;

declare function createYamlJSONataTransformAction(): TemplateAction<{
    path: string;
    expression: string;
    options?: stringifyOptions;
    loadAll?: boolean;
    as?: 'string' | 'object';
}>;

declare function createJsonJSONataTransformAction(): TemplateAction<{
    path: string;
    expression: string;
    replacer?: string[];
    space?: string;
    as?: 'string' | 'object';
}, JsonObject>;

declare function createSerializeJsonAction(): TemplateAction<{
    data: any;
    replacer?: string[];
    space?: string;
}>;

declare function createSerializeYamlAction(): TemplateAction<{
    data: any;
    options?: stringifyOptions;
}>;

export { createAppendFileAction, createJSONataAction, createJsonJSONataTransformAction, createMergeAction, createMergeJSONAction, createParseFileAction, createReplaceInFileAction, createSerializeJsonAction, createSerializeYamlAction, createSleepAction, createWriteFileAction, createYamlJSONataTransformAction, createZipAction };
