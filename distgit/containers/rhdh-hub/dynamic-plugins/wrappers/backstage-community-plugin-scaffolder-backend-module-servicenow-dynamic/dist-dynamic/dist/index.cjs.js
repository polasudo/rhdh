'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$1 = require('@backstage/plugin-scaffolder-node');
var require$$1 = require('yaml');
var require$$2 = require('zod');
var require$$0 = require('axios');
var require$$0$2 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-scaffolder-node/alpha');

var index_cjs$3 = {};

var index_cjs$2 = {};

var index_cjs$1 = {};

var index_cjs = {};

var createRecord_cjs = {};

var OpenAPI_cjs = {};

class Interceptors {
  _fns;
  constructor() {
    this._fns = [];
  }
  eject(fn) {
    const index = this._fns.indexOf(fn);
    if (index !== -1) {
      this._fns = [...this._fns.slice(0, index), ...this._fns.slice(index + 1)];
    }
  }
  use(fn) {
    this._fns = [...this._fns, fn];
  }
}
const OpenAPI$7 = {
  BASE: "https://dev139850.service-now.com",
  CREDENTIALS: "include",
  ENCODE_PATH: void 0,
  HEADERS: void 0,
  PASSWORD: void 0,
  RESULT: "body",
  TOKEN: void 0,
  USERNAME: void 0,
  VERSION: "latest",
  WITH_CREDENTIALS: false,
  interceptors: { request: new Interceptors(), response: new Interceptors() }
};

OpenAPI_cjs.Interceptors = Interceptors;
OpenAPI_cjs.OpenAPI = OpenAPI$7;

var services_cjs = {};

var request_cjs = {};

var ApiError_cjs = {};

class ApiError$1 extends Error {
  url;
  status;
  statusText;
  body;
  request;
  constructor(request, response, message) {
    super(message);
    this.name = "ApiError";
    this.url = response.url;
    this.status = response.status;
    this.statusText = response.statusText;
    this.body = response.body;
    this.request = request;
  }
}

ApiError_cjs.ApiError = ApiError$1;

var CancelablePromise_cjs = {};

class CancelError extends Error {
  constructor(message) {
    super(message);
    this.name = "CancelError";
  }
  get isCancelled() {
    return true;
  }
}
class CancelablePromise$1 {
  _isResolved;
  _isRejected;
  _isCancelled;
  cancelHandlers;
  promise;
  _resolve;
  _reject;
  constructor(executor) {
    this._isResolved = false;
    this._isRejected = false;
    this._isCancelled = false;
    this.cancelHandlers = [];
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      const onResolve = (value) => {
        if (this._isResolved || this._isRejected || this._isCancelled) {
          return;
        }
        this._isResolved = true;
        if (this._resolve) this._resolve(value);
      };
      const onReject = (reason) => {
        if (this._isResolved || this._isRejected || this._isCancelled) {
          return;
        }
        this._isRejected = true;
        if (this._reject) this._reject(reason);
      };
      const onCancel = (cancelHandler) => {
        if (this._isResolved || this._isRejected || this._isCancelled) {
          return;
        }
        this.cancelHandlers.push(cancelHandler);
      };
      Object.defineProperty(onCancel, "isResolved", {
        get: () => this._isResolved
      });
      Object.defineProperty(onCancel, "isRejected", {
        get: () => this._isRejected
      });
      Object.defineProperty(onCancel, "isCancelled", {
        get: () => this._isCancelled
      });
      return executor(onResolve, onReject, onCancel);
    });
  }
  get [Symbol.toStringTag]() {
    return "Cancellable Promise";
  }
  then(onFulfilled, onRejected) {
    return this.promise.then(onFulfilled, onRejected);
  }
  catch(onRejected) {
    return this.promise.catch(onRejected);
  }
  finally(onFinally) {
    return this.promise.finally(onFinally);
  }
  cancel() {
    if (this._isResolved || this._isRejected || this._isCancelled) {
      return;
    }
    this._isCancelled = true;
    if (this.cancelHandlers.length) {
      try {
        for (const cancelHandler of this.cancelHandlers) {
          cancelHandler();
        }
      } catch (error) {
        console.warn("Cancellation threw an error", error);
        return;
      }
    }
    this.cancelHandlers.length = 0;
    if (this._reject) this._reject(new CancelError("Request aborted"));
  }
  get isCancelled() {
    return this._isCancelled;
  }
}

