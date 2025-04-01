'use strict';

var index = require('./now/index.cjs.js');

function createServiceNowActions(options) {
  return [...index.createNowActions(options)];
}

exports.createNowActions = index.createNowActions;
exports.createServiceNowActions = createServiceNowActions;
//# sourceMappingURL=index.cjs.js.map
