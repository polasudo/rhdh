'use strict';

var router = require('./service/router.cjs.js');
var processor = require('./processor/processor.cjs.js');
var plugin = require('./plugin.cjs.js');



exports.createRouter = router.createRouter;
exports.GitlabFillerProcessor = processor.GitlabFillerProcessor;
exports.catalogPluginGitlabFillerProcessorModule = plugin.catalogPluginGitlabFillerProcessorModule;
exports.gitlabPlugin = plugin.gitlabPlugin;
//# sourceMappingURL=index.cjs.js.map
