'use strict';

function normalizeEntityName(name) {
  let cleaned = name.trim().toLocaleLowerCase().replace(/[^a-zA-Z0-9_\-\.]/g, "_");
  while (cleaned.endsWith("_")) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }
  while (cleaned.includes("__")) {
    cleaned = cleaned.replace("__", "_");
  }
  return cleaned;
}

exports.normalizeEntityName = normalizeEntityName;
//# sourceMappingURL=helper.cjs.js.map