CancelablePromise_cjs.CancelError = CancelError;
CancelablePromise_cjs.CancelablePromise = CancelablePromise$1;

var axios = require$$0;
var ApiError = ApiError_cjs;
var CancelablePromise = CancelablePromise_cjs;

function _interopDefaultCompat$6 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var axios__default = /*#__PURE__*/_interopDefaultCompat$6(axios);

const isString = (value) => {
  return typeof value === "string";
};
const isStringWithValue = (value) => {
  return isString(value) && value !== "";
};
const isBlob = (value) => {
  return value instanceof Blob;
};
const isFormData = (value) => {
  return value instanceof FormData;
};
const isSuccess = (status) => {
  return status >= 200 && status < 300;
};
const base64 = (str) => {
  try {
    return btoa(str);
  } catch (err) {
    return Buffer.from(str).toString("base64");
  }
};
const getQueryString = (params) => {
  const qs = [];
  const append = (key, value) => {
    qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  const encodePair = (key, value) => {
    if (value === void 0 || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => encodePair(key, v));
    } else if (typeof value === "object") {
      Object.entries(value).forEach(([k, v]) => encodePair(`${key}[${k}]`, v));
    } else {
      append(key, value);
    }
  };
  Object.entries(params).forEach(([key, value]) => encodePair(key, value));
  return qs.length ? `?${qs.join("&")}` : "";
};
const getUrl = (config, options) => {
  const encoder = encodeURI;
  const path = options.url.replace("{api-version}", config.VERSION).replace(/{(.*?)}/g, (substring, group) => {
    if (options.path?.hasOwnProperty(group)) {
      return encoder(String(options.path[group]));
    }
    return substring;
  });
  const url = config.BASE + path;
  return options.query ? url + getQueryString(options.query) : url;
};
const getFormData = (options) => {
  if (options.formData) {
    const formData = new FormData();
    const process = (key, value) => {
      if (isString(value) || isBlob(value)) {
        formData.append(key, value);
      } else {
        formData.append(key, JSON.stringify(value));
      }
    };
    Object.entries(options.formData).filter(([, value]) => value !== void 0 && value !== null).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => process(key, v));
      } else {
        process(key, value);
      }
    });
    return formData;
  }
  return void 0;
};
const resolve = async (options, resolver) => {
  if (typeof resolver === "function") {
    return resolver(options);
  }
  return resolver;
};
const getHeaders = async (config, options) => {
  const [token, username, password, additionalHeaders] = await Promise.all([
    resolve(options, config.TOKEN),
    resolve(options, config.USERNAME),
    resolve(options, config.PASSWORD),
    resolve(options, config.HEADERS)
  ]);
  const headers = Object.entries({
    Accept: "application/json",
    ...additionalHeaders,
    ...options.headers
  }).filter(([, value]) => value !== void 0 && value !== null).reduce(
    (headers2, [key, value]) => ({
      ...headers2,
      [key]: String(value)
    }),
    {}
  );
  if (isStringWithValue(token)) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (isStringWithValue(username) && isStringWithValue(password)) {
    const credentials = base64(`${username}:${password}`);
    headers["Authorization"] = `Basic ${credentials}`;
  }
  if (options.body !== void 0) {
    if (options.mediaType) {
      headers["Content-Type"] = options.mediaType;
    } else if (isBlob(options.body)) {
      headers["Content-Type"] = options.body.type || "application/octet-stream";
    } else if (isString(options.body)) {
      headers["Content-Type"] = "text/plain";
    } else if (!isFormData(options.body)) {
      headers["Content-Type"] = "application/json";
    }
  } else if (options.formData !== void 0) {
    if (options.mediaType) {
      headers["Content-Type"] = options.mediaType;
    }
  }
  return headers;
};
const getRequestBody = (options) => {
  if (options.body) {
    return options.body;
  }
  return void 0;
};
const sendRequest = async (config, options, url, body, formData, headers, onCancel, axiosClient) => {
  const controller = new AbortController();
  let requestConfig = {
    data: body ?? formData,
    headers,
    method: options.method,
    signal: controller.signal,
    url,
    withCredentials: config.WITH_CREDENTIALS
  };
  onCancel(() => controller.abort());
  for (const fn of config.interceptors.request._fns) {
    requestConfig = await fn(requestConfig);
  }
  try {
    return await axiosClient.request(requestConfig);
  } catch (error) {
    const axiosError = error;
    if (axiosError.response) {
      return axiosError.response;
    }
    throw error;
  }
};
const getResponseHeader = (response, responseHeader) => {
  if (responseHeader) {
    const content = response.headers[responseHeader];
    if (isString(content)) {
      return content;
    }
  }
  return void 0;
};
const getResponseBody = (response) => {
  if (response.status !== 204) {
    return response.data;
  }
  return void 0;
};
const catchErrorCodes = (options, result) => {
  const errors = {
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Payload Too Large",
    414: "URI Too Long",
    415: "Unsupported Media Type",
    416: "Range Not Satisfiable",
    417: "Expectation Failed",
    418: "Im a teapot",
    421: "Misdirected Request",
    422: "Unprocessable Content",
    423: "Locked",
    424: "Failed Dependency",
    425: "Too Early",
    426: "Upgrade Required",
    428: "Precondition Required",
    429: "Too Many Requests",
    431: "Request Header Fields Too Large",
    451: "Unavailable For Legal Reasons",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
    505: "HTTP Version Not Supported",
    506: "Variant Also Negotiates",
    507: "Insufficient Storage",
    508: "Loop Detected",
    510: "Not Extended",
    511: "Network Authentication Required",
    ...options.errors
  };
  const error = errors[result.status];
  if (error) {
    throw new ApiError.ApiError(options, result, error);
  }
  if (!result.ok) {
    const errorStatus = result.status ?? "unknown";
    const errorStatusText = result.statusText ?? "unknown";
    const errorBody = (() => {
      try {
        return JSON.stringify(result.body, null, 2);
      } catch (e) {
        return void 0;
      }
    })();
    throw new ApiError.ApiError(
      options,
      result,
      `Generic Error: status: ${errorStatus}; status text: ${errorStatusText}; body: ${errorBody}`
    );
  }
};
const request$1 = (config, options, axiosClient = axios__default.default) => {
  return new CancelablePromise.CancelablePromise(async (resolve2, reject, onCancel) => {
    try {
      const url = getUrl(config, options);
      const formData = getFormData(options);
      const body = getRequestBody(options);
      const headers = await getHeaders(config, options);
      if (!onCancel.isCancelled) {
        let response = await sendRequest(
          config,
          options,
          url,
          body,
          formData,
          headers,
          onCancel,
          axiosClient
        );
        for (const fn of config.interceptors.response._fns) {
          response = await fn(response);
        }
        const responseBody = getResponseBody(response);
        const responseHeader = getResponseHeader(
          response,
          options.responseHeader
        );
        const result = {
          url,
          ok: isSuccess(response.status),
          status: response.status,
          statusText: response.statusText,
          body: responseHeader ?? responseBody
        };
        catchErrorCodes(options, result);
        resolve2(result.body);
      }
    } catch (error) {
      reject(error);
    }
  });
};

