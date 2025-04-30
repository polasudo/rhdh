'use strict';

function getNestedValue(obj, path) {
  return path.split(".").reduce(
    (acc, key) => acc && acc[key] ? acc[key] : undefined,
    obj
  );
}

exports.getNestedValue = getNestedValue;
//# sourceMappingURL=utils.cjs.js.map
