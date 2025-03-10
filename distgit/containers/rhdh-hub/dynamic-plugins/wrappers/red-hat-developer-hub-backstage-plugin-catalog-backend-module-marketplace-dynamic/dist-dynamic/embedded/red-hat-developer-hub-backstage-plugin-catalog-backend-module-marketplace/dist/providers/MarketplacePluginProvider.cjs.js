'use strict';

var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var BaseEntityProvider = require('./BaseEntityProvider.cjs.js');

class MarketplacePluginProvider extends BaseEntityProvider.BaseEntityProvider {
  getKind() {
    return backstagePluginMarketplaceCommon.MarketplaceKind.Plugin;
  }
  getProviderName() {
    return "marketplace-plugin-provider";
  }
}

exports.MarketplacePluginProvider = MarketplacePluginProvider;
//# sourceMappingURL=MarketplacePluginProvider.cjs.js.map
