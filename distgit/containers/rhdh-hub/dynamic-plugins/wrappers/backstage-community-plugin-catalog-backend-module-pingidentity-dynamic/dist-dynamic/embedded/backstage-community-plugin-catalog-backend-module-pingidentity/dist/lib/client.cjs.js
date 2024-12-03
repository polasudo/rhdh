'use strict';

var fetch = require('node-fetch');
var constants = require('./constants.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);

class PingIdentityClient {
  constructor(config) {
    this.config = config;
  }
  tokenCredential = null;
  /**
   * Gets the Ping Identity provider configs
   *
   * @returns the Ping Identity provider configs
   */
  getConfig() {
    return this.config;
  }
  /**
   * Gets a list of all users fetched from Ping Identity API
   *
   * @param querySize - the number of users to query at a time
   *
   * @returns a list of all users fetched from Ping Identity API
   */
  async getUsers(querySize = constants.PING_IDENTITY_DEFAULT_ENTITY_QUERY_SIZE) {
    const allUsers = [];
    let nextUrl = `users?limit=${querySize}`;
    while (nextUrl) {
      const url = nextUrl.startsWith("http") ? nextUrl : `${this.config.apiPath}/environments/${this.config.envId}/${nextUrl}`;
      const response = await this.requestApi(url, true);
      const data = await response.json();
      allUsers.push(...data._embedded.users);
      nextUrl = data._links?.next?.href || void 0;
    }
    return allUsers;
  }
  /**
   * Gets a list of all groups fetched from Ping Identity API
   *
   * @param querySize - the number of groups to query at a time
   *
   * @returns a list of all groups fetched from Ping Identity API
   */
  async getGroups(querySize = constants.PING_IDENTITY_DEFAULT_ENTITY_QUERY_SIZE) {
    const allGroups = [];
    let nextUrl = `groups?limit=${querySize}`;
    while (nextUrl) {
      const url = nextUrl.startsWith("http") ? nextUrl : `${this.config.apiPath}/environments/${this.config.envId}/${nextUrl}`;
      const response = await this.requestApi(url, true);
      const data = await response.json();
      allGroups.push(...data._embedded.groups);
      nextUrl = data._links?.next?.href || void 0;
    }
    return allGroups;
  }
  /**
   * Gets the parent group ID of a given group, returns undefined if there is no parent group
   *
   * @param groupId the group ID of a given group
   *
   * @returns the parent group ID of a given group, undefined if there is no parent group
   */
  async getParentGroupId(groupId) {
    const response = await this.requestApi(`groups/${groupId}/memberOfGroups`);
    const data = await response.json();
    return data.size > 0 ? data._embedded.groupMemberships[0].id : void 0;
  }
  /**
   * Gets all user IDs of users in a given group
   *
   * @param groupId the group ID of a given group
   *
   * @returns all user IDs of users in a given group
   */
  async getUsersInGroup(groupId) {
    const response = await this.requestApi(
      `users?filter=memberOfGroups[id%20eq%20%22${groupId}%22]`
    );
    const data = await response.json();
    return data.count > 0 ? data._embedded.users.map((users) => users.id) : [];
  }
  /**
   * Makes a Ping Identity API request to the configured environment
   *
   * @param query the query to be made
   * @param isFullUrl Optional - true if the given query is the full request url
   * @returns the response to the given API call
   */
  async requestApi(query, isFullUrl) {
    const url = isFullUrl ? query : `${this.config.apiPath}/environments/${this.config.envId}/${query}`;
    let accessToken = await this.getAccessToken();
    let response = await this.makeRequest(url, accessToken);
    if (response.status === 401) {
      accessToken = await this.fetchAccessToken();
      response = await this.makeRequest(url, accessToken);
    }
    if (!response.ok) {
      throw new Error(`Error fetching: ${response.statusText}`);
    }
    return response;
  }
  async fetchAccessToken() {
    const url = `${this.config.authPath}/${this.config.envId}/as/token`;
    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");
    const response = await fetch__default.default(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials"
      })
    });
    if (!response.ok) {
      throw new Error(`Error getting access token: ${response.statusText}`);
    }
    const data = await response.json();
    this.tokenCredential = data.access_token;
    return data.access_token;
  }
  async getAccessToken() {
    if (!this.tokenCredential) {
      return this.fetchAccessToken();
    }
    return this.tokenCredential;
  }
  async makeRequest(url, accessToken) {
    return await fetch__default.default(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }
}

exports.PingIdentityClient = PingIdentityClient;
//# sourceMappingURL=client.cjs.js.map
