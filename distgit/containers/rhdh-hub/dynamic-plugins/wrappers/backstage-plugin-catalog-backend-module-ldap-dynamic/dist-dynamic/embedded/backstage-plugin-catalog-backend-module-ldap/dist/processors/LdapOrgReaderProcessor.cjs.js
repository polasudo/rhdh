'use strict';

var client = require('../ldap/client.cjs.js');
require('lodash');
var config = require('../ldap/config.cjs.js');
var read = require('../ldap/read.cjs.js');
var pluginCatalogNode = require('@backstage/plugin-catalog-node');

class LdapOrgReaderProcessor {
  providers;
  logger;
  groupTransformer;
  userTransformer;
  static fromConfig(configRoot, options) {
    const config$1 = configRoot.getOptionalConfig("ldap") || configRoot.getOptionalConfig("catalog.processors.ldapOrg");
    return new LdapOrgReaderProcessor({
      ...options,
      providers: config$1 ? config.readLdapLegacyConfig(config$1) : []
    });
  }
  constructor(options) {
    this.providers = options.providers;
    this.logger = options.logger;
    this.groupTransformer = options.groupTransformer;
    this.userTransformer = options.userTransformer;
  }
  getProcessorName() {
    return "LdapOrgReaderProcessor";
  }
  async readLocation(location, _optional, emit) {
    if (location.type !== "ldap-org") {
      return false;
    }
    const provider = this.providers.find((p) => location.target === p.target);
    if (!provider) {
      throw new Error(
        `There is no LDAP configuration that matches "${location.target}". Please add a configuration entry for it under "ldap.providers".`
      );
    }
    const startTimestamp = Date.now();
    this.logger.info("Reading LDAP users and groups");
    const client$1 = await client.LdapClient.create(
      this.logger,
      provider.target,
      provider.bind,
      provider.tls
    );
    const { users, groups } = await read.readLdapOrg(
      client$1,
      provider.users,
      provider.groups,
      provider.vendor,
      {
        groupTransformer: this.groupTransformer,
        userTransformer: this.userTransformer,
        logger: this.logger
      }
    );
    const duration = ((Date.now() - startTimestamp) / 1e3).toFixed(1);
    this.logger.debug(
      `Read ${users.length} LDAP users and ${groups.length} LDAP groups in ${duration} seconds`
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

exports.LdapOrgReaderProcessor = LdapOrgReaderProcessor;
//# sourceMappingURL=LdapOrgReaderProcessor.cjs.js.map
