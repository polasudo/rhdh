'use strict';

const getArgoConfigByInstanceName = ({
  argoConfigs,
  argoInstanceName
}) => {
  const matchedArgoConfig = argoConfigs.find(
    (configs) => configs.name === argoInstanceName
  );
  return matchedArgoConfig;
};

exports.getArgoConfigByInstanceName = getArgoConfigByInstanceName;
//# sourceMappingURL=getArgoConfig.cjs.js.map
