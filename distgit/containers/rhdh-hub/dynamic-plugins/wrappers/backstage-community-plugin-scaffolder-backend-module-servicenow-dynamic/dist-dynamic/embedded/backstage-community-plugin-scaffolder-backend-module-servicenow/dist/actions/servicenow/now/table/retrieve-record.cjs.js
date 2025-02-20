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
  tableName: zod.z.string().min(1).describe("Name of the table from which to retrieve the record"),
  sysId: zod.z.string().min(1).describe("Unique identifier of the record to retrieve"),
  sysparmDisplayValue: zod.z.enum(["true", "false", "all"]).optional().describe(
    "Return field display values (true), actual values (false), or both (all) (default: false)"
  ),
  sysparmExcludeReferenceLink: zod.z.boolean().optional().describe(
    "True to exclude Table API links for reference fields (default: false)"
  ),
  sysparmFields: zod.z.array(zod.z.string().min(1)).optional().describe("An array of fields to return in the response"),
  sysparmView: zod.z.string().optional().describe(
    "Render the response according to the specified UI view (overridden by sysparm_fields)"
  ),
  sysparmQueryNoDomain: zod.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  )
});
const id = "servicenow:now:table:retrieveRecord";
const examples = [
  {
    description: "Retrieve a record from the incident table",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "retrieveRecord",
          action: id,
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
  return pluginScaffolderNode.createTemplateAction({
    id,
    examples,
    description: "Retrieves the record identified by the specified sys_id from the specified table",
    schema: {
      input: schemaInput
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers.updateOpenAPIConfig(OpenAPI.OpenAPI, config);
      let res;
      try {
        res = await services.DefaultService.getApiNowTableByTableNameBySysId({
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

exports.retrieveRecordAction = retrieveRecordAction;
//# sourceMappingURL=retrieve-record.cjs.js.map
