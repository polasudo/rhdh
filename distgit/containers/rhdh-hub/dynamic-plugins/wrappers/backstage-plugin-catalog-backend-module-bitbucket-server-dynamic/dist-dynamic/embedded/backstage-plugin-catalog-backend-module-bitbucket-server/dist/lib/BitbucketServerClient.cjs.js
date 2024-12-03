'use strict';

var fetch = require('node-fetch');
var integration = require('@backstage/integration');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

class BitbucketServerClient {
  config;
  static fromConfig(options) {
    return new BitbucketServerClient(options);
  }
  constructor(options) {
    this.config = options.config;
  }
  async listProjects(options) {
    return this.pagedRequest(
      `${this.config.apiBaseUrl}/projects`,
      options.listOptions
    );
  }
  async listRepositories(options) {
    return this.pagedRequest(
      `${this.config.apiBaseUrl}/projects/${encodeURIComponent(
        options.projectKey
      )}/repos`,
      options.listOptions
    );
  }
  async getFile(options) {
    const base = new URL(this.config.apiBaseUrl);
    return fetch__default.default(
      `${base.protocol}//${base.host}/projects/${options.projectKey}/repos/${options.repo}/raw/${options.path}`,
      integration.getBitbucketServerRequestOptions(this.config)
    );
  }
  async getRepository(options) {
    const request = `${this.config.apiBaseUrl}/projects/${options.projectKey}/repos/${options.repo}`;
    const response = await fetch__default.default(
      request,
      integration.getBitbucketServerRequestOptions(this.config)
    );
    return response.json();
  }
  resolvePath(options) {
    const base = new URL(this.config.apiBaseUrl || "");
    return {
      path: `${base.protocol}//${base.host}/projects/${options.projectKey}/repos/${options.repo}${options.path}`
    };
  }
  async pagedRequest(endpoint, options) {
    const request = new URL(endpoint);
    for (const key in options) {
      if (options[key]) {
        request.searchParams.append(key, options[key].toString());
      }
    }
    return this.getTypeMapped(request);
  }
  async getTypeMapped(url) {
    return this.get(url).then((response) => {
      return response.json();
    });
  }
  async get(url) {
    return this.request(new fetch.Request(url.toString(), { method: "GET" }));
  }
  async request(req) {
    return fetch__default.default(req, integration.getBitbucketServerRequestOptions(this.config)).then(
      (response) => {
        if (!response.ok) {
          throw new Error(
            `Unexpected response for ${req.method} ${req.url}. Expected 200 but got ${response.status} - ${response.statusText}`
          );
        }
        return response;
      }
    );
  }
}
async function* paginated(request, options) {
  const opts = { start: 0 };
  let res;
  do {
    res = await request(opts);
    opts.start = res.nextPageStart;
    for (const item of res.values) {
      yield item;
    }
  } while (!res.isLastPage);
}

exports.BitbucketServerClient = BitbucketServerClient;
exports.paginated = paginated;
//# sourceMappingURL=BitbucketServerClient.cjs.js.map