request_cjs.base64 = base64;
request_cjs.catchErrorCodes = catchErrorCodes;
request_cjs.getFormData = getFormData;
request_cjs.getHeaders = getHeaders;
request_cjs.getQueryString = getQueryString;
request_cjs.getRequestBody = getRequestBody;
request_cjs.getResponseBody = getResponseBody;
request_cjs.getResponseHeader = getResponseHeader;
request_cjs.isBlob = isBlob;
request_cjs.isFormData = isFormData;
request_cjs.isString = isString;
request_cjs.isStringWithValue = isStringWithValue;
request_cjs.isSuccess = isSuccess;
request_cjs.request = request$1;
request_cjs.resolve = resolve;
request_cjs.sendRequest = sendRequest;

var OpenAPI$6 = OpenAPI_cjs;
var request = request_cjs;

class DefaultService {
  /**
   * Retrieve records from a table
   * @returns any ok
   * @throws ApiError
   */
  static getApiNowTableByTableName(data) {
    const {
      tableName,
      sysparmQuery,
      sysparmDisplayValue,
      sysparmExcludeReferenceLink,
      sysparmSuppressPaginationHeader,
      sysparmFields,
      sysparmLimit,
      sysparmView,
      sysparmQueryCategory,
      sysparmQueryNoDomain,
      sysparmNoCount
    } = data;
    return request.request(OpenAPI$6.OpenAPI, {
      method: "GET",
      url: "/api/now/table/{tableName}",
      path: {
        tableName
      },
      query: {
        sysparm_query: sysparmQuery,
        sysparm_display_value: sysparmDisplayValue,
        sysparm_exclude_reference_link: sysparmExcludeReferenceLink,
        sysparm_suppress_pagination_header: sysparmSuppressPaginationHeader,
        sysparm_fields: sysparmFields,
        sysparm_limit: sysparmLimit,
        sysparm_view: sysparmView,
        sysparm_query_category: sysparmQueryCategory,
        sysparm_query_no_domain: sysparmQueryNoDomain,
        sysparm_no_count: sysparmNoCount
      }
    });
  }
  /**
   * Create a record
   * @returns any ok
   * @throws ApiError
   */
  static postApiNowTableByTableName(data) {
    const {
      tableName,
      sysparmDisplayValue,
      sysparmExcludeReferenceLink,
      sysparmFields,
      sysparmInputDisplayValue,
      sysparmSuppressAutoSysField,
      sysparmView,
      requestBody
    } = data;
    return request.request(OpenAPI$6.OpenAPI, {
      method: "POST",
      url: "/api/now/table/{tableName}",
      path: {
        tableName
      },
      query: {
        sysparm_display_value: sysparmDisplayValue,
        sysparm_exclude_reference_link: sysparmExcludeReferenceLink,
        sysparm_fields: sysparmFields,
        sysparm_input_display_value: sysparmInputDisplayValue,
        sysparm_suppress_auto_sys_field: sysparmSuppressAutoSysField,
        sysparm_view: sysparmView
      },
      body: requestBody
    });
  }
  /**
   * Retrieve a record
   * @returns any ok
   * @throws ApiError
   */
  static getApiNowTableByTableNameBySysId(data) {
    const {
      tableName,
      sysId,
      sysparmDisplayValue,
      sysparmExcludeReferenceLink,
      sysparmFields,
      sysparmView,
      sysparmQueryNoDomain
    } = data;
    return request.request(OpenAPI$6.OpenAPI, {
      method: "GET",
      url: "/api/now/table/{tableName}/{sys_id}",
      path: {
        tableName,
        sys_id: sysId
      },
      query: {
        sysparm_display_value: sysparmDisplayValue,
        sysparm_exclude_reference_link: sysparmExcludeReferenceLink,
        sysparm_fields: sysparmFields,
        sysparm_view: sysparmView,
        sysparm_query_no_domain: sysparmQueryNoDomain
      }
    });
  }
  /**
   * Modify a record
   * @returns any ok
   * @throws ApiError
   */
  static putApiNowTableByTableNameBySysId(data) {
    const {
      tableName,
      sysId,
      sysparmDisplayValue,
      sysparmExcludeReferenceLink,
      sysparmFields,
      sysparmInputDisplayValue,
      sysparmSuppressAutoSysField,
      sysparmView,
      sysparmQueryNoDomain,
      requestBody
    } = data;
    return request.request(OpenAPI$6.OpenAPI, {
      method: "PUT",
      url: "/api/now/table/{tableName}/{sys_id}",
      path: {
        tableName,
        sys_id: sysId
      },
      query: {
        sysparm_display_value: sysparmDisplayValue,
        sysparm_exclude_reference_link: sysparmExcludeReferenceLink,
        sysparm_fields: sysparmFields,
        sysparm_input_display_value: sysparmInputDisplayValue,
        sysparm_suppress_auto_sys_field: sysparmSuppressAutoSysField,
        sysparm_view: sysparmView,
        sysparm_query_no_domain: sysparmQueryNoDomain
      },
      body: requestBody
    });
  }
  /**
   * Delete a record
   * @returns any ok
   * @throws ApiError
   */
  static deleteApiNowTableByTableNameBySysId(data) {
    const { tableName, sysId, sysparmQueryNoDomain } = data;
    return request.request(OpenAPI$6.OpenAPI, {
      method: "DELETE",
      url: "/api/now/table/{tableName}/{sys_id}",
      path: {
        tableName,
        sys_id: sysId
      },
      query: {
        sysparm_query_no_domain: sysparmQueryNoDomain
      }
    });
  }
  /**
   * Update a record
   * @returns any ok
   * @throws ApiError
   */
  static patchApiNowTableByTableNameBySysId(data) {
    const {
      tableName,
      sysId,
      sysparmDisplayValue,
      sysparmExcludeReferenceLink,
      sysparmFields,
      sysparmInputDisplayValue,
      sysparmSuppressAutoSysField,
      sysparmView,
      sysparmQueryNoDomain,
      requestBody
    } = data;
    return request.request(OpenAPI$6.OpenAPI, {
      method: "PATCH",
      url: "/api/now/table/{tableName}/{sys_id}",
      path: {
        tableName,
        sys_id: sysId
      },
      query: {
        sysparm_display_value: sysparmDisplayValue,
        sysparm_exclude_reference_link: sysparmExcludeReferenceLink,
        sysparm_fields: sysparmFields,
        sysparm_input_display_value: sysparmInputDisplayValue,
        sysparm_suppress_auto_sys_field: sysparmSuppressAutoSysField,
        sysparm_view: sysparmView,
        sysparm_query_no_domain: sysparmQueryNoDomain
      },
      body: requestBody
    });
  }
}

