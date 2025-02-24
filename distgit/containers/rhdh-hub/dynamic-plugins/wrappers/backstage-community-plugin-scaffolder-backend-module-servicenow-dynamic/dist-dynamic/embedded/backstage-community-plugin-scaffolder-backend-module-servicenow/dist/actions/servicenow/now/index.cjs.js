'use strict';

var index = require('./table/index.cjs.js');

function createNowActions(options) {
  return [...index.createTableActions(options)];
}

exports.createTableActions = index.createTableActions;
exports.createNowActions = createNowActions;
//# sourceMappingURL=index.cjs.js.map
