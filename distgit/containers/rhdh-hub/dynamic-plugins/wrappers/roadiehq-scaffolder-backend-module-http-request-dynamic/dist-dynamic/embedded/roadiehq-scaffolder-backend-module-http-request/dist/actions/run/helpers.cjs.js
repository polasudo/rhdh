'use strict';

var crossFetch = require('cross-fetch');

class HttpError extends Error {
}
const DEFAULT_TIMEOUT = 6e4;
const getPluginId = (path) => {
  const pluginId = (path.startsWith("/") ? path.substring(1) : path).split(
    "/"
  )[0];
  return pluginId;
};
const generateBackstageUrl = async (discovery, path) => {
  const [pluginId, ...rest] = (path.startsWith("/") ? path.substring(1) : path).split("/");
  return `${await discovery.getBaseUrl(pluginId)}/${rest.join("/")}`;
};
const http = async (options, logger, continueOnBadResponse = false) => {
  let res;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  const { url, ...other } = options;
  const httpOptions = { ...other, signal: controller.signal };
  try {
    res = await crossFetch.fetch(url, httpOptions);
    if (!res) {
      throw new HttpError(
        `Request was aborted as it took longer than ${DEFAULT_TIMEOUT / 1e3} seconds`
      );
    }
  } catch (e) {
    throw new HttpError(`There was an issue with the request: ${e}`);
  }
  clearTimeout(timeoutId);
  const headers = {};
  for (const [name, value] of res.headers) {
    headers[name] = value;
  }
  const isJSON = () => headers["content-type"] && headers["content-type"].includes("application/json");
  let body;
  try {
    body = isJSON() ? await res.json() : { message: await res.text() };
  } catch (e) {
    throw new HttpError(`Could not parse response body: ${e}`);
  }
  if (res.status >= 400) {
    logger.error(
      `There was an issue with your request. Status code: ${res.status} Response body: ${JSON.stringify(body)}`
    );
    if (continueOnBadResponse) {
      return { code: res.status, headers: {}, body };
    }
    throw new HttpError("Unable to complete request");
  }
  return { code: res.status, headers, body };
};
const getObjFieldCaseInsensitively = (obj = {}, fieldName) => {
  const [, value = ""] = Object.entries(obj).find(
    ([key]) => key.toLowerCase() === fieldName.toLowerCase()
  ) || [];
  return value;
};

exports.generateBackstageUrl = generateBackstageUrl;
exports.getObjFieldCaseInsensitively = getObjFieldCaseInsensitively;
exports.getPluginId = getPluginId;
exports.http = http;
//# sourceMappingURL=helpers.cjs.js.map
