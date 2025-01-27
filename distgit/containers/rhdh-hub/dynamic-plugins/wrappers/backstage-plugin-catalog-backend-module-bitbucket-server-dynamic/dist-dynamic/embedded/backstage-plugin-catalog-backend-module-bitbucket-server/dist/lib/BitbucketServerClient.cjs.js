'use strict';

var integration = require('@backstage/integration');
var pThrottle = require('p-throttle');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var pThrottle__default = /*#__PURE__*/_interopDefaultCompat(pThrottle);

const throttle = pThrottle__default.default({
  limit: 1,
  interval: 1e3
});
const throttledFetch = throttle(
  async (url, options) => {
    return await fetch(url, options);
  }
);
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
    return throttledFetch(
      `${this.config.apiBaseUrl}/projects/${options.projectKey}/repos/${options.repo}/raw/${options.path}`,
      integration.getBitbucketServerRequestOptions(this.config)
    );
  }
  async getRepository(options) {
    const request = `${this.config.apiBaseUrl}/projects/${options.projectKey}/repos/${options.repo}`;
    const response = await throttledFetch(
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
    return this.request(new Request(url.toString(), { method: "GET" }));
  }
  async request(req) {
    return throttledFetch(
      req,
      integration.getBitbucketServerRequestOptions(this.config)
    ).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Unexpected response for ${req.method} ${req.url}. Expected 200 but got ${response.status} - ${response.statusText}`
        );
      }
      return response;
    });
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
