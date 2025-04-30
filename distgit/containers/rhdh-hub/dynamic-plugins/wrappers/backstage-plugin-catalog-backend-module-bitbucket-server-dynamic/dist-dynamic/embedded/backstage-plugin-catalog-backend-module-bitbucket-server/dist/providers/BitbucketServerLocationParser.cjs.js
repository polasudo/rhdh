'use strict';

var pluginCatalogNode = require('@backstage/plugin-catalog-node');

const defaultBitbucketServerLocationParser = async function* defaultBitbucketServerLocationParser2(options) {
  yield pluginCatalogNode.locationSpecToLocationEntity({ location: options.location });
};

exports.defaultBitbucketServerLocationParser = defaultBitbucketServerLocationParser;
//# sourceMappingURL=BitbucketServerLocationParser.cjs.js.map
