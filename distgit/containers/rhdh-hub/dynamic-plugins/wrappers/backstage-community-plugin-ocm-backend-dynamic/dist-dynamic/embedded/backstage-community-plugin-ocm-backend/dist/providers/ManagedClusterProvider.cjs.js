'use strict';

var catalogModel = require('@backstage/catalog-model');
var errors = require('@backstage/errors');
var pluginOcmCommon = require('@backstage-community/plugin-ocm-common');
var constants = require('../constants.cjs.js');
var config = require('../helpers/config.cjs.js');
var kubernetes = require('../helpers/kubernetes.cjs.js');
var parser = require('../helpers/parser.cjs.js');

class ManagedClusterProvider {
  client;
  hubResourceName;
  id;
  owner;
  logger;
  scheduleFn;
  connection;
  constructor(client, hubResourceName, id, deps, owner, taskRunner) {
    this.client = client;
    this.hubResourceName = hubResourceName;
    this.id = id;
    this.logger = deps.logger;
    this.owner = owner;
    this.scheduleFn = this.createScheduleFn(taskRunner);
  }
  static fromConfig(deps, options) {
    const { config: config$1, logger } = deps;
    return config.readOcmConfigs(config$1).map((providerConfig) => {
      const client = kubernetes.hubApiClient(providerConfig, logger);
      let taskRunner;
      if ("scheduler" in options && providerConfig.schedule) {
        taskRunner = options.scheduler.createScheduledTaskRunner(
          providerConfig.schedule
        );
      } else if ("schedule" in options) {
        taskRunner = options.schedule;
      } else {
        throw new errors.InputError(
          `No schedule provided via config for OCMProvider:${providerConfig.id}.`
        );
      }
      return new ManagedClusterProvider(
        client,
        providerConfig.hubResourceName,
        providerConfig.id,
        deps,
        providerConfig.owner,
        taskRunner
      );
    });
  }
  async connect(connection) {
    this.connection = connection;
    await this.scheduleFn();
  }
  createScheduleFn(taskRunner) {
    return async () => {
      return taskRunner.run({
        id: `run_ocm_refresh_${this.getProviderName()}`,
        fn: async () => {
          try {
            await this.run();
          } catch (error) {
            this.logger.error(
              "Error while syncing cluster resources from Open Cluster Management",
              {
                // Default Error properties:
                name: error.name,
                message: error.message,
                stack: error.stack,
                // Additional status code if available:
                status: error.response?.status
              }
            );
          }
        }
      });
    };
  }
  getProviderName() {
    return `ocm-managed-cluster:${this.id}`;
  }
  async run() {
    if (!this.connection) {
      throw new Error("Not initialized");
    }
    this.logger.info(
      `Providing OpenShift cluster resources from Open Cluster Management`
    );
    const hubConsole = parser.getClaim(
      await kubernetes.getManagedCluster(this.client, constants.HUB_CLUSTER_NAME_IN_OCM),
      constants.CONSOLE_CLAIM
    );
    const resources = (await kubernetes.listManagedClusters(this.client)).items.map((i) => {
      const normalizedName = parser.translateOCMToResource(
        i.metadata.name,
        this.hubResourceName
      );
      return {
        kind: "Resource",
        apiVersion: "backstage.io/v1beta1",
        metadata: {
          name: normalizedName,
          annotations: {
            /**
             * Can also be pulled from ManagedClusterInfo on .spec.masterEndpoint (details in discussion: https://github.com/janus-idp/backstage-plugins/pull/94#discussion_r1093228858)
             */
            [constants.ANNOTATION_KUBERNETES_API_SERVER]: i.spec?.managedClusterClientConfigs?.[0]?.url,
            [pluginOcmCommon.ANNOTATION_CLUSTER_ID]: i.metadata?.labels?.clusterID,
            [catalogModel.ANNOTATION_LOCATION]: this.getProviderName(),
            [catalogModel.ANNOTATION_ORIGIN_LOCATION]: this.getProviderName(),
            [pluginOcmCommon.ANNOTATION_PROVIDER_ID]: this.id
          },
          links: [
            {
              url: parser.getClaim(i, constants.CONSOLE_CLAIM),
              title: "OpenShift Console",
              icon: "dashboard"
            },
            {
              url: `${hubConsole}/multicloud/infrastructure/clusters/details/${i.metadata.name}/`,
              title: "OCM Console"
            },
            {
              url: `https://console.redhat.com/openshift/details/s/${i.metadata.labels.clusterID}`,
              title: "OpenShift Cluster Manager"
            }
          ]
        },
        spec: {
          owner: this.owner,
          type: "kubernetes-cluster"
        }
      };
    });
    await this.connection.applyMutation({
      type: "full",
      entities: resources.map((entity) => ({
        entity,
        locationKey: this.getProviderName()
      }))
    });
  }
}

exports.ManagedClusterProvider = ManagedClusterProvider;
//# sourceMappingURL=ManagedClusterProvider.cjs.js.map
