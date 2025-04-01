'use strict';

var lodash = require('lodash');

function errorString(error) {
  return `${error.code} ${error.name}: ${error.message}`;
}
function mapStringAttr(entry, vendor, attributeName, setter) {
  if (attributeName) {
    const values = vendor.decodeStringAttribute(entry, attributeName);
    if (values && values.length === 1) {
      setter(values[0]);
    }
  }
}
function createOptions(inputOptions) {
  const result = lodash.cloneDeep(inputOptions);
  if (result.paged === true) {
    result.paged = { pagePause: true };
  } else if (typeof result.paged === "object") {
    result.paged.pagePause = true;
  }
  return result;
}

exports.createOptions = createOptions;
exports.errorString = errorString;
exports.mapStringAttr = mapStringAttr;
//# sourceMappingURL=util.cjs.js.map
