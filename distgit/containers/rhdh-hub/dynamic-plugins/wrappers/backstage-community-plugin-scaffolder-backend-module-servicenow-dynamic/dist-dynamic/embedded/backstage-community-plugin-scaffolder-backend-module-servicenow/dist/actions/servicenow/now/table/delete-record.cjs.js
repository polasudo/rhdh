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
  tableName: zod.z.string().min(1).describe("Name of the table in which to delete the record"),
  sysId: zod.z.string().min(1).describe("Unique identifier of the record to delete"),
  sysparmQueryNoDomain: zod.z.boolean().optional().describe(
    "True to access data across domains if authorized (default: false)"
  )
});
const id = "servicenow:now:table:deleteRecord";
const examples = [
  {
    description: "Delete a record from the incident table",
    example: yaml__default.default.stringify({
      steps: [
        {
          id: "deleteRecord",
          action: id,
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
  return pluginScaffolderNode.createTemplateAction({
    id,
    examples,
    description: "Deletes the specified record from the specified table",
    schema: {
      input: schemaInput
    },
    async handler(ctx) {
      const input = ctx.input;
      helpers.updateOpenAPIConfig(OpenAPI.OpenAPI, config);
      try {
        await services.DefaultService.deleteApiNowTableByTableNameBySysId(input);
      } catch (error) {
        const e = error;
        throw new Error(e.body?.error?.message);
      }
    }
  });
};

exports.deleteRecordAction = deleteRecordAction;
//# sourceMappingURL=delete-record.cjs.js.map
