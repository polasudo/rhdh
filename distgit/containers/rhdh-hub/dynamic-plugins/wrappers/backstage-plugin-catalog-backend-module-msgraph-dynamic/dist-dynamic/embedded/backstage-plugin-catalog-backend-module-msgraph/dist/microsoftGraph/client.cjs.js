'use strict';

var identity = require('@azure/identity');
var fetch = require('node-fetch');
var qs = require('qs');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);
var qs__default = /*#__PURE__*/_interopDefaultCompat(qs);

class MicrosoftGraphClient {
  /**
   * @param baseUrl - baseUrl of Graph API {@link MicrosoftGraphProviderConfig.target}
   * @param tokenCredential - instance of `TokenCredential` that is used to acquire token for Graph API calls
   *
   */
  constructor(baseUrl, tokenCredential) {
    this.baseUrl = baseUrl;
    this.tokenCredential = tokenCredential;
  }
  /**
   * Factory method that instantiate `msal` client and return
   * an instance of `MicrosoftGraphClient`
   *
   * @public
   *
   * @param config - Configuration for Interacting with Graph API
   */
  static create(config) {
    const options = {
      authorityHost: config.authority,
      tenantId: config.tenantId
    };
    const credential = config.clientId && config.clientSecret ? new identity.ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret,
      options
    ) : new identity.DefaultAzureCredential(options);
    return new MicrosoftGraphClient(config.target, credential);
  }
  /**
   * Get a collection of resource from Graph API and
   * return an `AsyncIterable` of that resource
   *
   * @public
   * @param path - Resource in Microsoft Graph
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *requestCollection(path, query, queryMode) {
    const appliedQueryMode = query?.search ? "advanced" : queryMode ?? "basic";
    if (appliedQueryMode === "advanced" && (query?.filter || query?.select)) {
      query.count = true;
    }
    const headers = appliedQueryMode === "advanced" ? {
      // Eventual consistency is required for advanced querying capabilities
      // like "$search" or parts of "$filter".
      // If a new user/group is not found, it'll eventually be imported on a subsequent read
      ConsistencyLevel: "eventual"
    } : {};
    let response = await this.requestApi(path, query, headers);
    for (; ; ) {
      if (response.status !== 200) {
        await this.handleError(path, response);
      }
      const result = await response.json();
      const elements = result.value;
      yield* elements;
      if (!result["@odata.nextLink"]) {
        return;
      }
      response = await this.requestRaw(result["@odata.nextLink"], headers);
    }
  }
  /**
   * Abstract on top of {@link MicrosoftGraphClient.requestRaw}
   *
   * @public
   * @param path - Resource in Microsoft Graph
   * @param query - OData Query {@link ODataQuery}
   * @param headers - optional HTTP headers
   */
  async requestApi(path, query, headers) {
    const queryString = qs__default.default.stringify(
      {
        $search: query?.search,
        $filter: query?.filter,
        $select: query?.select?.join(","),
        $expand: query?.expand,
        $count: query?.count,
        $top: query?.top
      },
      {
        addQueryPrefix: true,
        // Microsoft Graph doesn't like an encoded query string
        encode: false
      }
    );
    return await this.requestRaw(
      `${this.baseUrl}/${path}${queryString}`,
      headers
    );
  }
  /**
   * Makes a HTTP call to Graph API with token
   *
   * @param url - HTTP Endpoint of Graph API
   * @param headers - optional HTTP headers
   */
  async requestRaw(url, headers, retryCount = 2) {
    const urlObj = new URL(url);
    const token = await this.tokenCredential.getToken(
      `${urlObj.protocol}//${urlObj.hostname}/.default`
    );
    if (!token) {
      throw new Error("Failed to obtain token from Azure Identity");
    }
    try {
      return await fetch__default.default(url, {
        headers: {
          ...headers,
          Authorization: `Bearer ${token.token}`
        }
      });
    } catch (e) {
      if (e?.code === "ETIMEDOUT" && retryCount > 0) {
        return this.requestRaw(url, headers, retryCount - 1);
      }
      throw e;
    }
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/profilephoto | profilePhoto}
   * of `User` from Graph API with size limit
   *
   * @param userId - The unique identifier for the `User` resource
   * @param maxSize - Maximum pixel height of the photo
   *
   */
  async getUserPhotoWithSizeLimit(userId, maxSize) {
    return await this.getPhotoWithSizeLimit("users", userId, maxSize);
  }
  async getUserPhoto(userId, sizeId) {
    return await this.getPhoto("users", userId, sizeId);
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/user | User}
   * from Graph API and return as `AsyncIterable`
   *
   * @public
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *getUsers(query, queryMode) {
    yield* this.requestCollection(
      `users`,
      query,
      queryMode
    );
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/profilephoto | profilePhoto}
   * of `Group` from Graph API with size limit
   *
   * @param groupId - The unique identifier for the `Group` resource
   * @param maxSize - Maximum pixel height of the photo
   *
   */
  async getGroupPhotoWithSizeLimit(groupId, maxSize) {
    return await this.getPhotoWithSizeLimit("groups", groupId, maxSize);
  }
  async getGroupPhoto(groupId, sizeId) {
    return await this.getPhoto("groups", groupId, sizeId);
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/group | Group}
   * from Graph API and return as `AsyncIterable`
   *
   * @public
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *getGroups(query, queryMode) {
    yield* this.requestCollection(
      `groups`,
      query,
      queryMode
    );
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/user | User}
   * belonging to a `Group` from Graph API and return as `AsyncIterable`
   * @public
   * @param groupId - The unique identifier for the `Group` resource
   *
   */
  async *getGroupMembers(groupId, query, queryMode) {
    yield* this.requestCollection(
      `groups/${groupId}/members`,
      query,
      queryMode
    );
  }
  /**
   * Get a collection of
   * {@link https://docs.microsoft.com/en-us/graph/api/resources/user | User}
   * belonging to a `Group` from Graph API and return as `AsyncIterable`
   * @public
   * @param groupId - The unique identifier for the `Group` resource
   * @param query - OData Query {@link ODataQuery}
   * @param queryMode - Mode to use while querying. Some features are only available at "advanced".
   */
  async *getGroupUserMembers(groupId, query, queryMode) {
    yield* this.requestCollection(
      `groups/${groupId}/members/microsoft.graph.user/`,
      query,
      queryMode
    );
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/organization | Organization}
   * from Graph API
   * @public
   * @param tenantId - The unique identifier for the `Organization` resource
   *
   */
  async getOrganization(tenantId) {
    const response = await this.requestApi(`organization/${tenantId}`);
    if (response.status !== 200) {
      await this.handleError(`organization/${tenantId}`, response);
    }
    return await response.json();
  }
  /**
   * Get {@link https://docs.microsoft.com/en-us/graph/api/resources/profilephoto | profilePhoto}
   * from Graph API
   *
   * @param entityName - type of parent resource, either `User` or `Group`
   * @param id - The unique identifier for the `entityName` resource
   * @param maxSize - Maximum pixel height of the photo
   *
   */
  async getPhotoWithSizeLimit(entityName, id, maxSize) {
    const response = await this.requestApi(`${entityName}/${id}/photos`);
    if (response.status === 404) {
      return void 0;
    } else if (response.status !== 200) {
      await this.handleError(`${entityName} photos`, response);
    }
    const result = await response.json();
    const photos = result.value;
    let selectedPhoto = void 0;
    for (const p of photos) {
      if (!selectedPhoto || p.height >= selectedPhoto.height && p.height <= maxSize) {
        selectedPhoto = p;
      }
    }
    if (!selectedPhoto) {
      return void 0;
    }
    return await this.getPhoto(entityName, id, selectedPhoto.id);
  }
  async getPhoto(entityName, id, sizeId) {
    const path = sizeId ? `${entityName}/${id}/photos/${sizeId}/$value` : `${entityName}/${id}/photo/$value`;
    const response = await this.requestApi(path);
    if (response.status === 404) {
      return void 0;
    } else if (response.status !== 200) {
      await this.handleError("photo", response);
    }
    return `data:image/jpeg;base64,${Buffer.from(
      await response.arrayBuffer()
    ).toString("base64")}`;
  }
  async handleError(path, response) {
    const result = await response.json();
    const error = result.error;
    throw new Error(
      `Error while reading ${path} from Microsoft Graph: ${error.code} - ${error.message}`
    );
  }
}

exports.MicrosoftGraphClient = MicrosoftGraphClient;
//# sourceMappingURL=client.cjs.js.map
