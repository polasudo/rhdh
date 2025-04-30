'use strict';

var gitUrlParse = require('git-url-parse');
var jsYaml = require('js-yaml');
require('@backstage/errors');
require('@backstage/plugin-permission-common');
require('@red-hat-developer-hub/backstage-plugin-bulk-import-common');
require('just-kebab-case');
var loggingUtils = require('../helpers/loggingUtils.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat(gitUrlParse);
var jsYaml__default = /*#__PURE__*/_interopDefaultCompat(jsYaml);

class CatalogInfoGenerator {
  logger;
  catalogHttpClient;
  constructor(logger, catalogHttpClient) {
    this.logger = logger;
    this.catalogHttpClient = catalogHttpClient;
  }
  async generateDefaultCatalogInfoContent(repoUrl, analyzeLocation = true) {
    const gitUrl = gitUrlParse__default.default(repoUrl);
    const defaultCatalogInfo = `---
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${gitUrl.name}
  annotations:
    github.com/project-slug: ${gitUrl.organization}/${gitUrl.name}
spec:
  type: other
  lifecycle: unknown
  owner: ${gitUrl.organization}
---`;
    if (!analyzeLocation) {
      return defaultCatalogInfo;
    }
    let generatedEntities = [];
    try {
      generatedEntities = await this.catalogHttpClient.analyzeLocation(repoUrl);
    } catch (error) {
      loggingUtils.logErrorIfNeeded(
        this.logger,
        `Could not analyze location ${repoUrl}`,
        error
      );
    }
    if (generatedEntities.length === 0) {
      return defaultCatalogInfo;
    }
    return generatedEntities.map(
      (generatedEntity) => `---
${jsYaml__default.default.dump(generatedEntity.entity)}`
    ).join("\n");
  }
}

exports.CatalogInfoGenerator = CatalogInfoGenerator;
//# sourceMappingURL=catalogInfoGenerator.cjs.js.map
