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
  tableName: zod.z.string().min(1).describe("Name of the table in which to save the record"),
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
  )
});
const id = "servicenow:now:table:createRecord";
const examples = [
  {
    description: "Create a record in the incident table",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "createRecord",
          action: id,
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
  return pluginScaffolderNode.createTemplateAction({
    id,
    examples,
    description: "Inserts one record in the specified table. Multiple record insertion is not supported by this method",
    schema: {
      input: schemaInput
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers.updateOpenAPIConfig(OpenAPI.OpenAPI, config);
      let res;
      try {
        res = await services.DefaultService.postApiNowTableByTableName({
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

exports.createRecordAction = createRecordAction;
//# sourceMappingURL=create-record.cjs.js.map
