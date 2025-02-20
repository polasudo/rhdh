'use strict';

var createRecord = require('./create-record.cjs.js');
var deleteRecord = require('./delete-record.cjs.js');
var modifyRecord = require('./modify-record.cjs.js');
var retrieveRecord = require('./retrieve-record.cjs.js');
var retrieveRecords = require('./retrieve-records.cjs.js');
var updateRecord = require('./update-record.cjs.js');

function createTableActions(options) {
  return [
    createRecord.createRecordAction(options),
    deleteRecord.deleteRecordAction(options),
    modifyRecord.modifyRecordAction(options),
    retrieveRecord.retrieveRecordAction(options),
    retrieveRecords.retrieveRecordsAction(options),
    updateRecord.updateRecordAction(options)
  ];
}

exports.createRecordAction = createRecord.createRecordAction;
exports.deleteRecordAction = deleteRecord.deleteRecordAction;
exports.modifyRecordAction = modifyRecord.modifyRecordAction;
exports.retrieveRecordAction = retrieveRecord.retrieveRecordAction;
exports.retrieveRecordsAction = retrieveRecords.retrieveRecordsAction;
exports.updateRecordAction = updateRecord.updateRecordAction;
exports.createTableActions = createTableActions;
//# sourceMappingURL=index.cjs.js.map
