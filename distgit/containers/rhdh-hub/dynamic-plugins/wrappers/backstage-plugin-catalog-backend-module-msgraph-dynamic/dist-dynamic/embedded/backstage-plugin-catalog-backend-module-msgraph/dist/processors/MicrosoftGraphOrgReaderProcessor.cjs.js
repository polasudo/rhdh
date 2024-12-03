'use strict';

var pluginCatalogNode = require('@backstage/plugin-catalog-node');
var client = require('../microsoftGraph/client.cjs.js');
var config = require('../microsoftGraph/config.cjs.js');
var read = require('../microsoftGraph/read.cjs.js');

class MicrosoftGraphOrgReaderProcessor {
  providers;
  logger;
  userTransformer;
  groupTransformer;
  organizationTransformer;
  static fromConfig(config$1, options) {
    const c = config$1.getOptionalConfig("catalog.processors.microsoftGraphOrg");
    return new MicrosoftGraphOrgReaderProcessor({
      ...options,
      providers: c ? config.readMicrosoftGraphConfig(c) : []
    });
  }
  constructor(options) {
    options.logger.warn(
      "MicrosoftGraphOrgReaderProcessor is deprecated. Please use MicrosoftGraphOrgEntityProvider instead. More info at https://github.com/backstage/backstage/blob/master/plugins/catalog-backend-module-msgraph/CHANGELOG.md#040-next1"
    );
    this.providers = options.providers;
    this.logger = options.logger;
    this.userTransformer = options.userTransformer;
    this.groupTransformer = options.groupTransformer;
    this.organizationTransformer = options.organizationTransformer;
  }
  getProcessorName() {
    return "MicrosoftGraphOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "microsoft-graph-org") {
      return false;
    }
    const provider = this.providers.find(
      (p) => location.target.startsWith(p.target)
    );
    if (!provider) {
      throw new Error(
        `There is no Microsoft Graph Org provider that matches ${location.target}. Please add a configuration entry for it under catalog.processors.microsoftGraphOrg.providers.`
      );
    }
    const startTimestamp = Date.now();
    this.logger.info("Reading Microsoft Graph users and groups");
    const client$1 = client.MicrosoftGraphClient.create(provider);
    const { users, groups } = await read.readMicrosoftGraphOrg(
      client$1,
      provider.tenantId,
      {
        userExpand: provider.userExpand,
        userFilter: provider.userFilter,
        userSelect: provider.userSelect,
        loadUserPhotos: provider.loadUserPhotos,
        userGroupMemberFilter: provider.userGroupMemberFilter,
        userGroupMemberSearch: provider.userGroupMemberSearch,
        groupExpand: provider.groupExpand,
        groupFilter: provider.groupFilter,
        groupSearch: provider.groupSearch,
        groupSelect: provider.groupSelect,
        queryMode: provider.queryMode,
        userTransformer: this.userTransformer,
        groupTransformer: this.groupTransformer,
        organizationTransformer: this.organizationTransformer,
        logger: this.logger
      }
    );
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${users.length} users and ${groups.length} groups from Microsoft Graph in ${duration} seconds`
    );
    for (const group of groups) {
      emit(pluginCatalogNode.processingResult.entity(location, group));
    }
    for (const user of users) {
      emit(pluginCatalogNode.processingResult.entity(location, user));
    }
    return true;
  }
}

exports.MicrosoftGraphOrgReaderProcessor = MicrosoftGraphOrgReaderProcessor;
//# sourceMappingURL=MicrosoftGraphOrgReaderProcessor.cjs.js.map
