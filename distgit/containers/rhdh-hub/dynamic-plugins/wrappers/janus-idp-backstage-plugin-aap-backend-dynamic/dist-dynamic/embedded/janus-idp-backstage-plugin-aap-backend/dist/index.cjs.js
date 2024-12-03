'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var AapResourceConnector = require('./clients/AapResourceConnector.cjs.js');
var module$1 = require('./module.cjs.js');
var AapResourceEntityProvider = require('./providers/AapResourceEntityProvider.cjs.js');



exports.listJobTemplates = AapResourceConnector.listJobTemplates;
exports.listWorkflowJobTemplates = AapResourceConnector.listWorkflowJobTemplates;
exports.default = module$1.catalogModuleAapResourceEntityProvider;
exports.AapResourceEntityProvider = AapResourceEntityProvider.AapResourceEntityProvider;
//# sourceMappingURL=index.cjs.js.map