services_cjs.DefaultService = DefaultService;

var helpers_cjs = {};

function updateOpenAPIConfig(OpenAPI, config) {
  OpenAPI.BASE = config.getString("servicenow.baseUrl");
  OpenAPI.USERNAME = config.getString("servicenow.username");
  OpenAPI.PASSWORD = config.getString("servicenow.password");
}

helpers_cjs.updateOpenAPIConfig = updateOpenAPIConfig;

var pluginScaffolderNode$5 = require$$0$1;
var yaml$5 = require$$1;
var zod$5 = require$$2;
var OpenAPI$5 = OpenAPI_cjs;
var services$5 = services_cjs;
var helpers$5 = helpers_cjs;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$5 = /*#__PURE__*/_interopDefaultCompat$5(yaml$5);

const schemaInput$5 = zod$5.z.object({
  tableName: zod$5.z.string().min(1).describe("Name of the table in which to save the record"),
  requestBody: zod$5.z.custom().optional().describe(
    "Field name and the associated value for each parameter to define in the specified record"
  ),
  sysparmDisplayValue: zod$5.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod$5.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmFields: zod$5.z.array(zod$5.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmInputDisplayValue: zod$5.z.boolean().optional().describe(
    "Set field values using their display value (true) or actual value (false) (default: false)"
  ),
  sysparmSuppressAutoSysField: zod$5.z.boolean().optional().describe(
    "True to suppress auto generation of system fields (default: false)"
  ),
  sysparmView: zod$5.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  )
});
const id$5 = "servicenow:now:table:createRecord";
const examples$5 = [
  {
    description: "Create a record in the incident table",
    example: yaml__default$5.default.stringify({
      steps: [
        {
          id: "createRecord",
          action: id$5,
          name: "Create Record",
          input: {
            tableName: "incident",
            requestBody: {
              short_description: "Test incident",
              description: "This is a test incident",
              severity: "3"
            }
          }
        }
      ]
    })
  }
];
const createRecordAction = (options) => {
  const { config } = options;
  return pluginScaffolderNode$5.createTemplateAction({
    id: id$5,
    examples: examples$5,
    description: "Inserts one record in the specified table. Multiple record insertion is not supported by this method",
    schema: {
      input: schemaInput$5
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers$5.updateOpenAPIConfig(OpenAPI$5.OpenAPI, config);
      let res;
      try {
        res = await services$5.DefaultService.postApiNowTableByTableName({
          ...input,
          // convert the array of fields to a comma-separated string
          sysparmFields: input.sysparmFields?.join(",")
        });
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
      ctx.output("result", res.result);
    }
  });
};

createRecord_cjs.createRecordAction = createRecordAction;

var deleteRecord_cjs = {};

var pluginScaffolderNode$4 = require$$0$1;
var yaml$4 = require$$1;
var zod$4 = require$$2;
var OpenAPI$4 = OpenAPI_cjs;
var services$4 = services_cjs;
var helpers$4 = helpers_cjs;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$4 = /*#__PURE__*/_interopDefaultCompat$4(yaml$4);

const schemaInput$4 = zod$4.z.object({
  tableName: zod$4.z.string().min(1).describe("Name of the table in which to delete the record"),
  sysId: zod$4.z.string().min(1).describe("Unique identifier of the record to delete"),
  sysparmQueryNoDomain: zod$4.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  )
});
const id$4 = "servicenow:now:table:deleteRecord";
const examples$4 = [
  {
    description: "Delete a record from the incident table",
    example: yaml__default$4.default.stringify({
      steps: [
        {
          id: "deleteRecord",
          action: id$4,
          input: {
            tableName: "incident",
            sysId: "8e67d33b97d1b5108686b680f053af2b"
          }
        }
      ]
    })
  }
];
const deleteRecordAction = (options) => {
  const { config } = options;
  return pluginScaffolderNode$4.createTemplateAction({
    id: id$4,
    examples: examples$4,
    description: "Deletes the specified record from the specified table",
    schema: {
      input: schemaInput$4
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers$4.updateOpenAPIConfig(OpenAPI$4.OpenAPI, config);
      try {
        await services$4.DefaultService.deleteApiNowTableByTableNameBySysId(input);
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
    }
  });
};

deleteRecord_cjs.deleteRecordAction = deleteRecordAction;

var modifyRecord_cjs = {};

var pluginScaffolderNode$3 = require$$0$1;
var yaml$3 = require$$1;
var zod$3 = require$$2;
var OpenAPI$3 = OpenAPI_cjs;
var services$3 = services_cjs;
var helpers$3 = helpers_cjs;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$3 = /*#__PURE__*/_interopDefaultCompat$3(yaml$3);

const schemaInput$3 = zod$3.z.object({
  tableName: zod$3.z.string().min(1).describe("Name of the table in which to modify the record"),
  sysId: zod$3.z.string().min(1).describe("Unique identifier of the record to modify"),
  requestBody: zod$3.z.custom().optional().describe(
    "Field name and the associated value for each parameter to define in the specified record"
  ),
  sysparmDisplayValue: zod$3.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod$3.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmFields: zod$3.z.array(zod$3.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmInputDisplayValue: zod$3.z.boolean().optional().describe(
    "Set field values using their display value (true) or actual value (false) (default: false)"
  ),
  sysparmSuppressAutoSysField: zod$3.z.boolean().optional().describe(
    "True to suppress auto generation of system fields (default: false)"
  ),
  sysparmView: zod$3.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  ),
  sysparmQueryNoDomain: zod$3.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  )
});
const id$3 = "servicenow:now:table:modifyRecord";
const examples$3 = [
  {
    description: "Modify a record in the incident table",
    example: yaml__default$3.default.stringify({
      steps: [
        {
          id: "modifyRecord",
          action: id$3,
          name: "Modify Record",
          input: {
            tableName: "incident",
            sysId: "8e67d33b97d1b5108686b680f053af2b",
            requestBody: {
              short_description: "Updated short description"
            }
          }
        }
      ]
    })
  }
];
const modifyRecordAction = (options) => {
  const { config } = options;
  return pluginScaffolderNode$3.createTemplateAction({
    id: id$3,
    examples: examples$3,
    description: "Updates the specified record with the request body",
    schema: {
      input: schemaInput$3
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers$3.updateOpenAPIConfig(OpenAPI$3.OpenAPI, config);
      let res;
      try {
        res = await services$3.DefaultService.putApiNowTableByTableNameBySysId({
          ...input,
          sysparmFields: input.sysparmFields?.join(",")
        });
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
      ctx.output("result", res?.result);
    }
  });
};

modifyRecord_cjs.modifyRecordAction = modifyRecordAction;

var retrieveRecord_cjs = {};

var pluginScaffolderNode$2 = require$$0$1;
var yaml$2 = require$$1;
var zod$2 = require$$2;
var OpenAPI$2 = OpenAPI_cjs;
var services$2 = services_cjs;
var helpers$2 = helpers_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$2 = /*#__PURE__*/_interopDefaultCompat$2(yaml$2);

const schemaInput$2 = zod$2.z.object({
  tableName: zod$2.z.string().min(1).describe("Name of the table from which to retrieve the record"),
  sysId: zod$2.z.string().min(1).describe("Unique identifier of the record to retrieve"),
  sysparmDisplayValue: zod$2.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod$2.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmFields: zod$2.z.array(zod$2.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmView: zod$2.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  ),
  sysparmQueryNoDomain: zod$2.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  )
});
const id$2 = "servicenow:now:table:retrieveRecord";
const examples$2 = [
  {
    description: "Retrieve a record from the incident table",
    example: yaml__default$2.default.stringify({
      steps: [
        {
          id: "retrieveRecord",
          action: id$2,
          name: "Retrieve Record",
          input: {
            tableName: "incident",
            sysId: "8e67d33b97d1b5108686b680f053af2b"
          }
        }
      ]
    })
  }
];
const retrieveRecordAction = (options) => {
  const { config } = options;
  return pluginScaffolderNode$2.createTemplateAction({
    id: id$2,
    examples: examples$2,
    description: "Retrieves the record identified by the specified sys_id from the specified table",
    schema: {
      input: schemaInput$2
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers$2.updateOpenAPIConfig(OpenAPI$2.OpenAPI, config);
      let res;
      try {
        res = await services$2.DefaultService.getApiNowTableByTableNameBySysId({
          ...input,
          sysparmFields: input.sysparmFields?.join(",")
        });
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
      ctx.output("result", res?.result);
    }
  });
};

retrieveRecord_cjs.retrieveRecordAction = retrieveRecordAction;

var retrieveRecords_cjs = {};

var pluginScaffolderNode$1 = require$$0$1;
var yaml$1 = require$$1;
var zod$1 = require$$2;
var OpenAPI$1 = OpenAPI_cjs;
var services$1 = services_cjs;
var helpers$1 = helpers_cjs;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$1(yaml$1);

const schemaInput$1 = zod$1.z.object({
  tableName: zod$1.z.string().min(1).describe("Name of the table from which to retrieve the records"),
  sysparmQuery: zod$1.z.string().optional().describe("An encoded query string used to filter the results"),
  sysparmDisplayValue: zod$1.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod$1.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmSuppressPaginationHeader: zod$1.z.boolean().optional().describe("True to suppress pagination header (default: false)"),
  sysparmFields: zod$1.z.array(zod$1.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmLimit: zod$1.z.number().optional().describe(
    "The maximum number of results returned per page (default: 10,000)"
  ),
  sysparmView: zod$1.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  ),
  sysparmQueryCategory: zod$1.z.string().optional().describe(
    "Name of the query category (read replica category) to use for queries"
  ),
  sysparmQueryNoDomain: zod$1.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  ),
  sysparmNoCount: zod$1.z.boolean().optional().describe("Do not execute a select count(*) on table (default: false)")
});
const id$1 = "servicenow:now:table:retrieveRecords";
const examples$1 = [
  {
    description: "Retrieve a record from the incident table",
    example: yaml__default$1.default.stringify({
      steps: [
        {
          id: "retrieveRecords",
          action: id$1,
          name: "Retrieve Records",
          input: {
            tableName: "incident"
          }
        }
      ]
    })
  }
];
const retrieveRecordsAction = (options) => {
  const { config } = options;
  return pluginScaffolderNode$1.createTemplateAction({
    id: id$1,
    examples: examples$1,
    description: "Retrieves multiple records for the specified table",
    schema: {
      input: schemaInput$1
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers$1.updateOpenAPIConfig(OpenAPI$1.OpenAPI, config);
      let res;
      try {
        res = await services$1.DefaultService.getApiNowTableByTableName({
          ...input,
          sysparmFields: input.sysparmFields?.join(",")
        });
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
      ctx.output("result", res?.result);
    }
  });
};

retrieveRecords_cjs.retrieveRecordsAction = retrieveRecordsAction;

var updateRecord_cjs = {};

var pluginScaffolderNode = require$$0$1;
var yaml = require$$1;
var zod = require$$2;
var OpenAPI = OpenAPI_cjs;
var services = services_cjs;
var helpers = helpers_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);

