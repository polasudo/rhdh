'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var catalogModuleMicrosoftGraphOrgEntityProvider = require('./module/catalogModuleMicrosoftGraphOrgEntityProvider.cjs.js');
var client = require('./microsoftGraph/client.cjs.js');
var config = require('./microsoftGraph/config.cjs.js');
var constants = require('./microsoftGraph/constants.cjs.js');
var helper = require('./microsoftGraph/helper.cjs.js');
var defaultTransformers = require('./microsoftGraph/defaultTransformers.cjs.js');
var read = require('./microsoftGraph/read.cjs.js');
var MicrosoftGraphOrgEntityProvider = require('./processors/MicrosoftGraphOrgEntityProvider.cjs.js');
var MicrosoftGraphOrgReaderProcessor = require('./processors/MicrosoftGraphOrgReaderProcessor.cjs.js');



exports.default = catalogModuleMicrosoftGraphOrgEntityProvider.catalogModuleMicrosoftGraphOrgEntityProvider;
exports.microsoftGraphOrgEntityProviderTransformExtensionPoint = catalogModuleMicrosoftGraphOrgEntityProvider.microsoftGraphOrgEntityProviderTransformExtensionPoint;
exports.MicrosoftGraphClient = client.MicrosoftGraphClient;
exports.readMicrosoftGraphConfig = config.readMicrosoftGraphConfig;
exports.readProviderConfig = config.readProviderConfig;
exports.readProviderConfigs = config.readProviderConfigs;
exports.MICROSOFT_EMAIL_ANNOTATION = constants.MICROSOFT_EMAIL_ANNOTATION;
exports.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION = constants.MICROSOFT_GRAPH_GROUP_ID_ANNOTATION;
exports.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION = constants.MICROSOFT_GRAPH_TENANT_ID_ANNOTATION;
exports.MICROSOFT_GRAPH_USER_ID_ANNOTATION = constants.MICROSOFT_GRAPH_USER_ID_ANNOTATION;
exports.normalizeEntityName = helper.normalizeEntityName;
exports.defaultGroupTransformer = defaultTransformers.defaultGroupTransformer;
exports.defaultOrganizationTransformer = defaultTransformers.defaultOrganizationTransformer;
exports.defaultUserTransformer = defaultTransformers.defaultUserTransformer;
exports.readMicrosoftGraphOrg = read.readMicrosoftGraphOrg;
exports.MicrosoftGraphOrgEntityProvider = MicrosoftGraphOrgEntityProvider.MicrosoftGraphOrgEntityProvider;
exports.MicrosoftGraphOrgReaderProcessor = MicrosoftGraphOrgReaderProcessor.MicrosoftGraphOrgReaderProcessor;
//# sourceMappingURL=index.cjs.js.map
