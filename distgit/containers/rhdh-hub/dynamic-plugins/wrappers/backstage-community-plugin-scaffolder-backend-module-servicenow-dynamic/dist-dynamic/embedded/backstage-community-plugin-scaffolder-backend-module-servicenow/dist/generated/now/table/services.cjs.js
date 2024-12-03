'use strict';

var OpenAPI = require('./core/OpenAPI.cjs.js');
var request = require('./core/request.cjs.js');

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
    return request.request(OpenAPI.OpenAPI, {
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
    return request.request(OpenAPI.OpenAPI, {
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
    return request.request(OpenAPI.OpenAPI, {
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
    return request.request(OpenAPI.OpenAPI, {
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
    return request.request(OpenAPI.OpenAPI, {
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
    return request.request(OpenAPI.OpenAPI, {
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

exports.DefaultService = DefaultService;
//# sourceMappingURL=services.cjs.js.map
