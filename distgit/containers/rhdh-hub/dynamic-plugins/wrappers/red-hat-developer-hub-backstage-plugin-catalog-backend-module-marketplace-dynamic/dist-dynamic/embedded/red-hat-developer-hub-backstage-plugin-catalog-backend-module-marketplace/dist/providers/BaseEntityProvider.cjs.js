'use strict';

var catalogModel = require('@backstage/catalog-model');
var fileUtils = require('../utils/file-utils.cjs.js');

class BaseEntityProvider {
  connection;
  taskRunner;
  constructor(taskRunner) {
    this.taskRunner = taskRunner;
  }
  getEntities(allEntities) {
    if (allEntities.length === 0) {
      return [];
    }
    return allEntities.filter((d) => d.content.kind === this.getKind()).map((file) => ({
      ...file.content,
      metadata: {
        ...file.content.metadata,
        annotations: {
          ...file.content.metadata.annotations,
          [catalogModel.ANNOTATION_LOCATION]: `file:${this.getProviderName()}`,
          [catalogModel.ANNOTATION_ORIGIN_LOCATION]: `file:${this.getProviderName()}`
        }
      }
    }));
  }
  async connect(connection) {
    this.connection = connection;
    await this.taskRunner.run({
      id: this.getProviderName(),
      fn: async () => {
        await this.run();
      }
    });
  }
  async run() {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    const marketplaceFilePath = fileUtils.findTopmostFolder("marketplace");
    let yamlData = [];
    if (marketplaceFilePath) {
      try {
        yamlData = fileUtils.readYamlFiles(marketplaceFilePath);
      } catch (error) {
        console.error(error.message);
      }
    }
    const entities = this.getEntities(yamlData);
    await this.connection.applyMutation({
      type: "full",
      entities: entities.map((entity) => ({
        entity,
        locationKey: `file:${this.getProviderName()}`
      }))
    });
  }
}

exports.BaseEntityProvider = BaseEntityProvider;
//# sourceMappingURL=BaseEntityProvider.cjs.js.map
