'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('./actions/servicenow/index.cjs.js');
var module$1 = require('./module.cjs.js');
var createRecord = require('./actions/servicenow/now/table/create-record.cjs.js');
var deleteRecord = require('./actions/servicenow/now/table/delete-record.cjs.js');
var modifyRecord = require('./actions/servicenow/now/table/modify-record.cjs.js');
var retrieveRecord = require('./actions/servicenow/now/table/retrieve-record.cjs.js');
var retrieveRecords = require('./actions/servicenow/now/table/retrieve-records.cjs.js');
var updateRecord = require('./actions/servicenow/now/table/update-record.cjs.js');
var index$2 = require('./actions/servicenow/now/table/index.cjs.js');
var index$1 = require('./actions/servicenow/now/index.cjs.js');



exports.createServiceNowActions = index.createServiceNowActions;
exports.default = module$1.scaffolderModuleServicenowActions;
exports.createRecordAction = createRecord.createRecordAction;
exports.deleteRecordAction = deleteRecord.deleteRecordAction;
exports.modifyRecordAction = modifyRecord.modifyRecordAction;
exports.retrieveRecordAction = retrieveRecord.retrieveRecordAction;
exports.retrieveRecordsAction = retrieveRecords.retrieveRecordsAction;
exports.updateRecordAction = updateRecord.updateRecordAction;
exports.createTableActions = index$2.createTableActions;
exports.createNowActions = index$1.createNowActions;
//# sourceMappingURL=index.cjs.js.map
