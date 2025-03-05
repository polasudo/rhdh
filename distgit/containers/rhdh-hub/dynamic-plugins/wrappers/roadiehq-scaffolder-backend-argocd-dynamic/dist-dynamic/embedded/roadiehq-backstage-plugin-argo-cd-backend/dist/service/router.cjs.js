'use strict';

var backendCommon = require('@backstage/backend-common');
var express = require('express');
var Router = require('express-promise-router');
var argocd_service = require('./argocd.service.cjs.js');
var getArgoConfig = require('../utils/getArgoConfig.cjs.js');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat(express);
var Router__default = /*#__PURE__*/_interopDefaultCompat(Router);

function createRouter({
  logger,
  config
}) {
  const router = Router__default.default();
  router.use(express__default.default.json());
  const argoUserName = config.getOptionalString("argocd.username") ?? "argocdUsername";
  const argoPassword = config.getOptionalString("argocd.password") ?? "argocdPassword";
  const argoSvc = new argocd_service.ArgoService(argoUserName, argoPassword, config, logger);
  router.get("/allArgoApps/:argoInstanceName", async (request, response) => {
    const argoInstanceName = request.params.argoInstanceName;
    const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
      argoInstanceName,
      argoConfigs: argoSvc.getArgoInstanceArray()
    });
    if (matchedArgoInstance === void 0) {
      return response.status(500).send({
        status: "failed",
        message: "cannot find an argo instance to match this cluster"
      });
    }
    const token = matchedArgoInstance.token ?? await argoSvc.getArgoToken(matchedArgoInstance);
    if (!token) {
      return response.status(500).send({
        status: "failed",
        message: "could not generate token"
      });
    }
    return response.send(
      await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token
      )
    );
  });
  router.get(
    "/argoInstance/:argoInstance/repo/:repo/source/:source",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstance;
      const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = matchedArgoInstance.token ?? await argoSvc.getArgoToken(matchedArgoInstance);
      if (!token) {
        return response.status(500).send({
          status: "failed",
          message: "could not generate token"
        });
      }
      const argoData = await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token
      );
      const repoAndSource = argoData.items.map(
        (argoApp) => `${argoApp?.spec?.source?.repoURL}/${argoApp?.spec?.source?.path}`
      );
      return response.send(
        repoAndSource.includes(
          `${request.params.repo}/${decodeURIComponent(request.params.source)}`
        )
      );
    }
  );
  router.get("/find/name/:argoAppName", async (request, response) => {
    const argoAppName = request.params.argoAppName;
    const argoAppNamespace = request.query?.appNamespace;
    response.send(
      await argoSvc.findArgoApp({
        name: argoAppName,
        namespace: argoAppNamespace
      })
    );
  });
  router.get(
    "/argoInstance/:argoInstanceName/applications/name/:argoAppName/revisions/:revisionID/metadata",
    async (request, response) => {
      const revisionID = request.params.revisionID;
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const argoAppNamespace = request.query?.appNamespace;
      logger.info(`Getting info on ${argoAppName}`);
      logger.info(`Getting app ${argoAppName} on ${argoInstanceName}`);
      const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = matchedArgoInstance.token ?? await argoSvc.getArgoToken(matchedArgoInstance);
      const resp = await argoSvc.getRevisionData(
        matchedArgoInstance.url,
        {
          name: argoAppName,
          namespace: argoAppNamespace
        },
        token,
        revisionID
      );
      return response.send(resp);
    }
  );
  router.get(
    "/argoInstance/:argoInstanceName/applications/name/:argoAppName",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const argoAppNamespace = request.query?.appNamespace;
      logger.info(`Getting info on ${argoAppName}`);
      logger.info(`Getting app ${argoAppName} on ${argoInstanceName}`);
      const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = matchedArgoInstance.token ?? await argoSvc.getArgoToken(matchedArgoInstance);
      const resp = await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token,
        { name: argoAppName, namespace: argoAppNamespace }
      );
      return response.send(resp);
    }
  );
  router.get("/find/selector/:argoAppSelector", async (request, response) => {
    const argoAppSelector = request.params.argoAppSelector;
    const argoAppNamespace = request.query?.appNamespace;
    logger.info(`Getting apps for selector ${argoAppSelector}`);
    response.send(
      await argoSvc.findArgoApp({
        selector: argoAppSelector,
        namespace: argoAppNamespace
      })
    );
  });
  router.get(
    "/argoInstance/:argoInstanceName/applications/selector/:argoAppSelector",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppSelector = request.params.argoAppSelector;
      const argoAppNamespace = request.query?.appNamespace;
      logger.info(
        `Getting apps for selector ${argoAppSelector} on ${argoInstanceName}`
      );
      const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
        argoInstanceName,
        argoConfigs: argoSvc.getArgoInstanceArray()
      });
      if (matchedArgoInstance === void 0) {
        return response.status(500).send({
          status: "failed",
          message: "cannot find an argo instance to match this cluster"
        });
      }
      const token = matchedArgoInstance.token ?? await argoSvc.getArgoToken(matchedArgoInstance);
      const resp = await argoSvc.getArgoAppData(
        matchedArgoInstance.url,
        matchedArgoInstance.name,
        token,
        {
          selector: argoAppSelector,
          namespace: argoAppNamespace
        }
      );
      return response.send(resp);
    }
  );
  router.post("/createArgo", async (request, response) => {
    const argoInstanceName = request.body.clusterName;
    const namespace = request.body.namespace;
    const projectName = request.body.projectName;
    const appName = request.body.appName;
    const labelValue = request.body.labelValue;
    const sourceRepo = request.body.sourceRepo;
    const sourcePath = request.body.sourcePath;
    const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
      argoInstanceName,
      argoConfigs: argoSvc.getArgoInstanceArray()
    });
    if (matchedArgoInstance === void 0) {
      return response.status(500).send({
        status: "failed",
        message: "cannot find an argo instance to match this cluster"
      });
    }
    let token;
    if (!matchedArgoInstance.token) {
      try {
        token = await argoSvc.getArgoToken(matchedArgoInstance);
      } catch (e) {
        return response.status(e.status || 500).send({
          status: e.status,
          message: e.message
        });
      }
    } else {
      token = matchedArgoInstance.token;
    }
    try {
      await argoSvc.createArgoProject({
        baseUrl: matchedArgoInstance.url,
        argoToken: token,
        projectName,
        namespace,
        sourceRepo
      });
    } catch (e) {
      logger.error(e);
      return response.status(e.status || 500).send({
        status: e.status,
        message: e.message || "Failed to create argo project"
      });
    }
    try {
      await argoSvc.createArgoApplication({
        baseUrl: matchedArgoInstance.url,
        argoToken: token,
        projectName,
        appName,
        namespace,
        sourceRepo,
        sourcePath,
        labelValue
      });
      return response.send({
        argoProjectName: projectName,
        argoAppName: appName,
        kubernetesNamespace: namespace
      });
    } catch (e) {
      return response.status(500).send({
        status: 500,
        message: e.message || "Failed to create argo app"
      });
    }
  });
  router.put("/updateArgo/:argoAppName", async (request, response) => {
    const argoInstanceName = request.body.clusterName;
    const namespace = request.body.namespace;
    const projectName = request.body.projectName;
    const appName = request.body.appName;
    const labelValue = request.body.labelValue;
    const sourceRepo = request.body.sourceRepo;
    const sourcePath = request.body.sourcePath;
    const matchedArgoInstance = getArgoConfig.getArgoConfigByInstanceName({
      argoInstanceName,
      argoConfigs: argoSvc.getArgoInstanceArray()
    });
    if (matchedArgoInstance === void 0) {
      return response.status(500).send({
        status: "failed",
        message: "cannot find an argo instance to match this cluster"
      });
    }
    let token;
    if (!matchedArgoInstance.token) {
      try {
        token = await argoSvc.getArgoToken(matchedArgoInstance);
      } catch (e) {
        return response.status(e.status || 500).send({
          status: e.status,
          message: e.message
        });
      }
    } else {
      token = matchedArgoInstance.token;
    }
    try {
      await argoSvc.updateArgoProjectAndApp({
        instanceConfig: matchedArgoInstance,
        argoToken: token,
        projectName,
        appName,
        namespace,
        sourceRepo,
        sourcePath,
        labelValue
      });
      return response.send({
        argoProjectName: projectName,
        argoAppName: appName,
        kubernetesNamespace: namespace
      });
    } catch (e) {
      logger.error(e);
      return response.status(e.status || 500).send({
        status: e.status,
        message: e.message || "Failed to create argo project"
      });
    }
  });
  router.post("/sync", async (request, response) => {
    const appSelector = request.body.appSelector;
    const terminateOperation = Boolean(request.body.terminateOperation) ?? false;
    try {
      const argoSyncResp = await argoSvc.resyncAppOnAllArgos({
        appSelector,
        terminateOperation
      });
      return response.send(argoSyncResp);
    } catch (e) {
      return response.status(e.status || 500).send({
        status: e.status || 500,
        message: e.message || `Failed to sync your app, ${appSelector}.`
      });
    }
  });
  router.delete(
    "/argoInstance/:argoInstanceName/applications/:argoAppName",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const terminateOperation = Boolean(request.query.terminateOperation) ?? false;
      logger.info(`Getting info on ${argoInstanceName} and ${argoAppName}`);
      const argoDeleteAppandProjectResp = await argoSvc.deleteAppandProject({
        argoAppName,
        argoInstanceName,
        terminateOperation
      });
      return response.send(argoDeleteAppandProjectResp);
    }
  );
  router.get(
    "/argoInstance/:argoInstanceName/applications/:argoAppName",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoApplicationName = request.params.argoAppName;
      const applicationInformation = await argoSvc.getArgoApplicationInfo({
        argoApplicationName,
        argoInstanceName
      });
      return response.status(applicationInformation.statusCode).send(applicationInformation);
    }
  );
  router.delete(
    "/argoInstance/:argoInstanceName/applications/:argoAppName/operation",
    async (request, response) => {
      const argoInstanceName = request.params.argoInstanceName;
      const argoAppName = request.params.argoAppName;
      const terminateArgoAppOperationResp = await argoSvc.terminateArgoAppOperation({
        argoAppName,
        argoInstanceName
      });
      return response.status(terminateArgoAppOperationResp.statusCode).send(terminateArgoAppOperationResp);
    }
  );
  router.use(backendCommon.errorHandler());
  return Promise.resolve(router);
}

exports.createRouter = createRouter;
//# sourceMappingURL=router.cjs.js.map