const schemaInput = zod.z.object({
  tableName: zod.z.string().min(1).describe("Name of the table in which to update the record"),
  sysId: zod.z.string().min(1).describe("Unique identifier of the record to update"),
  requestBody: zod.z.custom().optional().describe(
    "Field name and the associated value for each parameter to define in the specified record"
  ),
  sysparmDisplayValue: zod.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmFields: zod.z.array(zod.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmInputDisplayValue: zod.z.boolean().optional().describe(
    "Set field values using their display value (true) or actual value (false) (default: false)"
  ),
  sysparmSuppressAutoSysField: zod.z.boolean().optional().describe(
    "True to suppress auto generation of system fields (default: false)"
  ),
  sysparmView: zod.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  ),
  sysparmQueryNoDomain: zod.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  )
});
const id = "servicenow:now:table:updateRecord";
const examples = [
  {
    description: "Update a record in the incident table",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "updateRecord",
          action: id,
          name: "Update Record",
          input: {
            tableName: "incident",
            sysId: "8e67d33b97d1b5108686b680f053af2b",
            requestBody: {
              short_description: "Updated short description"
            }
          }
        }
      ]
    })
  }
];
const updateRecordAction = (options) => {
  const { config } = options;
  return pluginScaffolderNode.createTemplateAction({
    id,
    examples,
    description: "Updates the specified record with the name-value pairs included in the request body",
    schema: {
      input: schemaInput
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers.updateOpenAPIConfig(OpenAPI.OpenAPI, config);
      let res;
      try {
        res = await services.DefaultService.patchApiNowTableByTableNameBySysId({
          ...input,
          sysparmFields: input.sysparmFields?.join(",")
        });
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
      ctx.output("result", res?.result);
    }
  });
};

updateRecord_cjs.updateRecordAction = updateRecordAction;

var createRecord$1 = createRecord_cjs;
var deleteRecord$1 = deleteRecord_cjs;
var modifyRecord$1 = modifyRecord_cjs;
var retrieveRecord$1 = retrieveRecord_cjs;
var retrieveRecords$1 = retrieveRecords_cjs;
var updateRecord$1 = updateRecord_cjs;

function createTableActions(options) {
  return [
    createRecord$1.createRecordAction(options),
    deleteRecord$1.deleteRecordAction(options),
    modifyRecord$1.modifyRecordAction(options),
    retrieveRecord$1.retrieveRecordAction(options),
    retrieveRecords$1.retrieveRecordsAction(options),
    updateRecord$1.updateRecordAction(options)
  ];
}

index_cjs.createRecordAction = createRecord$1.createRecordAction;
index_cjs.deleteRecordAction = deleteRecord$1.deleteRecordAction;
index_cjs.modifyRecordAction = modifyRecord$1.modifyRecordAction;
index_cjs.retrieveRecordAction = retrieveRecord$1.retrieveRecordAction;
index_cjs.retrieveRecordsAction = retrieveRecords$1.retrieveRecordsAction;
index_cjs.updateRecordAction = updateRecord$1.updateRecordAction;
index_cjs.createTableActions = createTableActions;

var index$5 = index_cjs;

function createNowActions(options) {
  return [...index$5.createTableActions(options)];
}

index_cjs$1.createTableActions = index$5.createTableActions;
index_cjs$1.createNowActions = createNowActions;

var index$4 = index_cjs$1;

function createServiceNowActions(options) {
  return [...index$4.createNowActions(options)];
}

index_cjs$2.createNowActions = index$4.createNowActions;
index_cjs$2.createServiceNowActions = createServiceNowActions;

var module_cjs = {};

var backendPluginApi = require$$0$2;
var alpha = require$$1$1;
var index$3 = index_cjs$2;

const scaffolderModuleServicenowActions = backendPluginApi.createBackendModule({
  moduleId: "scaffolder-backend-servicenow",
  pluginId: "scaffolder",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: alpha.scaffolderActionsExtensionPoint,
        config: backendPluginApi.coreServices.rootConfig
      },
      async init({ scaffolder, config }) {
        scaffolder.addActions(...index$3.createServiceNowActions({ config }));
      }
    });
  }
});

