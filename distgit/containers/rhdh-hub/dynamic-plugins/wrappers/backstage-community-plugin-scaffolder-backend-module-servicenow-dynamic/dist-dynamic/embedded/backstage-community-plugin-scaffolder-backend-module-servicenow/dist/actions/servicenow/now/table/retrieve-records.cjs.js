'use strict';

var pluginScaffolderNode = require('@backstage/plugin-scaffolder-node');
var yaml = require('yaml');
var zod = require('zod');
var OpenAPI = require('../../../../generated/now/table/core/OpenAPI.cjs.js');
var services = require('../../../../generated/now/table/services.cjs.js');
var helpers = require('./helpers.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);

const schemaInput = zod.z.object({
  tableName: zod.z.string().min(1).describe("Name of the table from which to retrieve the records"),
  sysparmQuery: zod.z.string().optional().describe("An encoded query string used to filter the results"),
  sysparmDisplayValue: zod.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmSuppressPaginationHeader: zod.z.boolean().optional().describe("True to suppress pagination header (default: false)"),
  sysparmFields: zod.z.array(zod.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmLimit: zod.z.number().optional().describe(
    "The maximum number of results returned per page (default: 10,000)"
  ),
  sysparmView: zod.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  ),
  sysparmQueryCategory: zod.z.string().optional().describe(
    "Name of the query category (read replica category) to use for queries"
  ),
  sysparmQueryNoDomain: zod.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  ),
  sysparmNoCount: zod.z.boolean().optional().describe("Do not execute a select count(*) on table (default: false)")
});
const id = "servicenow:now:table:retrieveRecords";
const examples = [
  {
    description: "Retrieve a record from the incident table",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "retrieveRecords",
          action: id,
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
  return pluginScaffolderNode.createTemplateAction({
    id,
    examples,
    description: "Retrieves multiple records for the specified table",
    schema: {
      input: schemaInput
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers.updateOpenAPIConfig(OpenAPI.OpenAPI, config);
      let res;
      try {
        res = await services.DefaultService.getApiNowTableByTableName({
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

exports.retrieveRecordsAction = retrieveRecordsAction;
//# sourceMappingURL=retrieve-records.cjs.js.map
