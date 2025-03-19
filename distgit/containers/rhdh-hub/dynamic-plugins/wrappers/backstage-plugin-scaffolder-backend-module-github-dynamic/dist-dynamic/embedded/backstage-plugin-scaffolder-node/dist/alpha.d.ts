/// <reference types="node" />
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';
import { TemplateAction, TaskBroker, TemplateFilter as TemplateFilter$1, TemplateGlobal as TemplateGlobal$1 } from '@backstage/plugin-scaffolder-node';
import { z } from 'zod';
import { T as TemplateFilter, a as TemplateGlobal } from './types/types.d-C0fXdKnD.js';
import { JsonValue } from '@backstage/types';

/** @alpha */
type TemplateFilterSchema<Args extends z.ZodTuple<[z.ZodType<JsonValue>] | [z.ZodType<JsonValue>, ...(z.ZodType<JsonValue> | z.ZodUnknown)[]], z.ZodType<JsonValue> | z.ZodUnknown | null>, Result extends z.ZodType<JsonValue> | z.ZodUndefined> = (zod: typeof z) => z.ZodFunction<Args, Result>;
/** @alpha */
type TemplateFilterExample = {
    description?: string;
    example: string;
    notes?: string;
};
/** @alpha */
type CreatedTemplateFilter<TSchema extends TemplateFilterSchema<any, any> | undefined | unknown = unknown, TFilterSchema extends TSchema extends TemplateFilterSchema<any, any> ? z.infer<ReturnType<TSchema>> : TSchema extends unknown ? unknown : TemplateFilter = TSchema extends TemplateFilterSchema<any, any> ? z.infer<ReturnType<TSchema>> : TSchema extends unknown ? unknown : TemplateFilter> = {
    id: string;
    description?: string;
    examples?: TemplateFilterExample[];
    schema?: TSchema;
    filter: TFilterSchema;
};

/**
 * This function is used to create new template filters in type-safe manner.
 * @alpha
 */
declare const createTemplateFilter: <TSchema extends TemplateFilterSchema<any, any> | undefined, TFunctionSchema extends TSchema extends TemplateFilterSchema<any, any> ? z.TypeOf<ReturnType<TSchema>> : (arg: JsonValue, ...rest: JsonValue[]) => JsonValue | undefined>(filter: CreatedTemplateFilter<TSchema, TFunctionSchema>) => CreatedTemplateFilter<unknown, unknown>;

/** @alpha */
type CreatedTemplateGlobalValue<T extends JsonValue = JsonValue> = {
    id: string;
    value: T;
    description?: string;
};
/** @alpha */
type TemplateGlobalFunctionSchema<Args extends z.ZodTuple<[
] | [z.ZodType<JsonValue>, ...(z.ZodType<JsonValue> | z.ZodUnknown)[]], z.ZodType<JsonValue> | z.ZodUnknown | null>, Result extends z.ZodType<JsonValue> | z.ZodUndefined> = (zod: typeof z) => z.ZodFunction<Args, Result>;
/** @alpha */
type TemplateGlobalFunctionExample = {
    description?: string;
    example: string;
    notes?: string;
};
/** @alpha */
type CreatedTemplateGlobalFunction<TSchema extends TemplateGlobalFunctionSchema<any, any> | undefined | unknown = unknown, TFilterSchema extends TSchema extends TemplateGlobalFunctionSchema<any, any> ? z.infer<ReturnType<TSchema>> : TSchema extends unknown ? unknown : Exclude<TemplateGlobal, JsonValue> = TSchema extends TemplateGlobalFunctionSchema<any, any> ? z.infer<ReturnType<TSchema>> : TSchema extends unknown ? unknown : Exclude<TemplateGlobal, JsonValue>> = {
    id: string;
    description?: string;
    examples?: TemplateGlobalFunctionExample[];
    schema?: TSchema;
    fn: TFilterSchema;
};
/** @alpha */
type CreatedTemplateGlobal = CreatedTemplateGlobalValue | CreatedTemplateGlobalFunction<unknown, unknown>;

/**
 * This function is used to create new template global values in type-safe manner.
 * @param t - CreatedTemplateGlobalValue | CreatedTemplateGlobalFunction
 * @returns t
 * @alpha
 */
declare const createTemplateGlobalValue: (v: CreatedTemplateGlobalValue) => CreatedTemplateGlobalValue;
/**
 * This function is used to create new template global functions in type-safe manner.
 * @param fn - CreatedTemplateGlobalFunction
 * @returns fn
 * @alpha
 */
declare const createTemplateGlobalFunction: <TSchema extends TemplateGlobalFunctionSchema<any, any> | undefined, TFilterSchema extends TSchema extends TemplateGlobalFunctionSchema<any, any> ? z.TypeOf<ReturnType<TSchema>> : (...args: JsonValue[]) => JsonValue | undefined>(fn: CreatedTemplateGlobalFunction<TSchema, TFilterSchema>) => CreatedTemplateGlobalFunction<any, any>;

