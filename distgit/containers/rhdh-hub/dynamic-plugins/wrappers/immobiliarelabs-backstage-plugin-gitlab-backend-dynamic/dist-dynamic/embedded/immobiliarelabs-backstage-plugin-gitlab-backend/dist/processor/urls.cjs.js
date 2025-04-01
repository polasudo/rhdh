'use strict';

require('path');

function getProjectPath(target, subPath) {
  const url = new URL(target);
  const out = url.pathname.split("/blob/").splice(0, 1).join("/").split("/-").splice(0, 1).join("/").slice(1);
  subPath = subPath?.startsWith("/") ? subPath.slice(1) : subPath;
  if (subPath && out.startsWith(subPath)) {
    return out.replace(subPath, "").split("/").filter(Boolean).join("/");
  }
  return out;
}

exports.getProjectPath = getProjectPath;
//# sourceMappingURL=urls.cjs.js.map