module_cjs.scaffolderModuleServicenowActions = scaffolderModuleServicenowActions;

Object.defineProperty(index_cjs$3, '__esModule', { value: true });

var index = index_cjs$2;
var module$1 = module_cjs;
var createRecord = createRecord_cjs;
var deleteRecord = deleteRecord_cjs;
var modifyRecord = modifyRecord_cjs;
var retrieveRecord = retrieveRecord_cjs;
var retrieveRecords = retrieveRecords_cjs;
var updateRecord = updateRecord_cjs;
var index$2 = index_cjs;
var index$1 = index_cjs$1;



index_cjs$3.createServiceNowActions = index.createServiceNowActions;
var _default = index_cjs$3.default = module$1.scaffolderModuleServicenowActions;
index_cjs$3.createRecordAction = createRecord.createRecordAction;
index_cjs$3.deleteRecordAction = deleteRecord.deleteRecordAction;
index_cjs$3.modifyRecordAction = modifyRecord.modifyRecordAction;
index_cjs$3.retrieveRecordAction = retrieveRecord.retrieveRecordAction;
index_cjs$3.retrieveRecordsAction = retrieveRecords.retrieveRecordsAction;
index_cjs$3.updateRecordAction = updateRecord.updateRecordAction;
index_cjs$3.createTableActions = index$2.createTableActions;
index_cjs$3.createNowActions = index$1.createNowActions;

exports["default"] = _default;
//# sourceMappingURL=index.cjs.js.map
