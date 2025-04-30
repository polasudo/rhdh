'use strict';

const specFields = ["appConfigExamples", "description", "installation"];
const removeVerboseSpecContent = (entities) => {
  entities.forEach((entity) => {
    specFields.forEach((specField) => delete entity.spec?.[specField]);
  });
};

exports.removeVerboseSpecContent = removeVerboseSpecContent;
//# sourceMappingURL=removeVerboseSpecContent.cjs.js.map
