'use strict';

var openapiMerge = require('openapi-merge');
var Swagger2OpenAPI = require('swagger2openapi');
var SwaggerConverter = require('swagger-converter');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Swagger2OpenAPI__default = /*#__PURE__*/_interopDefaultCompat(Swagger2OpenAPI);
var SwaggerConverter__default = /*#__PURE__*/_interopDefaultCompat(SwaggerConverter);

function isSwagger1_2(apiDoc) {
  return apiDoc.swaggerVersion && apiDoc.swaggerVersion === "1.2";
}
function isSwagger2_0(apiDoc) {
  return apiDoc.swagger && apiDoc.swagger === "2.0";
}
function isOpenAPI3_0(apiDoc) {
  return apiDoc.openapi;
}
class OpenAPIMergerAndConverter {
  async mergeOpenAPI3Docs(docs) {
    const mergeInput = docs.map((doc) => {
      return { oas: doc };
    });
    const result = await openapiMerge.merge(mergeInput);
    if (openapiMerge.isErrorResult(result)) {
      throw new Error(result.message);
    }
    return result.output;
  }
  // Convert api doc to format openAPI 3. Do nothing with doc if it has format openAPI 3.0.
  // 3scale supports API docs in formats:
  // - swagger 1.2
  // - swagger 2.0
  // - openAPI 3.0
  async convertAPIDocToOpenAPI3(apiDoc) {
    if (isOpenAPI3_0(apiDoc)) {
      return apiDoc;
    }
    if (isSwagger1_2(apiDoc)) {
      const swagger2_0Doc = await this.convertSwagger1_2To2_0(apiDoc);
      return await this.convertSwagger2_0ToOpenAPI3_0(swagger2_0Doc);
    }
    if (isSwagger2_0(apiDoc)) {
      return await this.convertSwagger2_0ToOpenAPI3_0(apiDoc);
    }
    throw new Error(
      `Unsupported API document. Plugin supports Swagger 1.2, 2.0, 3.0(Open API 3.0)`
    );
  }
  async convertSwagger1_2To2_0(swaggerDoc) {
    try {
      const result = SwaggerConverter__default.default.convert(swaggerDoc, {});
      return result;
    } catch (error) {
      console.error("Error converting Swagger 1.2 to Swagger 2.0:", error);
      throw error;
    }
  }
  async convertSwagger2_0ToOpenAPI3_0(swaggerDoc) {
    try {
      const result = await Swagger2OpenAPI__default.default.convertObj(swaggerDoc, {
        patch: true,
        // patch: true  helps to fix minor issues
        warnOnly: true
        // Do not throw on non-patchable errors
      });
      return result.openapi;
    } catch (error) {
      console.error("Error converting Swagger 2.0 to OpenAPI 3.0:", error);
      throw error;
    }
  }
}

exports.OpenAPIMergerAndConverter = OpenAPIMergerAndConverter;
exports.isOpenAPI3_0 = isOpenAPI3_0;
exports.isSwagger1_2 = isSwagger1_2;
exports.isSwagger2_0 = isSwagger2_0;
//# sourceMappingURL=open-api-merger-converter.cjs.js.map
