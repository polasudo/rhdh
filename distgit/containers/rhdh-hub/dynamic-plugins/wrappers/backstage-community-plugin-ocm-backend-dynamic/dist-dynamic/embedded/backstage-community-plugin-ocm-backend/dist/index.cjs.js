'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var bundle = require('./bundle.cjs.js');
var ManagedClusterProvider = require('./providers/ManagedClusterProvider.cjs.js');
var module$1 = require('./providers/module.cjs.js');
var router = require('./service/router.cjs.js');



exports.default = bundle.bundle;
exports.ManagedClusterProvider = ManagedClusterProvider.ManagedClusterProvider;
exports.catalogModuleOCMEntityProvider = module$1.catalogModuleOCMEntityProvider;
exports.ocmPlugin = router.ocmPlugin;
//# sourceMappingURL=index.cjs.js.map
