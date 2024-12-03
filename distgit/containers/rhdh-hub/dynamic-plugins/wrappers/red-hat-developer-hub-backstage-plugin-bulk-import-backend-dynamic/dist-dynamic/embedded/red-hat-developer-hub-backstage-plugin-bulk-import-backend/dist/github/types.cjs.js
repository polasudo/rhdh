'use strict';

function isGithubAppCredential(credential) {
  return "appId" in credential && credential.type === "app";
}

exports.isGithubAppCredential = isGithubAppCredential;
//# sourceMappingURL=types.cjs.js.map
