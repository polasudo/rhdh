'use strict';

var consts = require('../consts.cjs.js');
var MarketplaceKind = require('./MarketplaceKind.cjs.js');

function isMarketplaceCollection(entity) {
  return !!entity && (entity.apiVersion === consts.EXTENSIONS_API_VERSION || entity.apiVersion === "marketplace.backstage.io/v1alpha1") && entity.kind === MarketplaceKind.MarketplaceKind.Collection;
}

exports.isMarketplaceCollection = isMarketplaceCollection;
//# sourceMappingURL=MarketplaceCollection.cjs.js.map
