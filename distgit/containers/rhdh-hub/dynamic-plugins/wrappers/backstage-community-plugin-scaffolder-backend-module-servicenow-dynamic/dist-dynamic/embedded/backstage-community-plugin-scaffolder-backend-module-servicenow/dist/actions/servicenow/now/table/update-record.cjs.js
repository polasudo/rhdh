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

exports.updateRecordAction = updateRecordAction;
//# sourceMappingURL=update-record.cjs.js.map
