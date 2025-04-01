'use strict';

var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');
var BaseEntityProvider = require('./BaseEntityProvider.cjs.js');

class MarketplaceCollectionProvider extends BaseEntityProvider.BaseEntityProvider {
  getKind() {
    return backstagePluginMarketplaceCommon.MarketplaceKind.Collection;
  }
  getProviderName() {
    return "marketplace-collection-provider";
  }
}

exports.MarketplaceCollectionProvider = MarketplaceCollectionProvider;
//# sourceMappingURL=MarketplaceCollectionProvider.cjs.js.map