/**
 * Serializes provided path into tar archive
 *
 * @alpha
 */
declare const serializeWorkspace: (opts: {
    path: string;
}) => Promise<{
    contents: Buffer;
}>;
/**
 * Rehydrates the provided buffer of tar archive into the provide destination path
 *
 * @alpha
 */
declare const restoreWorkspace: (opts: {
    path: string;
    buffer?: Buffer;
}) => Promise<void>;

/**
 * Extension point for managing scaffolder actions.
 *
 * @alpha
 */
interface ScaffolderActionsExtensionPoint {
    addActions(...actions: TemplateAction<any, any>[]): void;
}
/**
 * Extension point for managing scaffolder actions.
 *
 * @alpha
 */
declare const scaffolderActionsExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<ScaffolderActionsExtensionPoint>;
/**
 * Extension point for replacing the scaffolder task broker.
 *
 * @alpha
 */
interface ScaffolderTaskBrokerExtensionPoint {
    setTaskBroker(taskBroker: TaskBroker): void;
}
/**
 * Extension point for replacing the scaffolder task broker.
 *
 * @alpha
 */
declare const scaffolderTaskBrokerExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<ScaffolderTaskBrokerExtensionPoint>;
/**
 * Extension point for adding template filters and globals.
 *
 * @alpha
 */
interface ScaffolderTemplatingExtensionPoint {
    addTemplateFilters(filters: Record<string, TemplateFilter$1> | CreatedTemplateFilter[]): void;
    addTemplateGlobals(globals: Record<string, TemplateGlobal$1> | CreatedTemplateGlobal[]): void;
}
/**
 * Extension point for adding template filters and globals.
 *
 * @alpha
 */
declare const scaffolderTemplatingExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<ScaffolderTemplatingExtensionPoint>;
/**
 * Autocomplete handler for the scaffolder.
 * @alpha
 */
type AutocompleteHandler = ({ resource, token, context, }: {
    resource: string;
    token: string;
    context: Record<string, string>;
}) => Promise<{
    results: {
        title?: string;
        id: string;
    }[];
}>;
/**
 * Extension point for adding autocomplete handler providers
 * @alpha
 */
interface ScaffolderAutocompleteExtensionPoint {
    addAutocompleteProvider({ id, handler, }: {
        id: string;
        handler: AutocompleteHandler;
    }): void;
}
/**
 * Extension point for adding autocomplete handlers.
 *
 * @alpha
 */
declare const scaffolderAutocompleteExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<ScaffolderAutocompleteExtensionPoint>;
/**
 * This provider has to be implemented to make it possible to serialize/deserialize scaffolder workspace.
 *
 * @alpha
 */
interface WorkspaceProvider {
    serializeWorkspace({ path, taskId, }: {
        path: string;
        taskId: string;
    }): Promise<void>;
    cleanWorkspace(options: {
        taskId: string;
    }): Promise<void>;
    rehydrateWorkspace(options: {
        taskId: string;
        targetPath: string;
    }): Promise<void>;
}
/**
 * Extension point for adding workspace providers.
 *
 * @alpha
 */
interface ScaffolderWorkspaceProviderExtensionPoint {
    addProviders(providers: Record<string, WorkspaceProvider>): void;
}
/**
 * Extension point for adding workspace providers.
 *
 * @alpha
 */
declare const scaffolderWorkspaceProviderExtensionPoint: _backstage_backend_plugin_api.ExtensionPoint<ScaffolderWorkspaceProviderExtensionPoint>;

export { type AutocompleteHandler, type CreatedTemplateFilter, type CreatedTemplateGlobal, type CreatedTemplateGlobalFunction, type CreatedTemplateGlobalValue, type ScaffolderActionsExtensionPoint, type ScaffolderAutocompleteExtensionPoint, type ScaffolderTaskBrokerExtensionPoint, type ScaffolderTemplatingExtensionPoint, type ScaffolderWorkspaceProviderExtensionPoint, TemplateFilter, type TemplateFilterExample, type TemplateFilterSchema, TemplateGlobal, type TemplateGlobalFunctionExample, type TemplateGlobalFunctionSchema, type WorkspaceProvider, createTemplateFilter, createTemplateGlobalFunction, createTemplateGlobalValue, restoreWorkspace, scaffolderActionsExtensionPoint, scaffolderAutocompleteExtensionPoint, scaffolderTaskBrokerExtensionPoint, scaffolderTemplatingExtensionPoint, scaffolderWorkspaceProviderExtensionPoint, serializeWorkspace };
