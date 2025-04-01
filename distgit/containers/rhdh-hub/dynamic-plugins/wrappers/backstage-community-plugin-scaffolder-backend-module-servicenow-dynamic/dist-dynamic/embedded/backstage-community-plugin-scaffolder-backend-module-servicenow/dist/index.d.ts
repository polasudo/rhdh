import { TemplateAction } from '@backstage/plugin-scaffolder-node';
import { Config } from '@backstage/config';
import * as _backstage_backend_plugin_api from '@backstage/backend-plugin-api';

/**
 * @public
 */
type CreateActionOptions = {
    config: Config;
};

/**
 * Creates an action handler that inserts one record in the specified table.
 * @public
 * @param options - options to configure the action
 * @returns TemplateAction - an action handler
 */
declare const createRecordAction: (options: CreateActionOptions) => TemplateAction;

/**
 * Creates an action handler that deletes the specified record from the specified table.
 * @public
 * @param options - options to configure the action
 * @returns TemplateAction - an action handler
 */
declare const deleteRecordAction: (options: CreateActionOptions) => TemplateAction;

/**
 * Creates an action handler that modifies a record in the specified table.
 * @public
 * @param options - options to configure the action
 * @returns TemplateAction - an action handler
 */
declare const modifyRecordAction: (options: CreateActionOptions) => TemplateAction;

/**
 * Creates an action handler that retrieves the record identified by the specified sys_id from the specified table.
 * @public
 * @param options - options to configure the action
 * @returns TemplateAction - an action handler
 */
declare const retrieveRecordAction: (options: CreateActionOptions) => TemplateAction;

/**
 * Creates an action handler that retrieves multiple records for the specified table.
 * @public
 * @param options - options to configure the action
 * @returns TemplateAction - an action handler
 */
declare const retrieveRecordsAction: (options: CreateActionOptions) => TemplateAction;

/**
 * Creates an action handler that updates a record in the specified table.
 * @public
 * @param options - options to configure the action
 * @returns TemplateAction - an action handler
 */
declare const updateRecordAction: (options: CreateActionOptions) => TemplateAction;

/**
 * Returns all ServiceNow `now` namespace `Table API` actions.
 * @public
 * @returns TemplateAction[]
 */
declare function createTableActions(options: CreateActionOptions): TemplateAction[];

/**
 * Returns all ServiceNow `now` namespace actions.
 * @public
 * @returns TemplateAction[]
 */
declare function createNowActions(options: CreateActionOptions): TemplateAction[];

/**
 * Returns all ServiceNow actions.
 * @public
 * @returns TemplateAction[]
 */
declare function createServiceNowActions(options: CreateActionOptions): TemplateAction[];

/**
 * @public
 */
declare const scaffolderModuleServicenowActions: _backstage_backend_plugin_api.BackendFeature;

export { type CreateActionOptions, createNowActions, createRecordAction, createServiceNowActions, createTableActions, scaffolderModuleServicenowActions as default, deleteRecordAction, modifyRecordAction, retrieveRecordAction, retrieveRecordsAction, updateRecordAction };
