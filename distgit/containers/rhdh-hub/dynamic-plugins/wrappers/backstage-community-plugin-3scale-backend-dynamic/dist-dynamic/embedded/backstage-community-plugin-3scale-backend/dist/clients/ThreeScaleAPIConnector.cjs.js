'use strict';

function listServices(baseUrl, access_token, page, size) {
  return fetch(
    `${baseUrl}/admin/api/services.json?access_token=${access_token}&page=${page}&size=${size}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}
function listApiDocs(baseUrl, access_token) {
  return fetch(
    `${baseUrl}/admin/api/active_docs.json?access_token=${access_token}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}
function getProxyConfig(baseUrl, access_token, service_id) {
  return fetch(
    `${baseUrl}/admin/api/services/${service_id}/proxy.json?access_token=${access_token}`
  ).then((response) => {
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    return response.json();
  });
}

exports.getProxyConfig = getProxyConfig;
exports.listApiDocs = listApiDocs;
exports.listServices = listServices;
//# sourceMappingURL=ThreeScaleAPIConnector.cjs.js.map
