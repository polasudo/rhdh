'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0$4 = require('@backstage/backend-plugin-api');
var require$$1$1 = require('@backstage/plugin-catalog-node/alpha');
var require$$0$3 = require('@backstage/backend-common');
var require$$1 = require('@backstage/catalog-client');
var require$$0$1 = require('@backstage/catalog-model');
var require$$3 = require('@backstage/plugin-catalog-common/alpha');
var require$$4 = require('node-fetch');
var require$$5 = require('p-limit');
var require$$6 = require('stream');
var require$$0$2 = require('lodash/unescape');
var require$$3$1 = require('@backstage/plugin-search-backend-node/alpha');
var require$$6$1 = require('path');
var require$$1$3 = require('@backstage/integration');
var require$$0$5 = require('@backstage/errors');
var require$$2 = require('child_process');
var require$$3$2 = require('fs-extra');
var require$$4$2 = require('git-url-parse');
var require$$5$1 = require('js-yaml');
var require$$1$2 = require('mime-types');
var require$$4$1 = require('recursive-readdir');
var require$$0$6 = require('dockerode');
var require$$4$3 = require('util');
var require$$1$4 = require('@backstage/integration-aws-node');
var require$$2$1 = require('@aws-sdk/client-s3');
var require$$3$3 = require('@aws-sdk/credential-providers');
var require$$4$4 = require('@smithy/node-http-handler');
var require$$5$2 = require('@aws-sdk/lib-storage');
var require$$6$2 = require('hpagent');
var require$$8 = require('json5');
var require$$0$7 = require('@azure/identity');
var require$$1$5 = require('@azure/storage-blob');
var require$$1$6 = require('@google-cloud/storage');
var require$$2$2 = require('express');
var require$$4$5 = require('os');
var require$$4$6 = require('@trendyol-js/openstack-swift-sdk');
var require$$5$3 = require('@trendyol-js/openstack-swift-sdk/lib/types');
var require$$0$8 = require('express-promise-router');
var require$$5$4 = require('winston');

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var alpha_cjs$1 = {};

var module_cjs = {};

var index_cjs$2 = {};

var DefaultTechDocsCollatorFactory_cjs = {};

var defaultTechDocsCollatorEntityTransformer_cjs = {};

var catalogModel$8 = require$$0$1;

const getDocumentText = (entity) => {
  const documentTexts = [];
  documentTexts.push(entity.metadata.description || "");
  if (catalogModel$8.isUserEntity(entity) || catalogModel$8.isGroupEntity(entity)) {
    if (entity.spec?.profile?.displayName) {
      documentTexts.push(entity.spec.profile.displayName);
    }
  }
  if (catalogModel$8.isUserEntity(entity)) {
    if (entity.spec?.profile?.email) {
      documentTexts.push(entity.spec.profile.email);
    }
  }
  return documentTexts.join(" : ");
};
const defaultTechDocsCollatorEntityTransformer$1 = (entity) => {
  return {
    kind: entity.kind,
    namespace: entity.metadata.namespace || "default",
    annotations: entity.metadata.annotations || "",
    name: entity.metadata.name || "",
    title: entity.metadata.title || "",
    text: getDocumentText(entity),
    componentType: entity.spec?.type?.toString() || "other",
    type: entity.spec?.type?.toString() || "other",
    lifecycle: entity.spec?.lifecycle || "",
    owner: entity.spec?.owner || "",
    path: ""
  };
};

defaultTechDocsCollatorEntityTransformer_cjs.defaultTechDocsCollatorEntityTransformer = defaultTechDocsCollatorEntityTransformer$1;

var defaultTechDocsCollatorDocumentTransformer_cjs = {};

var unescape = require$$0$2;

function _interopDefaultCompat$g (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var unescape__default = /*#__PURE__*/_interopDefaultCompat$g(unescape);

const defaultTechDocsCollatorDocumentTransformer$1 = (doc) => {
  return {
    title: unescape__default.default(doc.title),
    text: unescape__default.default(doc.text || ""),
    path: doc.location
  };
};

defaultTechDocsCollatorDocumentTransformer_cjs.defaultTechDocsCollatorDocumentTransformer = defaultTechDocsCollatorDocumentTransformer$1;

var backendCommon$2 = require$$0$3;
var catalogClient$1 = require$$1;
var catalogModel$7 = require$$0$1;
var alpha$1 = require$$3;
var fetch$1 = require$$4;
var pLimit$1 = require$$5;
var stream$5 = require$$6;
var defaultTechDocsCollatorEntityTransformer = defaultTechDocsCollatorEntityTransformer_cjs;
var defaultTechDocsCollatorDocumentTransformer = defaultTechDocsCollatorDocumentTransformer_cjs;

function _interopDefaultCompat$f (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fetch__default$1 = /*#__PURE__*/_interopDefaultCompat$f(fetch$1);
var pLimit__default$1 = /*#__PURE__*/_interopDefaultCompat$f(pLimit$1);

class DefaultTechDocsCollatorFactory {
  type = "techdocs";
  visibilityPermission = alpha$1.catalogEntityReadPermission;
  discovery;
  locationTemplate;
  logger;
  auth;
  catalogClient;
  parallelismLimit;
  legacyPathCasing;
  entityTransformer;
  documentTransformer;
  constructor(options) {
    this.discovery = options.discovery;
    this.locationTemplate = options.locationTemplate || "/docs/:namespace/:kind/:name/:path";
    this.logger = options.logger.child({ documentType: this.type });
    this.catalogClient = options.catalogClient || new catalogClient$1.CatalogClient({ discoveryApi: options.discovery });
    this.parallelismLimit = options.parallelismLimit ?? 10;
    this.legacyPathCasing = options.legacyPathCasing ?? false;
    this.entityTransformer = options.entityTransformer ?? (() => ({}));
    this.documentTransformer = options.documentTransformer ?? (() => ({}));
    this.auth = backendCommon$2.createLegacyAuthAdapters({
      auth: options.auth,
      discovery: options.discovery,
      tokenManager: options.tokenManager
    }).auth;
  }
  static fromConfig(config, options) {
    const legacyPathCasing = config.getOptionalBoolean(
      "techdocs.legacyUseCaseSensitiveTripletPaths"
    ) || false;
    const locationTemplate = config.getOptionalString(
      "search.collators.techdocs.locationTemplate"
    );
    const parallelismLimit = config.getOptionalNumber(
      "search.collators.techdocs.parallelismLimit"
    );
    return new DefaultTechDocsCollatorFactory({
      ...options,
      locationTemplate,
      parallelismLimit,
      legacyPathCasing
    });
  }
  async getCollator() {
    return stream$5.Readable.from(this.execute());
  }
  async *execute() {
    const limit = pLimit__default$1.default(this.parallelismLimit);
    const techDocsBaseUrl = await this.discovery.getBaseUrl("techdocs");
    let entitiesRetrieved = 0;
    let moreEntitiesToGet = true;
    const batchSize = this.parallelismLimit * 50;
    while (moreEntitiesToGet) {
      const { token: catalogToken } = await this.auth.getPluginRequestToken({
        onBehalfOf: await this.auth.getOwnServiceCredentials(),
        targetPluginId: "catalog"
      });
      const entities = (await this.catalogClient.getEntities(
        {
          filter: {
            "metadata.annotations.backstage.io/techdocs-ref": catalogClient$1.CATALOG_FILTER_EXISTS
          },
          limit: batchSize,
          offset: entitiesRetrieved
        },
        { token: catalogToken }
      )).items;
      moreEntitiesToGet = entities.length === batchSize;
      entitiesRetrieved += entities.length;
      const docPromises = entities.filter((it) => it.metadata?.annotations?.["backstage.io/techdocs-ref"]).map(
        (entity) => limit(async () => {
          const entityInfo = DefaultTechDocsCollatorFactory.handleEntityInfoCasing(
            this.legacyPathCasing,
            {
              kind: entity.kind,
              namespace: entity.metadata.namespace || "default",
              name: entity.metadata.name
            }
          );
          try {
            const { token: techdocsToken } = await this.auth.getPluginRequestToken({
              onBehalfOf: await this.auth.getOwnServiceCredentials(),
              targetPluginId: "techdocs"
            });
            const searchIndexResponse = await fetch__default$1.default(
              DefaultTechDocsCollatorFactory.constructDocsIndexUrl(
                techDocsBaseUrl,
                entityInfo
              ),
              {
                headers: {
                  Authorization: `Bearer ${techdocsToken}`
                }
              }
            );
            const searchIndex = await Promise.race([
              searchIndexResponse.json(),
              new Promise((_resolve, reject) => {
                setTimeout(() => {
                  reject("Could not parse JSON in 5 seconds.");
                }, 5e3);
              })
            ]);
            return searchIndex.docs.map((doc) => ({
              ...defaultTechDocsCollatorEntityTransformer.defaultTechDocsCollatorEntityTransformer(entity),
              ...defaultTechDocsCollatorDocumentTransformer.defaultTechDocsCollatorDocumentTransformer(doc),
              ...this.entityTransformer(entity),
              ...this.documentTransformer(doc),
              location: this.applyArgsToFormat(
                this.locationTemplate || "/docs/:namespace/:kind/:name/:path",
                {
                  ...entityInfo,
                  path: doc.location
                }
              ),
              ...entityInfo,
              entityTitle: entity.metadata.title,
              componentType: entity.spec?.type?.toString() || "other",
              lifecycle: entity.spec?.lifecycle || "",
              owner: getSimpleEntityOwnerString(entity),
              authorization: {
                resourceRef: catalogModel$7.stringifyEntityRef(entity)
              }
            }));
          } catch (e) {
            this.logger.debug(
              `Failed to retrieve tech docs search index for entity ${entityInfo.namespace}/${entityInfo.kind}/${entityInfo.name}`,
              e
            );
            return [];
          }
        })
      );
      yield* (await Promise.all(docPromises)).flat();
    }
  }
  applyArgsToFormat(format, args) {
    let formatted = format;
    for (const [key, value] of Object.entries(args)) {
      formatted = formatted.replace(`:${key}`, value);
    }
    return formatted;
  }
  static constructDocsIndexUrl(techDocsBaseUrl, entityInfo) {
    return `${techDocsBaseUrl}/static/docs/${entityInfo.namespace}/${entityInfo.kind}/${entityInfo.name}/search/search_index.json`;
  }
  static handleEntityInfoCasing(legacyPaths, entityInfo) {
    return legacyPaths ? entityInfo : Object.entries(entityInfo).reduce((acc, [key, value]) => {
      return { ...acc, [key]: value.toLocaleLowerCase("en-US") };
    }, {});
  }
}
function getSimpleEntityOwnerString(entity) {
  if (entity.relations) {
    const owner = entity.relations.find((r) => r.type === catalogModel$7.RELATION_OWNED_BY);
    if (owner) {
      const { name } = catalogModel$7.parseEntityRef(owner.targetRef);
      return name;
    }
  }
  return "";
}

DefaultTechDocsCollatorFactory_cjs.DefaultTechDocsCollatorFactory = DefaultTechDocsCollatorFactory;

var hasRequiredIndex_cjs;

function requireIndex_cjs () {
	if (hasRequiredIndex_cjs) return index_cjs$2;
	hasRequiredIndex_cjs = 1;

	Object.defineProperty(index_cjs$2, '__esModule', { value: true });

	var module$1 = requireModule_cjs();
	var DefaultTechDocsCollatorFactory = DefaultTechDocsCollatorFactory_cjs;
	var defaultTechDocsCollatorEntityTransformer = defaultTechDocsCollatorEntityTransformer_cjs;



	index_cjs$2.default = module$1.default;
	index_cjs$2.techdocsCollatorEntityTransformerExtensionPoint = module$1.techdocsCollatorEntityTransformerExtensionPoint;
	index_cjs$2.DefaultTechDocsCollatorFactory = DefaultTechDocsCollatorFactory.DefaultTechDocsCollatorFactory;
	index_cjs$2.defaultTechDocsCollatorEntityTransformer = defaultTechDocsCollatorEntityTransformer.defaultTechDocsCollatorEntityTransformer;
	
	return index_cjs$2;
}

var hasRequiredModule_cjs;

function requireModule_cjs () {
	if (hasRequiredModule_cjs) return module_cjs;
	hasRequiredModule_cjs = 1;

	Object.defineProperty(module_cjs, '__esModule', { value: true });

	var backendPluginApi = require$$0$4;
	var alpha = require$$1$1;
	var pluginSearchBackendModuleTechdocs = requireIndex_cjs();
	var alpha$1 = require$$3$1;

	const techdocsCollatorEntityTransformerExtensionPoint = backendPluginApi.createExtensionPoint({
	  id: "search.techdocsCollator.transformer"
	});
	var feature = backendPluginApi.createBackendModule({
	  pluginId: "search",
	  moduleId: "techdocs-collator",
	  register(env) {
	    let entityTransformer;
	    let documentTransformer;
	    env.registerExtensionPoint(
	      techdocsCollatorEntityTransformerExtensionPoint,
	      {
	        setTransformer(newTransformer) {
	          if (entityTransformer) {
	            throw new Error(
	              "TechDocs collator entity transformer may only be set once"
	            );
	          }
	          entityTransformer = newTransformer;
	        },
	        setDocumentTransformer(newTransformer) {
	          if (documentTransformer) {
	            throw new Error(
	              "TechDocs collator document transformer may only be set once"
	            );
	          }
	          documentTransformer = newTransformer;
	        }
	      }
	    );
	    env.registerInit({
	      deps: {
	        config: backendPluginApi.coreServices.rootConfig,
	        logger: backendPluginApi.coreServices.logger,
	        auth: backendPluginApi.coreServices.auth,
	        httpAuth: backendPluginApi.coreServices.httpAuth,
	        discovery: backendPluginApi.coreServices.discovery,
	        scheduler: backendPluginApi.coreServices.scheduler,
	        catalog: alpha.catalogServiceRef,
	        indexRegistry: alpha$1.searchIndexRegistryExtensionPoint
	      },
	      async init({
	        config,
	        logger,
	        auth,
	        httpAuth,
	        discovery,
	        scheduler,
	        catalog,
	        indexRegistry
	      }) {
	        const defaultSchedule = {
	          frequency: { minutes: 10 },
	          timeout: { minutes: 15 },
	          initialDelay: { seconds: 3 }
	        };
	        const schedule = config.has("search.collators.techdocs.schedule") ? backendPluginApi.readSchedulerServiceTaskScheduleDefinitionFromConfig(
	          config.getConfig("search.collators.techdocs.schedule")
	        ) : defaultSchedule;
	        indexRegistry.addCollator({
	          schedule: scheduler.createScheduledTaskRunner(schedule),
	          factory: pluginSearchBackendModuleTechdocs.DefaultTechDocsCollatorFactory.fromConfig(config, {
	            discovery,
	            auth,
	            httpAuth,
	            logger,
	            catalogClient: catalog,
	            entityTransformer,
	            documentTransformer
	          })
	        });
	      }
	    });
	  }
	});

	module_cjs.default = feature;
	module_cjs.techdocsCollatorEntityTransformerExtensionPoint = techdocsCollatorEntityTransformerExtensionPoint;
	
	return module_cjs;
}

Object.defineProperty(alpha_cjs$1, '__esModule', { value: true });

var module$1 = requireModule_cjs();

const _feature$1 = module$1.default;

var _default$1 = alpha_cjs$1.default = _feature$1;

var alpha_cjs = {};

var plugin_cjs = {};

var index_cjs$1 = {};

var index_cjs = {};

var helpers_cjs$2 = {};

var helpers_cjs$1 = {};

var catalogModel$6 = require$$0$1;
var mime = require$$1$2;
var path$9 = require$$6$1;
var createLimiter$4 = require$$5;
var recursiveReadDir = require$$4$1;

function _interopDefaultCompat$e (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var mime__default = /*#__PURE__*/_interopDefaultCompat$e(mime);
var path__default$9 = /*#__PURE__*/_interopDefaultCompat$e(path$9);
var createLimiter__default$4 = /*#__PURE__*/_interopDefaultCompat$e(createLimiter$4);
var recursiveReadDir__default = /*#__PURE__*/_interopDefaultCompat$e(recursiveReadDir);

const getContentTypeForExtension = (ext) => {
  const defaultContentType = "text/plain; charset=utf-8";
  const excludedTypes = [
    "text/html",
    "text/xml",
    "image/svg+xml",
    "text/xsl",
    "application/vnd.wap.xhtml+xml",
    "multipart/x-mixed-replace",
    "text/rdf",
    "application/mathml+xml",
    "application/octet-stream",
    "application/rdf+xml",
    "application/xhtml+xml",
    "application/xml",
    "text/cache-manifest",
    "text/vtt"
  ];
  if (ext.match(
    /htm|xml|svg|appcache|manifest|mathml|owl|rdf|rng|vtt|xht|xsd|xsl/i
  )) {
    return defaultContentType;
  }
  const contentType = mime__default.default.lookup(ext);
  if (contentType && excludedTypes.includes(contentType)) {
    return defaultContentType;
  }
  return mime__default.default.contentType(ext) || defaultContentType;
};
const getHeadersForFileExtension = (fileExtension) => {
  return {
    "Content-Type": getContentTypeForExtension(fileExtension)
  };
};
const getFileTreeRecursively = async (rootDirPath) => {
  const fileList = await recursiveReadDir__default.default(rootDirPath).catch((error) => {
    throw new Error(`Failed to read template directory: ${error.message}`);
  });
  return fileList;
};
const lowerCaseEntityTriplet = (posixPath) => {
  const [namespace, kind, name, ...rest] = posixPath.split(path__default$9.default.posix.sep);
  const lowerNamespace = namespace.toLowerCase();
  const lowerKind = kind.toLowerCase();
  const lowerName = name.toLowerCase();
  return [lowerNamespace, lowerKind, lowerName, ...rest].join(path__default$9.default.posix.sep);
};
const lowerCaseEntityTripletInStoragePath = (originalPath) => {
  let posixPath = originalPath;
  if (originalPath.includes(path__default$9.default.win32.sep)) {
    posixPath = originalPath.split(path__default$9.default.win32.sep).join(path__default$9.default.posix.sep);
  }
  const parts = posixPath.split(path__default$9.default.posix.sep);
  if (parts[0] === "") {
    parts.shift();
  }
  if (parts.length <= 3) {
    throw new Error(
      `Encountered file unmanaged by TechDocs ${originalPath}. Skipping.`
    );
  }
  return lowerCaseEntityTriplet(parts.join(path__default$9.default.posix.sep));
};
const normalizeExternalStorageRootPath = (posixPath) => {
  let normalizedPath = posixPath;
  if (posixPath.startsWith(path__default$9.default.posix.sep)) {
    normalizedPath = posixPath.slice(1);
  }
  if (normalizedPath.endsWith(path__default$9.default.posix.sep)) {
    normalizedPath = normalizedPath.slice(0, normalizedPath.length - 1);
  }
  return normalizedPath;
};
const getStaleFiles = (newFiles, oldFiles) => {
  const staleFiles = new Set(oldFiles);
  const removedParentDirs = /* @__PURE__ */ new Set();
  newFiles.forEach((newFile) => {
    staleFiles.delete(newFile);
    let parentDir = newFile.substring(0, newFile.lastIndexOf("/"));
    while (!removedParentDirs.has(parentDir) && parentDir.length >= newFile.indexOf("/")) {
      staleFiles.delete(parentDir);
      removedParentDirs.add(parentDir);
      parentDir = parentDir.substring(0, parentDir.lastIndexOf("/"));
    }
  });
  return Array.from(staleFiles);
};
const getCloudPathForLocalPath = (entity, localPath = "", useLegacyPathCasing = false, externalStorageRootPath = "") => {
  const relativeFilePathPosix = localPath.split(path__default$9.default.sep).join(path__default$9.default.posix.sep);
  const entityRootDir = `${entity.metadata?.namespace ?? catalogModel$6.DEFAULT_NAMESPACE}/${entity.kind}/${entity.metadata.name}`;
  const relativeFilePathTriplet = `${entityRootDir}/${relativeFilePathPosix}`;
  const destination = useLegacyPathCasing ? relativeFilePathTriplet : lowerCaseEntityTriplet(relativeFilePathTriplet);
  const destinationWithRoot = [
    // The extra filter prevents unintended double slashes and prefixes.
    ...externalStorageRootPath.split(path__default$9.default.posix.sep).filter((s) => s !== ""),
    destination
  ].join("/");
  return destinationWithRoot;
};
const bulkStorageOperation = async (operation, args, { concurrencyLimit } = { concurrencyLimit: 25 }) => {
  const limiter = createLimiter__default$4.default(concurrencyLimit);
  await Promise.all(args.map((arg) => limiter(operation, arg)));
};
const isValidContentPath = (bucketRoot, contentPath) => {
  const relativePath = path__default$9.default.posix.relative(bucketRoot, contentPath);
  if (relativePath === "") {
    return true;
  }
  const outsideBase = relativePath.startsWith("..");
  const differentDrive = path__default$9.default.posix.isAbsolute(relativePath);
  return !outsideBase && !differentDrive;
};

helpers_cjs$1.bulkStorageOperation = bulkStorageOperation;
helpers_cjs$1.getCloudPathForLocalPath = getCloudPathForLocalPath;
helpers_cjs$1.getFileTreeRecursively = getFileTreeRecursively;
helpers_cjs$1.getHeadersForFileExtension = getHeadersForFileExtension;
helpers_cjs$1.getStaleFiles = getStaleFiles;
helpers_cjs$1.isValidContentPath = isValidContentPath;
helpers_cjs$1.lowerCaseEntityTriplet = lowerCaseEntityTriplet;
helpers_cjs$1.lowerCaseEntityTripletInStoragePath = lowerCaseEntityTripletInStoragePath;
helpers_cjs$1.normalizeExternalStorageRootPath = normalizeExternalStorageRootPath;

var backendPluginApi$4 = require$$0$4;
var errors$g = require$$0$5;
var child_process = require$$2;
var fs$6 = require$$3$2;
var gitUrlParse = require$$4$2;
var yaml$1 = require$$5$1;
var path$8 = require$$6$1;
var stream$4 = require$$6;
var helpers$f = helpers_cjs$1;

function _interopDefaultCompat$d (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$6 = /*#__PURE__*/_interopDefaultCompat$d(fs$6);
var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat$d(gitUrlParse);
var yaml__default$1 = /*#__PURE__*/_interopDefaultCompat$d(yaml$1);
var path__default$8 = /*#__PURE__*/_interopDefaultCompat$d(path$8);

function getGeneratorKey(entity) {
  if (!entity) {
    throw new Error("No entity provided");
  }
  return "techdocs";
}
const runCommand = async ({
  command,
  args,
  options,
  logStream = new stream$4.PassThrough()
}) => {
  await new Promise((resolve, reject) => {
    const process = child_process.spawn(command, args, options);
    process.stdout.on("data", (stream) => {
      logStream.write(stream);
    });
    process.stderr.on("data", (stream) => {
      logStream.write(stream);
    });
    process.on("error", (error) => {
      return reject(error);
    });
    process.on("close", (code) => {
      if (code !== 0) {
        return reject(`Command ${command} failed, exit code: ${code}`);
      }
      return resolve();
    });
  });
};
const getRepoUrlFromLocationAnnotation = (parsedLocationAnnotation, scmIntegrations, docsFolder = "docs") => {
  const { type: locationType, target } = parsedLocationAnnotation;
  if (locationType === "url") {
    const integration = scmIntegrations.byUrl(target);
    if (integration && ["github", "gitlab", "bitbucketServer", "harness"].includes(
      integration.type
    )) {
      const { filepathtype } = gitUrlParse__default.default(target);
      if (filepathtype === "") {
        return { repo_url: target };
      }
      const sourceFolder = integration.resolveUrl({
        url: `./${docsFolder}`,
        base: target.endsWith("/") ? target : `${target}/`
      });
      return {
        repo_url: target,
        edit_uri: integration.resolveEditUrl(sourceFolder)
      };
    }
  }
  return {};
};
class UnknownTag {
  constructor(data, type) {
    this.data = data;
    this.type = type;
  }
}
const MKDOCS_SCHEMA = yaml$1.DEFAULT_SCHEMA.extend([
  new yaml$1.Type("", {
    kind: "scalar",
    multi: true,
    representName: (o) => o.type,
    represent: (o) => o.data ?? "",
    instanceOf: UnknownTag,
    construct: (data, type) => new UnknownTag(data, type)
  }),
  new yaml$1.Type("tag:", {
    kind: "mapping",
    multi: true,
    representName: (o) => o.type,
    represent: (o) => o.data ?? "",
    instanceOf: UnknownTag,
    construct: (data, type) => new UnknownTag(data, type)
  }),
  new yaml$1.Type("", {
    kind: "sequence",
    multi: true,
    representName: (o) => o.type,
    represent: (o) => o.data ?? "",
    instanceOf: UnknownTag,
    construct: (data, type) => new UnknownTag(data, type)
  })
]);
const generateMkdocsYml = async (inputDir, siteOptions) => {
  try {
    const mkdocsYmlPath = path__default$8.default.join(inputDir, "mkdocs.yml");
    const defaultSiteName = siteOptions?.name ?? "Documentation Site";
    const defaultMkdocsContent = {
      site_name: defaultSiteName,
      docs_dir: "docs",
      plugins: ["techdocs-core"]
    };
    await fs__default$6.default.writeFile(
      mkdocsYmlPath,
      yaml__default$1.default.dump(defaultMkdocsContent, { schema: MKDOCS_SCHEMA })
    );
  } catch (error) {
    throw new errors$g.ForwardedError("Could not generate mkdocs.yml file", error);
  }
};
const getMkdocsYml = async (inputDir, options) => {
  let mkdocsYmlPath;
  let mkdocsYmlFileString;
  try {
    if (options?.mkdocsConfigFileName) {
      mkdocsYmlPath = path__default$8.default.join(inputDir, options.mkdocsConfigFileName);
      if (!await fs__default$6.default.pathExists(mkdocsYmlPath)) {
        throw new Error(`The specified file ${mkdocsYmlPath} does not exist`);
      }
      mkdocsYmlFileString = await fs__default$6.default.readFile(mkdocsYmlPath, "utf8");
      return {
        path: mkdocsYmlPath,
        content: mkdocsYmlFileString,
        configIsTemporary: false
      };
    }
    mkdocsYmlPath = path__default$8.default.join(inputDir, "mkdocs.yaml");
    if (await fs__default$6.default.pathExists(mkdocsYmlPath)) {
      mkdocsYmlFileString = await fs__default$6.default.readFile(mkdocsYmlPath, "utf8");
      return {
        path: mkdocsYmlPath,
        content: mkdocsYmlFileString,
        configIsTemporary: false
      };
    }
    mkdocsYmlPath = path__default$8.default.join(inputDir, "mkdocs.yml");
    if (await fs__default$6.default.pathExists(mkdocsYmlPath)) {
      mkdocsYmlFileString = await fs__default$6.default.readFile(mkdocsYmlPath, "utf8");
      return {
        path: mkdocsYmlPath,
        content: mkdocsYmlFileString,
        configIsTemporary: false
      };
    }
    await generateMkdocsYml(inputDir, options);
    mkdocsYmlFileString = await fs__default$6.default.readFile(mkdocsYmlPath, "utf8");
  } catch (error) {
    throw new errors$g.ForwardedError(
      "Could not read MkDocs YAML config file mkdocs.yml or mkdocs.yaml or default for validation",
      error
    );
  }
  return {
    path: mkdocsYmlPath,
    content: mkdocsYmlFileString,
    configIsTemporary: true
  };
};
const validateMkdocsYaml = async (inputDir, mkdocsYmlFileString) => {
  const mkdocsYml = yaml__default$1.default.load(mkdocsYmlFileString, {
    schema: MKDOCS_SCHEMA
  });
  if (mkdocsYml === null || typeof mkdocsYml !== "object") {
    return void 0;
  }
  const parsedMkdocsYml = mkdocsYml;
  if (parsedMkdocsYml.docs_dir && !backendPluginApi$4.isChildPath(inputDir, path$8.resolve(inputDir, parsedMkdocsYml.docs_dir))) {
    throw new Error(
      `docs_dir configuration value in mkdocs can't be an absolute directory or start with ../ for security reasons.
       Use relative paths instead which are resolved relative to your mkdocs.yml file location.`
    );
  }
  return parsedMkdocsYml.docs_dir;
};
const patchIndexPreBuild = async ({
  inputDir,
  logger,
  docsDir = "docs"
}) => {
  const docsPath = path__default$8.default.join(inputDir, docsDir);
  const indexMdPath = path__default$8.default.join(docsPath, "index.md");
  if (await fs__default$6.default.pathExists(indexMdPath)) {
    return;
  }
  logger.warn(`${path__default$8.default.join(docsDir, "index.md")} not found.`);
  const fallbacks = [
    path__default$8.default.join(docsPath, "README.md"),
    path__default$8.default.join(docsPath, "readme.md"),
    path__default$8.default.join(inputDir, "README.md"),
    path__default$8.default.join(inputDir, "readme.md")
  ];
  await fs__default$6.default.ensureDir(docsPath);
  for (const filePath of fallbacks) {
    try {
      await fs__default$6.default.copyFile(filePath, indexMdPath);
      return;
    } catch (error) {
      logger.warn(`${path__default$8.default.relative(inputDir, filePath)} not found.`);
    }
  }
  logger.warn(
    `Could not find any techdocs' index file. Please make sure at least one of ${[
      indexMdPath,
      ...fallbacks
    ].join(" ")} exists.`
  );
};
const createOrUpdateMetadata = async (techdocsMetadataPath, logger) => {
  const techdocsMetadataDir = techdocsMetadataPath.split(path__default$8.default.sep).slice(0, -1).join(path__default$8.default.sep);
  try {
    await fs__default$6.default.access(techdocsMetadataPath, fs__default$6.default.constants.F_OK);
  } catch (err) {
    await fs__default$6.default.writeJson(techdocsMetadataPath, JSON.parse("{}"));
  }
  let json;
  try {
    json = await fs__default$6.default.readJson(techdocsMetadataPath);
  } catch (err) {
    errors$g.assertError(err);
    const message = `Invalid JSON at ${techdocsMetadataPath} with error ${err.message}`;
    logger.error(message);
    throw new Error(message);
  }
  json.build_timestamp = Date.now();
  try {
    json.files = (await helpers$f.getFileTreeRecursively(techdocsMetadataDir)).map(
      (file) => file.replace(`${techdocsMetadataDir}${path__default$8.default.sep}`, "")
    );
  } catch (err) {
    errors$g.assertError(err);
    json.files = [];
    logger.warn(`Unable to add files list to metadata: ${err.message}`);
  }
  await fs__default$6.default.writeJson(techdocsMetadataPath, json);
  return;
};
const storeEtagMetadata = async (techdocsMetadataPath, etag) => {
  const json = await fs__default$6.default.readJson(techdocsMetadataPath);
  json.etag = etag;
  await fs__default$6.default.writeJson(techdocsMetadataPath, json);
};

helpers_cjs$2.MKDOCS_SCHEMA = MKDOCS_SCHEMA;
helpers_cjs$2.createOrUpdateMetadata = createOrUpdateMetadata;
helpers_cjs$2.generateMkdocsYml = generateMkdocsYml;
helpers_cjs$2.getGeneratorKey = getGeneratorKey;
helpers_cjs$2.getMkdocsYml = getMkdocsYml;
helpers_cjs$2.getRepoUrlFromLocationAnnotation = getRepoUrlFromLocationAnnotation;
helpers_cjs$2.patchIndexPreBuild = patchIndexPreBuild;
helpers_cjs$2.runCommand = runCommand;
helpers_cjs$2.storeEtagMetadata = storeEtagMetadata;
helpers_cjs$2.validateMkdocsYaml = validateMkdocsYaml;

var DockerContainerRunner_cjs = {};

var Docker = require$$0$6;
var fs$5 = require$$3$2;
var errors$f = require$$0$5;
var stream$3 = require$$6;
var util = require$$4$3;

function _interopDefaultCompat$c (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Docker__default = /*#__PURE__*/_interopDefaultCompat$c(Docker);
var fs__default$5 = /*#__PURE__*/_interopDefaultCompat$c(fs$5);

const pipeline = util.promisify(stream$3.pipeline);
class DockerContainerRunner$1 {
  dockerClient;
  constructor() {
    this.dockerClient = new Docker__default.default();
  }
  async runContainer(options) {
    const {
      imageName,
      command,
      args,
      logStream = new stream$3.PassThrough(),
      mountDirs = {},
      workingDir,
      envVars = {},
      pullImage = true,
      defaultUser = false
    } = options;
    try {
      await this.dockerClient.ping();
    } catch (e) {
      throw new errors$f.ForwardedError(
        "This operation requires Docker. Docker does not appear to be available. Docker.ping() failed with",
        e
      );
    }
    if (pullImage) {
      await new Promise((resolve, reject) => {
        this.dockerClient.pull(imageName, {}, (err, stream) => {
          if (err) {
            reject(err);
          } else if (!stream) {
            reject(
              new Error(
                "Unexpeected error: no stream returned from Docker while pulling image"
              )
            );
          } else {
            pipeline(stream, logStream, { end: false }).then(resolve).catch(reject);
          }
        });
      });
    }
    const userOptions = {};
    if (!defaultUser && process.getuid && process.getgid) {
      userOptions.User = `${process.getuid()}:${process.getgid()}`;
    }
    const Volumes = {};
    for (const containerDir of Object.values(mountDirs)) {
      Volumes[containerDir] = {};
    }
    const Binds = [];
    for (const [hostDir, containerDir] of Object.entries(mountDirs)) {
      const realHostDir = await fs__default$5.default.realpath(hostDir);
      Binds.push(`${realHostDir}:${containerDir}`);
    }
    const Env = new Array();
    for (const [key, value] of Object.entries(envVars)) {
      Env.push(`${key}=${value}`);
    }
    const [{ Error: error, StatusCode: statusCode }] = await this.dockerClient.run(imageName, args, logStream, {
      Volumes,
      HostConfig: {
        AutoRemove: true,
        Binds
      },
      ...workingDir ? { WorkingDir: workingDir } : {},
      Entrypoint: command,
      Env,
      ...userOptions
    });
    if (error) {
      throw new Error(
        `Docker failed to run with the following error message: ${error}`
      );
    }
    if (statusCode !== 0) {
      throw new Error(
        `Docker container returned a non-zero exit code (${statusCode})`
      );
    }
  }
}

DockerContainerRunner_cjs.DockerContainerRunner = DockerContainerRunner$1;

var helpers$e = helpers_cjs$2;





const getMkDocsYml = helpers$e.getMkdocsYml;

index_cjs.getMkdocsYml = helpers$e.getMkdocsYml;
index_cjs.getMkDocsYml = getMkDocsYml;

var dir_cjs = {};

const TECHDOCS_ANNOTATION = "backstage.io/techdocs-ref";
const TECHDOCS_EXTERNAL_ANNOTATION = "backstage.io/techdocs-entity";

var index_esm = /*#__PURE__*/Object.freeze({
	__proto__: null,
	TECHDOCS_ANNOTATION: TECHDOCS_ANNOTATION,
	TECHDOCS_EXTERNAL_ANNOTATION: TECHDOCS_EXTERNAL_ANNOTATION
});

var require$$0 = /*@__PURE__*/getAugmentedNamespace(index_esm);

var helpers_cjs = {};

var backendPluginApi$3 = require$$0$4;
var catalogModel$5 = require$$0$1;
var errors$e = require$$0$5;
var pluginTechdocsCommon$2 = require$$0;
var path$7 = require$$6$1;

function _interopDefaultCompat$b (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var path__default$7 = /*#__PURE__*/_interopDefaultCompat$b(path$7);

const parseReferenceAnnotation = (annotationName, entity) => {
  const annotation = entity.metadata.annotations?.[annotationName];
  if (!annotation) {
    throw new errors$e.InputError(
      `No location annotation provided in entity: ${entity.metadata.name}`
    );
  }
  const { type, target } = catalogModel$5.parseLocationRef(annotation);
  return {
    type,
    target
  };
};
const transformDirLocation = (entity, dirAnnotation, scmIntegrations) => {
  const location = catalogModel$5.getEntitySourceLocation(entity);
  switch (location.type) {
    case "url": {
      const target = scmIntegrations.resolveUrl({
        url: dirAnnotation.target,
        base: location.target
      });
      return {
        type: "url",
        target
      };
    }
    case "file": {
      const target = backendPluginApi$3.resolveSafeChildPath(
        path__default$7.default.dirname(location.target),
        dirAnnotation.target
      );
      return {
        type: "dir",
        target
      };
    }
    default:
      throw new errors$e.InputError(`Unable to resolve location type ${location.type}`);
  }
};
const getLocationForEntity = (entity, scmIntegration) => {
  const annotation = parseReferenceAnnotation(pluginTechdocsCommon$2.TECHDOCS_ANNOTATION, entity);
  switch (annotation.type) {
    case "url":
      return annotation;
    case "dir":
      return transformDirLocation(entity, annotation, scmIntegration);
    default:
      throw new Error(`Invalid reference annotation ${annotation.type}`);
  }
};
const getDocFilesFromRepository = async (reader, entity, opts) => {
  const { target } = parseReferenceAnnotation(pluginTechdocsCommon$2.TECHDOCS_ANNOTATION, entity);
  opts?.logger?.debug(`Reading files from ${target}`);
  const readTreeResponse = await reader.readTree(target, { etag: opts?.etag });
  const preparedDir = await readTreeResponse.dir();
  opts?.logger?.debug(`Tree downloaded and stored at ${preparedDir}`);
  return {
    preparedDir,
    etag: readTreeResponse.etag
  };
};

helpers_cjs.getDocFilesFromRepository = getDocFilesFromRepository;
helpers_cjs.getLocationForEntity = getLocationForEntity;
helpers_cjs.parseReferenceAnnotation = parseReferenceAnnotation;
helpers_cjs.transformDirLocation = transformDirLocation;

var errors$d = require$$0$5;
var integration$2 = require$$1$3;
var pluginTechdocsCommon$1 = require$$0;
var helpers$d = helpers_cjs;

class DirectoryPreparer {
  scmIntegrations;
  reader;
  /**
   * Returns a directory preparer instance
   * @param config - A backstage config
   * @param options - A directory preparer options containing a logger and reader
   */
  static fromConfig(config, options) {
    return new DirectoryPreparer(config, options.logger, options.reader);
  }
  constructor(config, _logger, reader) {
    this.reader = reader;
    this.scmIntegrations = integration$2.ScmIntegrations.fromConfig(config);
  }
  /** {@inheritDoc PreparerBase.shouldCleanPreparedDirectory} */
  shouldCleanPreparedDirectory() {
    return false;
  }
  /** {@inheritDoc PreparerBase.prepare} */
  async prepare(entity, options) {
    const annotation = helpers$d.parseReferenceAnnotation(pluginTechdocsCommon$1.TECHDOCS_ANNOTATION, entity);
    const { type, target } = helpers$d.transformDirLocation(
      entity,
      annotation,
      this.scmIntegrations
    );
    switch (type) {
      case "url": {
        options?.logger?.debug(`Reading files from ${target}`);
        const response = await this.reader.readTree(target, {
          etag: options?.etag
        });
        const preparedDir = await response.dir();
        options?.logger?.debug(`Tree downloaded and stored at ${preparedDir}`);
        return {
          preparedDir,
          etag: response.etag
        };
      }
      case "dir": {
        return {
          // the transformation already validated that the target is in a safe location
          preparedDir: target,
          // Instead of supporting caching on local sources, use techdocs-cli for local development and debugging.
          etag: ""
        };
      }
      default:
        throw new errors$d.InputError(`Unable to resolve location type ${type}`);
    }
  }
}

dir_cjs.DirectoryPreparer = DirectoryPreparer;

var url_cjs = {};

var errors$c = require$$0$5;
var helpers$c = helpers_cjs;

class UrlPreparer {
  logger;
  reader;
  /**
   * Returns a directory preparer instance
   * @param config - A URL preparer config containing the a logger and reader
   */
  static fromConfig(options) {
    return new UrlPreparer(options.reader, options.logger);
  }
  constructor(reader, logger) {
    this.logger = logger;
    this.reader = reader;
  }
  /** {@inheritDoc PreparerBase.shouldCleanPreparedDirectory} */
  shouldCleanPreparedDirectory() {
    return true;
  }
  /** {@inheritDoc PreparerBase.prepare} */
  async prepare(entity, options) {
    try {
      return await helpers$c.getDocFilesFromRepository(this.reader, entity, {
        etag: options?.etag,
        logger: this.logger
      });
    } catch (error) {
      errors$c.assertError(error);
      if (error.name === "NotModifiedError") {
        this.logger.debug(`Cache is valid for etag ${options?.etag}`);
      } else {
        this.logger.debug(
          `Unable to fetch files for building docs ${error.message}`
        );
      }
      throw error;
    }
  }
}

url_cjs.UrlPreparer = UrlPreparer;

var preparers_cjs = {};

var pluginTechdocsCommon = require$$0;
var helpers$b = helpers_cjs;
var dir$1 = dir_cjs;
var url$1 = url_cjs;

class Preparers {
  preparerMap = /* @__PURE__ */ new Map();
  /**
   * Returns a generators instance containing a generator for TechDocs
   * @public
   * @param backstageConfig - A Backstage configuration
   * @param preparerConfig - Options to configure preparers
   */
  static async fromConfig(backstageConfig, options) {
    const preparers = new Preparers();
    const urlPreparer = url$1.UrlPreparer.fromConfig({
      reader: options.reader,
      logger: options.logger
    });
    preparers.register("url", urlPreparer);
    const directoryPreparer = dir$1.DirectoryPreparer.fromConfig(backstageConfig, {
      reader: options.reader,
      logger: options.logger
    });
    preparers.register("dir", directoryPreparer);
    return preparers;
  }
  /**
   * Register a preparer in the preparers collection
   * @param protocol - url or dir to associate with preparer
   * @param preparer - The preparer instance to set
   */
  register(protocol, preparer) {
    this.preparerMap.set(protocol, preparer);
  }
  /**
   * Returns the preparer for a given TechDocs entity
   * @param entity - A TechDocs entity instance
   * @returns
   */
  get(entity) {
    const { type } = helpers$b.parseReferenceAnnotation(pluginTechdocsCommon.TECHDOCS_ANNOTATION, entity);
    const preparer = this.preparerMap.get(type);
    if (!preparer) {
      throw new Error(`No preparer registered for type: "${type}"`);
    }
    return preparer;
  }
}

preparers_cjs.Preparers = Preparers;

var publish_cjs = {};

var awsS3_cjs = {};

var errors$b = require$$0$5;
var integrationAwsNode = require$$1$4;
var clientS3 = require$$2$1;
var credentialProviders = require$$3$3;
var nodeHttpHandler = require$$4$4;
var libStorage = require$$5$2;
var hpagent = require$$6$2;
var fs$4 = require$$3$2;
var JSON5$3 = require$$8;
var createLimiter$3 = require$$5;
var path$6 = require$$6$1;
var helpers$a = helpers_cjs$1;

function _interopDefaultCompat$a (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$4 = /*#__PURE__*/_interopDefaultCompat$a(fs$4);
var JSON5__default$3 = /*#__PURE__*/_interopDefaultCompat$a(JSON5$3);
var createLimiter__default$3 = /*#__PURE__*/_interopDefaultCompat$a(createLimiter$3);
var path__default$6 = /*#__PURE__*/_interopDefaultCompat$a(path$6);

const streamToBuffer$1 = (stream) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on(
        "error",
        (e) => reject(new errors$b.ForwardedError("Unable to read stream", e))
      );
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (e) {
      throw new errors$b.ForwardedError("Unable to parse the response data", e);
    }
  });
};
class AwsS3Publish {
  storageClient;
  bucketName;
  legacyPathCasing;
  logger;
  bucketRootPath;
  sse;
  constructor(options) {
    this.storageClient = options.storageClient;
    this.bucketName = options.bucketName;
    this.legacyPathCasing = options.legacyPathCasing;
    this.logger = options.logger;
    this.bucketRootPath = options.bucketRootPath;
    this.sse = options.sse;
  }
  static async fromConfig(config, logger) {
    let bucketName = "";
    try {
      bucketName = config.getString("techdocs.publisher.awsS3.bucketName");
    } catch (error) {
      throw new Error(
        "Since techdocs.publisher.type is set to 'awsS3' in your app config, techdocs.publisher.awsS3.bucketName is required."
      );
    }
    const bucketRootPath = helpers$a.normalizeExternalStorageRootPath(
      config.getOptionalString("techdocs.publisher.awsS3.bucketRootPath") || ""
    );
    const sse = config.getOptionalString("techdocs.publisher.awsS3.sse");
    const region = config.getOptionalString("techdocs.publisher.awsS3.region");
    const accountId = config.getOptionalString(
      "techdocs.publisher.awsS3.accountId"
    );
    const credentialsConfig = config.getOptionalConfig(
      "techdocs.publisher.awsS3.credentials"
    );
    const credsManager = integrationAwsNode.DefaultAwsCredentialsManager.fromConfig(config);
    const sdkCredentialProvider = await AwsS3Publish.buildCredentials(
      credsManager,
      accountId,
      credentialsConfig,
      region
    );
    const endpoint = config.getOptionalString(
      "techdocs.publisher.awsS3.endpoint"
    );
    const httpsProxy = config.getOptionalString(
      "techdocs.publisher.awsS3.httpsProxy"
    );
    const forcePathStyle = config.getOptionalBoolean(
      "techdocs.publisher.awsS3.s3ForcePathStyle"
    );
    const storageClient = new clientS3.S3Client({
      customUserAgent: "backstage-aws-techdocs-s3-publisher",
      credentialDefaultProvider: () => sdkCredentialProvider,
      ...region && { region },
      ...endpoint && { endpoint },
      ...forcePathStyle && { forcePathStyle },
      ...httpsProxy && {
        requestHandler: new nodeHttpHandler.NodeHttpHandler({
          httpsAgent: new hpagent.HttpsProxyAgent({ proxy: httpsProxy })
        })
      }
    });
    const legacyPathCasing = config.getOptionalBoolean(
      "techdocs.legacyUseCaseSensitiveTripletPaths"
    ) || false;
    return new AwsS3Publish({
      storageClient,
      bucketName,
      bucketRootPath,
      legacyPathCasing,
      logger,
      sse
    });
  }
  static buildStaticCredentials(accessKeyId, secretAccessKey) {
    return async () => {
      return Promise.resolve({
        accessKeyId,
        secretAccessKey
      });
    };
  }
  static async buildCredentials(credsManager, accountId, config, region) {
    if (accountId) {
      return (await credsManager.getCredentialProvider({ accountId })).sdkCredentialProvider;
    }
    if (!config) {
      return (await credsManager.getCredentialProvider()).sdkCredentialProvider;
    }
    const accessKeyId = config.getOptionalString("accessKeyId");
    const secretAccessKey = config.getOptionalString("secretAccessKey");
    const explicitCredentials = accessKeyId && secretAccessKey ? AwsS3Publish.buildStaticCredentials(accessKeyId, secretAccessKey) : (await credsManager.getCredentialProvider()).sdkCredentialProvider;
    const roleArn = config.getOptionalString("roleArn");
    if (roleArn) {
      return credentialProviders.fromTemporaryCredentials({
        masterCredentials: explicitCredentials,
        params: {
          RoleSessionName: "backstage-aws-techdocs-s3-publisher",
          RoleArn: roleArn
        },
        clientConfig: { region }
      });
    }
    return explicitCredentials;
  }
  /**
   * Check if the defined bucket exists. Being able to connect means the configuration is good
   * and the storage client will work.
   */
  async getReadiness() {
    try {
      await this.storageClient.send(
        new clientS3.HeadBucketCommand({ Bucket: this.bucketName })
      );
      this.logger.info(
        `Successfully connected to the AWS S3 bucket ${this.bucketName}.`
      );
      return { isAvailable: true };
    } catch (error) {
      this.logger.error(
        `Could not retrieve metadata about the AWS S3 bucket ${this.bucketName}. Make sure the bucket exists. Also make sure that authentication is setup either by explicitly defining credentials and region in techdocs.publisher.awsS3 in app config or by using environment variables. Refer to https://backstage.io/docs/features/techdocs/using-cloud-storage`
      );
      this.logger.error(`from AWS client library`, error);
      return {
        isAvailable: false
      };
    }
  }
  /**
   * Upload all the files from the generated `directory` to the S3 bucket.
   * Directory structure used in the bucket is - entityNamespace/entityKind/entityName/index.html
   */
  async publish({
    entity,
    directory
  }) {
    const objects = [];
    const useLegacyPathCasing = this.legacyPathCasing;
    const bucketRootPath = this.bucketRootPath;
    const sse = this.sse;
    let existingFiles = [];
    try {
      const remoteFolder = helpers$a.getCloudPathForLocalPath(
        entity,
        void 0,
        useLegacyPathCasing,
        bucketRootPath
      );
      existingFiles = await this.getAllObjectsFromBucket({
        prefix: remoteFolder
      });
    } catch (e) {
      errors$b.assertError(e);
      this.logger.error(
        `Unable to list files for Entity ${entity.metadata.name}: ${e.message}`
      );
    }
    let absoluteFilesToUpload;
    try {
      absoluteFilesToUpload = await helpers$a.getFileTreeRecursively(directory);
      await helpers$a.bulkStorageOperation(
        async (absoluteFilePath) => {
          const relativeFilePath = path__default$6.default.relative(directory, absoluteFilePath);
          const fileStream = fs__default$4.default.createReadStream(absoluteFilePath);
          const params = {
            Bucket: this.bucketName,
            Key: helpers$a.getCloudPathForLocalPath(
              entity,
              relativeFilePath,
              useLegacyPathCasing,
              bucketRootPath
            ),
            Body: fileStream,
            ...sse && { ServerSideEncryption: sse }
          };
          objects.push(params.Key);
          const upload = new libStorage.Upload({
            client: this.storageClient,
            params
          });
          return upload.done();
        },
        absoluteFilesToUpload,
        { concurrencyLimit: 10 }
      );
      this.logger.info(
        `Successfully uploaded all the generated files for Entity ${entity.metadata.name}. Total number of files: ${absoluteFilesToUpload.length}`
      );
    } catch (e) {
      const errorMessage = `Unable to upload file(s) to AWS S3. ${e}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    try {
      const relativeFilesToUpload = absoluteFilesToUpload.map(
        (absoluteFilePath) => helpers$a.getCloudPathForLocalPath(
          entity,
          path__default$6.default.relative(directory, absoluteFilePath),
          useLegacyPathCasing,
          bucketRootPath
        )
      );
      const staleFiles = helpers$a.getStaleFiles(relativeFilesToUpload, existingFiles);
      await helpers$a.bulkStorageOperation(
        async (relativeFilePath) => {
          return await this.storageClient.send(
            new clientS3.DeleteObjectCommand({
              Bucket: this.bucketName,
              Key: relativeFilePath
            })
          );
        },
        staleFiles,
        { concurrencyLimit: 10 }
      );
      this.logger.info(
        `Successfully deleted stale files for Entity ${entity.metadata.name}. Total number of files: ${staleFiles.length}`
      );
    } catch (error) {
      const errorMessage = `Unable to delete file(s) from AWS S3. ${error}`;
      this.logger.error(errorMessage);
    }
    return { objects };
  }
  async fetchTechDocsMetadata(entityName) {
    try {
      return await new Promise(async (resolve, reject) => {
        const entityTriplet = `${entityName.namespace}/${entityName.kind}/${entityName.name}`;
        const entityDir = this.legacyPathCasing ? entityTriplet : helpers$a.lowerCaseEntityTriplet(entityTriplet);
        const entityRootDir = path__default$6.default.posix.join(this.bucketRootPath, entityDir);
        if (!helpers$a.isValidContentPath(this.bucketRootPath, entityRootDir)) {
          this.logger.error(
            `Invalid content path found while fetching TechDocs metadata: ${entityRootDir}`
          );
          throw new Error(`Metadata Not Found`);
        }
        try {
          const resp = await this.storageClient.send(
            new clientS3.GetObjectCommand({
              Bucket: this.bucketName,
              Key: `${entityRootDir}/techdocs_metadata.json`
            })
          );
          const techdocsMetadataJson = await streamToBuffer$1(
            resp.Body
          );
          if (!techdocsMetadataJson) {
            throw new Error(
              `Unable to parse the techdocs metadata file ${entityRootDir}/techdocs_metadata.json.`
            );
          }
          const techdocsMetadata = JSON5__default$3.default.parse(
            techdocsMetadataJson.toString("utf-8")
          );
          resolve(techdocsMetadata);
        } catch (err) {
          errors$b.assertError(err);
          this.logger.error(err.message);
          reject(new Error(err.message));
        }
      });
    } catch (e) {
      throw new errors$b.ForwardedError("TechDocs metadata fetch failed", e);
    }
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return async (req, res) => {
      const decodedUri = decodeURI(req.path.replace(/^\//, ""));
      const filePathNoRoot = this.legacyPathCasing ? decodedUri : helpers$a.lowerCaseEntityTripletInStoragePath(decodedUri);
      const filePath = path__default$6.default.posix.join(this.bucketRootPath, filePathNoRoot);
      if (!helpers$a.isValidContentPath(this.bucketRootPath, filePath)) {
        this.logger.error(
          `Attempted to fetch TechDocs content for a file outside of the bucket root: ${filePathNoRoot}`
        );
        res.status(404).send("File Not Found");
        return;
      }
      const fileExtension = path__default$6.default.extname(filePath);
      const responseHeaders = helpers$a.getHeadersForFileExtension(fileExtension);
      try {
        const resp = await this.storageClient.send(
          new clientS3.GetObjectCommand({ Bucket: this.bucketName, Key: filePath })
        );
        for (const [headerKey, headerValue] of Object.entries(
          responseHeaders
        )) {
          res.setHeader(headerKey, headerValue);
        }
        res.send(await streamToBuffer$1(resp.Body));
      } catch (err) {
        errors$b.assertError(err);
        this.logger.warn(
          `TechDocs S3 router failed to serve static files from bucket ${this.bucketName} at key ${filePath}: ${err.message}`
        );
        res.status(404).send("File Not Found");
      }
    };
  }
  /**
   * A helper function which checks if index.html of an Entity's docs site is available. This
   * can be used to verify if there are any pre-generated docs available to serve.
   */
  async hasDocsBeenGenerated(entity) {
    try {
      const entityTriplet = `${entity.metadata.namespace}/${entity.kind}/${entity.metadata.name}`;
      const entityDir = this.legacyPathCasing ? entityTriplet : helpers$a.lowerCaseEntityTriplet(entityTriplet);
      const entityRootDir = path__default$6.default.posix.join(this.bucketRootPath, entityDir);
      if (!helpers$a.isValidContentPath(this.bucketRootPath, entityRootDir)) {
        this.logger.error(
          `Invalid content path found while checking if docs have been generated: ${entityRootDir}`
        );
        return Promise.resolve(false);
      }
      await this.storageClient.send(
        new clientS3.HeadObjectCommand({
          Bucket: this.bucketName,
          Key: `${entityRootDir}/index.html`
        })
      );
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }
  async migrateDocsCase({
    removeOriginal = false,
    concurrency = 25
  }) {
    const allObjects = await this.getAllObjectsFromBucket();
    const limiter = createLimiter__default$3.default(concurrency);
    await Promise.all(
      allObjects.map(
        (f) => limiter(async (file) => {
          let newPath;
          try {
            newPath = helpers$a.lowerCaseEntityTripletInStoragePath(file);
          } catch (e) {
            errors$b.assertError(e);
            this.logger.warn(e.message);
            return;
          }
          if (file === newPath) {
            return;
          }
          try {
            this.logger.debug(`Migrating ${file}`);
            await this.storageClient.send(
              new clientS3.CopyObjectCommand({
                Bucket: this.bucketName,
                CopySource: [this.bucketName, file].join("/"),
                Key: newPath
              })
            );
            if (removeOriginal) {
              await this.storageClient.send(
                new clientS3.DeleteObjectCommand({
                  Bucket: this.bucketName,
                  Key: file
                })
              );
            }
          } catch (e) {
            errors$b.assertError(e);
            this.logger.warn(`Unable to migrate ${file}: ${e.message}`);
          }
        }, f)
      )
    );
  }
  /**
   * Returns a list of all object keys from the configured bucket.
   */
  async getAllObjectsFromBucket({ prefix } = { prefix: "" }) {
    const objects = [];
    let nextContinuation;
    let allObjects;
    do {
      allObjects = await this.storageClient.send(
        new clientS3.ListObjectsV2Command({
          Bucket: this.bucketName,
          ContinuationToken: nextContinuation,
          ...prefix ? { Prefix: prefix } : {}
        })
      );
      objects.push(
        ...(allObjects.Contents || []).map((f) => f.Key || "").filter((f) => !!f)
      );
      nextContinuation = allObjects.NextContinuationToken;
    } while (nextContinuation);
    return objects;
  }
}

awsS3_cjs.AwsS3Publish = AwsS3Publish;

var azureBlobStorage_cjs = {};

var identity = require$$0$7;
var storageBlob = require$$1$5;
var errors$a = require$$0$5;
var JSON5$2 = require$$8;
var createLimiter$2 = require$$5;
var path$5 = require$$6$1;
var helpers$9 = helpers_cjs$1;

function _interopDefaultCompat$9 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var JSON5__default$2 = /*#__PURE__*/_interopDefaultCompat$9(JSON5$2);
var createLimiter__default$2 = /*#__PURE__*/_interopDefaultCompat$9(createLimiter$2);
var path__default$5 = /*#__PURE__*/_interopDefaultCompat$9(path$5);

const BATCH_CONCURRENCY = 3;
class AzureBlobStoragePublish {
  storageClient;
  containerName;
  legacyPathCasing;
  logger;
  constructor(options) {
    this.storageClient = options.storageClient;
    this.containerName = options.containerName;
    this.legacyPathCasing = options.legacyPathCasing;
    this.logger = options.logger;
  }
  static fromConfig(config, logger) {
    let storageClient;
    let containerName = "";
    try {
      containerName = config.getString(
        "techdocs.publisher.azureBlobStorage.containerName"
      );
    } catch (error) {
      throw new Error(
        "Since techdocs.publisher.type is set to 'azureBlobStorage' in your app config, techdocs.publisher.azureBlobStorage.containerName is required."
      );
    }
    const legacyPathCasing = config.getOptionalBoolean(
      "techdocs.legacyUseCaseSensitiveTripletPaths"
    ) || false;
    const connectionStringKey = "techdocs.publisher.azureBlobStorage.connectionString";
    const connectionString = config.getOptionalString(connectionStringKey);
    if (connectionString) {
      logger.info(
        `Using '${connectionStringKey}' configuration to create storage client`
      );
      storageClient = storageBlob.BlobServiceClient.fromConnectionString(connectionString);
    } else {
      let accountName = "";
      try {
        accountName = config.getString(
          "techdocs.publisher.azureBlobStorage.credentials.accountName"
        );
      } catch (error) {
        throw new Error(
          "Since techdocs.publisher.type is set to 'azureBlobStorage' in your app config, techdocs.publisher.azureBlobStorage.credentials.accountName is required."
        );
      }
      const accountKey = config.getOptionalString(
        "techdocs.publisher.azureBlobStorage.credentials.accountKey"
      );
      let credential;
      if (accountKey) {
        credential = new storageBlob.StorageSharedKeyCredential(accountName, accountKey);
      } else {
        credential = new identity.DefaultAzureCredential();
      }
      storageClient = new storageBlob.BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential
      );
    }
    return new AzureBlobStoragePublish({
      storageClient,
      containerName,
      legacyPathCasing,
      logger
    });
  }
  async getReadiness() {
    try {
      const response = await this.storageClient.getContainerClient(this.containerName).getProperties();
      if (response._response.status === 200) {
        return {
          isAvailable: true
        };
      }
      if (response._response.status >= 400) {
        this.logger.error(
          `Failed to retrieve metadata from ${response._response.request.url} with status code ${response._response.status}.`
        );
      }
    } catch (e) {
      errors$a.assertError(e);
      this.logger.error(`from Azure Blob Storage client library: ${e.message}`);
    }
    this.logger.error(
      `Could not retrieve metadata about the Azure Blob Storage container ${this.containerName}. Make sure that the Azure project and container exist and the access key is setup correctly techdocs.publisher.azureBlobStorage.credentials defined in app config has correct permissions. Refer to https://backstage.io/docs/features/techdocs/using-cloud-storage`
    );
    return { isAvailable: false };
  }
  /**
   * Upload all the files from the generated `directory` to the Azure Blob Storage container.
   * Directory structure used in the container is - entityNamespace/entityKind/entityName/index.html
   */
  async publish({
    entity,
    directory
  }) {
    const objects = [];
    const useLegacyPathCasing = this.legacyPathCasing;
    const remoteFolder = helpers$9.getCloudPathForLocalPath(
      entity,
      void 0,
      useLegacyPathCasing
    );
    let existingFiles = [];
    try {
      existingFiles = await this.getAllBlobsFromContainer({
        prefix: remoteFolder,
        maxPageSize: BATCH_CONCURRENCY
      });
    } catch (e) {
      errors$a.assertError(e);
      this.logger.error(
        `Unable to list files for Entity ${entity.metadata.name}: ${e.message}`
      );
    }
    let absoluteFilesToUpload;
    let container;
    try {
      absoluteFilesToUpload = await helpers$9.getFileTreeRecursively(directory);
      container = this.storageClient.getContainerClient(this.containerName);
      const failedOperations = [];
      await helpers$9.bulkStorageOperation(
        async (absoluteFilePath) => {
          const relativeFilePath = path__default$5.default.normalize(
            path__default$5.default.relative(directory, absoluteFilePath)
          );
          const remotePath = helpers$9.getCloudPathForLocalPath(
            entity,
            relativeFilePath,
            useLegacyPathCasing
          );
          objects.push(remotePath);
          const response = await container.getBlockBlobClient(remotePath).uploadFile(absoluteFilePath);
          if (response._response.status >= 400) {
            failedOperations.push(
              new Error(
                `Upload failed for ${absoluteFilePath} with status code ${response._response.status}`
              )
            );
          }
          return response;
        },
        absoluteFilesToUpload,
        { concurrencyLimit: BATCH_CONCURRENCY }
      );
      if (failedOperations.length > 0) {
        throw new Error(
          failedOperations.map((r) => r.message).filter(Boolean).join(" ")
        );
      }
      this.logger.info(
        `Successfully uploaded all the generated files for Entity ${entity.metadata.name}. Total number of files: ${absoluteFilesToUpload.length}`
      );
    } catch (e) {
      const errorMessage = `Unable to upload file(s) to Azure. ${e}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    try {
      const relativeFilesToUpload = absoluteFilesToUpload.map(
        (absoluteFilePath) => helpers$9.getCloudPathForLocalPath(
          entity,
          path__default$5.default.relative(directory, absoluteFilePath),
          useLegacyPathCasing
        )
      );
      const staleFiles = helpers$9.getStaleFiles(relativeFilesToUpload, existingFiles);
      await helpers$9.bulkStorageOperation(
        async (relativeFilePath) => {
          return await container.deleteBlob(relativeFilePath);
        },
        staleFiles,
        { concurrencyLimit: BATCH_CONCURRENCY }
      );
      this.logger.info(
        `Successfully deleted stale files for Entity ${entity.metadata.name}. Total number of files: ${staleFiles.length}`
      );
    } catch (error) {
      const errorMessage = `Unable to delete file(s) from Azure. ${error}`;
      this.logger.error(errorMessage);
    }
    return { objects };
  }
  download(containerName, blobPath) {
    return new Promise((resolve, reject) => {
      const fileStreamChunks = [];
      this.storageClient.getContainerClient(containerName).getBlockBlobClient(blobPath).download().then((res) => {
        const body = res.readableStreamBody;
        if (!body) {
          reject(new Error(`Unable to parse the response data`));
          return;
        }
        body.on("error", reject).on("data", (chunk) => {
          fileStreamChunks.push(chunk);
        }).on("end", () => {
          resolve(Buffer.concat(fileStreamChunks));
        });
      }).catch(reject);
    });
  }
  async fetchTechDocsMetadata(entityName) {
    const entityTriplet = `${entityName.namespace}/${entityName.kind}/${entityName.name}`;
    const entityRootDir = this.legacyPathCasing ? entityTriplet : helpers$9.lowerCaseEntityTriplet(entityTriplet);
    try {
      const techdocsMetadataJson = await this.download(
        this.containerName,
        `${entityRootDir}/techdocs_metadata.json`
      );
      if (!techdocsMetadataJson) {
        throw new Error(
          `Unable to parse the techdocs metadata file ${entityRootDir}/techdocs_metadata.json.`
        );
      }
      const techdocsMetadata = JSON5__default$2.default.parse(
        techdocsMetadataJson.toString("utf-8")
      );
      return techdocsMetadata;
    } catch (e) {
      throw new errors$a.ForwardedError("TechDocs metadata fetch failed", e);
    }
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return (req, res) => {
      const decodedUri = decodeURI(req.path.replace(/^\//, ""));
      const filePath = this.legacyPathCasing ? decodedUri : helpers$9.lowerCaseEntityTripletInStoragePath(decodedUri);
      const fileExtension = path__default$5.default.extname(filePath);
      const responseHeaders = helpers$9.getHeadersForFileExtension(fileExtension);
      this.download(this.containerName, filePath).then((fileContent) => {
        for (const [headerKey, headerValue] of Object.entries(
          responseHeaders
        )) {
          res.setHeader(headerKey, headerValue);
        }
        res.send(fileContent);
      }).catch((e) => {
        this.logger.warn(
          `TechDocs Azure router failed to serve content from container ${this.containerName} at path ${filePath}: ${e.message}`
        );
        res.status(404).send("File Not Found");
      });
    };
  }
  /**
   * A helper function which checks if index.html of an Entity's docs site is available. This
   * can be used to verify if there are any pre-generated docs available to serve.
   */
  hasDocsBeenGenerated(entity) {
    const entityTriplet = `${entity.metadata.namespace}/${entity.kind}/${entity.metadata.name}`;
    const entityRootDir = this.legacyPathCasing ? entityTriplet : helpers$9.lowerCaseEntityTriplet(entityTriplet);
    return this.storageClient.getContainerClient(this.containerName).getBlockBlobClient(`${entityRootDir}/index.html`).exists();
  }
  async renameBlob(originalName, newName, removeOriginal = false) {
    const container = this.storageClient.getContainerClient(this.containerName);
    const blob = container.getBlobClient(newName);
    const { url } = container.getBlobClient(originalName);
    const response = await blob.beginCopyFromURL(url);
    await response.pollUntilDone();
    if (removeOriginal) {
      await container.deleteBlob(originalName);
    }
  }
  async renameBlobToLowerCase(originalPath, removeOriginal) {
    let newPath;
    try {
      newPath = helpers$9.lowerCaseEntityTripletInStoragePath(originalPath);
    } catch (e) {
      errors$a.assertError(e);
      this.logger.warn(e.message);
      return;
    }
    if (originalPath === newPath) return;
    try {
      this.logger.debug(`Migrating ${originalPath}`);
      await this.renameBlob(originalPath, newPath, removeOriginal);
    } catch (e) {
      errors$a.assertError(e);
      this.logger.warn(`Unable to migrate ${originalPath}: ${e.message}`);
    }
  }
  async migrateDocsCase({
    removeOriginal = false,
    concurrency = 25
  }) {
    const promises = [];
    const limiter = createLimiter__default$2.default(concurrency);
    const container = this.storageClient.getContainerClient(this.containerName);
    for await (const blob of container.listBlobsFlat()) {
      promises.push(
        limiter(
          this.renameBlobToLowerCase.bind(this),
          blob.name,
          removeOriginal
        )
      );
    }
    await Promise.all(promises);
  }
  async getAllBlobsFromContainer({
    prefix,
    maxPageSize
  }) {
    const blobs = [];
    const container = this.storageClient.getContainerClient(this.containerName);
    let iterator = container.listBlobsFlat({ prefix }).byPage({ maxPageSize });
    let response = (await iterator.next()).value;
    do {
      for (const blob of response?.segment?.blobItems ?? []) {
        blobs.push(blob.name);
      }
      iterator = container.listBlobsFlat({ prefix }).byPage({ continuationToken: response.continuationToken, maxPageSize });
      response = (await iterator.next()).value;
    } while (response && response.continuationToken);
    return blobs;
  }
}

azureBlobStorage_cjs.AzureBlobStoragePublish = AzureBlobStoragePublish;

var googleStorage_cjs = {};

var GoogleMigration_cjs = {};

var errors$9 = require$$0$5;
var stream$2 = require$$6;
var helpers$8 = helpers_cjs$1;

class MigrateWriteStream extends stream$2.Writable {
  logger;
  removeOriginal;
  maxConcurrency;
  inFlight = 0;
  constructor(logger, removeOriginal, concurrency) {
    super({ objectMode: true });
    this.logger = logger;
    this.removeOriginal = removeOriginal;
    this.maxConcurrency = concurrency;
  }
  _write(file, _encoding, next) {
    let shouldCallNext = true;
    let newFile;
    try {
      newFile = helpers$8.lowerCaseEntityTripletInStoragePath(file.name);
    } catch (e) {
      errors$9.assertError(e);
      this.logger.warn(e.message);
      next();
      return;
    }
    if (newFile === file.name) {
      next();
      return;
    }
    this.inFlight++;
    if (this.inFlight < this.maxConcurrency) {
      next();
      shouldCallNext = false;
    }
    const migrate = this.removeOriginal ? file.move.bind(file) : file.copy.bind(file);
    this.logger.debug(`Migrating ${file.name}`);
    migrate(newFile).catch(
      (e) => this.logger.warn(`Unable to migrate ${file.name}: ${e.message}`)
    ).finally(() => {
      this.inFlight--;
      if (shouldCallNext) {
        next();
      }
    });
  }
}

GoogleMigration_cjs.MigrateWriteStream = MigrateWriteStream;

var errors$8 = require$$0$5;
var storage = require$$1$6;
var JSON5$1 = require$$8;
var path$4 = require$$6$1;
var helpers$7 = helpers_cjs$1;
var GoogleMigration = GoogleMigration_cjs;

function _interopDefaultCompat$8 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var JSON5__default$1 = /*#__PURE__*/_interopDefaultCompat$8(JSON5$1);
var path__default$4 = /*#__PURE__*/_interopDefaultCompat$8(path$4);

class GoogleGCSPublish {
  storageClient;
  bucketName;
  legacyPathCasing;
  logger;
  bucketRootPath;
  constructor(options) {
    this.storageClient = options.storageClient;
    this.bucketName = options.bucketName;
    this.legacyPathCasing = options.legacyPathCasing;
    this.logger = options.logger;
    this.bucketRootPath = options.bucketRootPath;
  }
  static fromConfig(config, logger, options) {
    let bucketName = "";
    try {
      bucketName = config.getString("techdocs.publisher.googleGcs.bucketName");
    } catch (error) {
      throw new Error(
        "Since techdocs.publisher.type is set to 'googleGcs' in your app config, techdocs.publisher.googleGcs.bucketName is required."
      );
    }
    const bucketRootPath = helpers$7.normalizeExternalStorageRootPath(
      config.getOptionalString("techdocs.publisher.googleGcs.bucketRootPath") || ""
    );
    const credentials = config.getOptionalString(
      "techdocs.publisher.googleGcs.credentials"
    );
    const projectId = config.getOptionalString(
      "techdocs.publisher.googleGcs.projectId"
    );
    let credentialsJson = {};
    if (credentials) {
      try {
        credentialsJson = JSON.parse(credentials);
      } catch (err) {
        throw new Error(
          "Error in parsing techdocs.publisher.googleGcs.credentials config to JSON."
        );
      }
    }
    const clientOpts = options ?? {};
    if (projectId) {
      clientOpts.projectId = projectId;
    }
    const storageClient = new storage.Storage({
      ...credentials && {
        projectId: credentialsJson.project_id,
        credentials: credentialsJson
      },
      ...clientOpts
    });
    const legacyPathCasing = config.getOptionalBoolean(
      "techdocs.legacyUseCaseSensitiveTripletPaths"
    ) || false;
    return new GoogleGCSPublish({
      storageClient,
      bucketName,
      legacyPathCasing,
      logger,
      bucketRootPath
    });
  }
  /**
   * Check if the defined bucket exists. Being able to connect means the configuration is good
   * and the storage client will work.
   */
  async getReadiness() {
    try {
      await this.storageClient.bucket(this.bucketName).getMetadata();
      this.logger.info(
        `Successfully connected to the GCS bucket ${this.bucketName}.`
      );
      return {
        isAvailable: true
      };
    } catch (err) {
      errors$8.assertError(err);
      this.logger.error(
        `Could not retrieve metadata about the GCS bucket ${this.bucketName}. Make sure the bucket exists. Also make sure that authentication is setup either by explicitly defining techdocs.publisher.googleGcs.credentials in app config or by using environment variables. Refer to https://backstage.io/docs/features/techdocs/using-cloud-storage`
      );
      this.logger.error(`from GCS client library: ${err.message}`);
      return { isAvailable: false };
    }
  }
  /**
   * Upload all the files from the generated `directory` to the GCS bucket.
   * Directory structure used in the bucket is - entityNamespace/entityKind/entityName/index.html
   */
  async publish({
    entity,
    directory
  }) {
    const objects = [];
    const useLegacyPathCasing = this.legacyPathCasing;
    const bucket = this.storageClient.bucket(this.bucketName);
    const bucketRootPath = this.bucketRootPath;
    let existingFiles = [];
    try {
      const remoteFolder = helpers$7.getCloudPathForLocalPath(
        entity,
        void 0,
        useLegacyPathCasing,
        bucketRootPath
      );
      existingFiles = await this.getFilesForFolder(remoteFolder);
    } catch (e) {
      errors$8.assertError(e);
      this.logger.error(
        `Unable to list files for Entity ${entity.metadata.name}: ${e.message}`
      );
    }
    let absoluteFilesToUpload;
    try {
      absoluteFilesToUpload = await helpers$7.getFileTreeRecursively(directory);
      await helpers$7.bulkStorageOperation(
        async (absoluteFilePath) => {
          const relativeFilePath = path__default$4.default.relative(directory, absoluteFilePath);
          const destination = helpers$7.getCloudPathForLocalPath(
            entity,
            relativeFilePath,
            useLegacyPathCasing,
            bucketRootPath
          );
          objects.push(destination);
          return await bucket.upload(absoluteFilePath, { destination });
        },
        absoluteFilesToUpload,
        { concurrencyLimit: 10 }
      );
      this.logger.info(
        `Successfully uploaded all the generated files for Entity ${entity.metadata.name}. Total number of files: ${absoluteFilesToUpload.length}`
      );
    } catch (e) {
      const errorMessage = `Unable to upload file(s) to Google Cloud Storage. ${e}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    try {
      const relativeFilesToUpload = absoluteFilesToUpload.map(
        (absoluteFilePath) => helpers$7.getCloudPathForLocalPath(
          entity,
          path__default$4.default.relative(directory, absoluteFilePath),
          useLegacyPathCasing,
          bucketRootPath
        )
      );
      const staleFiles = helpers$7.getStaleFiles(relativeFilesToUpload, existingFiles);
      await helpers$7.bulkStorageOperation(
        async (relativeFilePath) => {
          return await bucket.file(relativeFilePath).delete();
        },
        staleFiles,
        { concurrencyLimit: 10 }
      );
      this.logger.info(
        `Successfully deleted stale files for Entity ${entity.metadata.name}. Total number of files: ${staleFiles.length}`
      );
    } catch (error) {
      const errorMessage = `Unable to delete file(s) from Google Cloud Storage. ${error}`;
      this.logger.error(errorMessage);
    }
    return { objects };
  }
  fetchTechDocsMetadata(entityName) {
    return new Promise((resolve, reject) => {
      const entityTriplet = `${entityName.namespace}/${entityName.kind}/${entityName.name}`;
      const entityDir = this.legacyPathCasing ? entityTriplet : helpers$7.lowerCaseEntityTriplet(entityTriplet);
      const entityRootDir = path__default$4.default.posix.join(this.bucketRootPath, entityDir);
      if (!helpers$7.isValidContentPath(this.bucketRootPath, entityRootDir)) {
        this.logger.error(
          `Invalid content path found while fetching TechDocs metadata: ${entityRootDir}`
        );
        reject(new Error(`Metadata Not Found`));
      }
      const fileStreamChunks = [];
      this.storageClient.bucket(this.bucketName).file(`${entityRootDir}/techdocs_metadata.json`).createReadStream().on("error", (err) => {
        this.logger.error(err.message);
        reject(err);
      }).on("data", (chunk) => {
        fileStreamChunks.push(chunk);
      }).on("end", () => {
        const techdocsMetadataJson = Buffer.concat(fileStreamChunks).toString("utf-8");
        resolve(JSON5__default$1.default.parse(techdocsMetadataJson));
      });
    });
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return (req, res) => {
      const decodedUri = decodeURI(req.path.replace(/^\//, ""));
      const filePathNoRoot = this.legacyPathCasing ? decodedUri : helpers$7.lowerCaseEntityTripletInStoragePath(decodedUri);
      const filePath = path__default$4.default.posix.join(this.bucketRootPath, filePathNoRoot);
      if (!helpers$7.isValidContentPath(this.bucketRootPath, filePath)) {
        this.logger.error(
          `Attempted to fetch TechDocs content for a file outside of the bucket root: ${filePathNoRoot}`
        );
        res.status(404).send("File Not Found");
        return;
      }
      const fileExtension = path__default$4.default.extname(filePath);
      const responseHeaders = helpers$7.getHeadersForFileExtension(fileExtension);
      this.storageClient.bucket(this.bucketName).file(filePath).createReadStream().on("pipe", () => {
        res.writeHead(200, responseHeaders);
      }).on("error", (err) => {
        this.logger.warn(
          `TechDocs Google GCS router failed to serve content from bucket ${this.bucketName} at path ${filePath}: ${err.message}`
        );
        if (!res.headersSent) {
          res.status(404).send("File Not Found");
        } else {
          res.destroy();
        }
      }).pipe(res);
    };
  }
  /**
   * A helper function which checks if index.html of an Entity's docs site is available. This
   * can be used to verify if there are any pre-generated docs available to serve.
   */
  async hasDocsBeenGenerated(entity) {
    return new Promise((resolve) => {
      const entityTriplet = `${entity.metadata.namespace}/${entity.kind}/${entity.metadata.name}`;
      const entityDir = this.legacyPathCasing ? entityTriplet : helpers$7.lowerCaseEntityTriplet(entityTriplet);
      const entityRootDir = path__default$4.default.posix.join(this.bucketRootPath, entityDir);
      if (!helpers$7.isValidContentPath(this.bucketRootPath, entityRootDir)) {
        this.logger.error(
          `Invalid content path found while checking if docs have been generated: ${entityRootDir}`
        );
        resolve(false);
      }
      this.storageClient.bucket(this.bucketName).file(`${entityRootDir}/index.html`).exists().then((response) => {
        resolve(response[0]);
      }).catch(() => {
        resolve(false);
      });
    });
  }
  migrateDocsCase({ removeOriginal = false, concurrency = 25 }) {
    return new Promise((resolve, reject) => {
      const allFileMetadata = this.storageClient.bucket(this.bucketName).getFilesStream();
      const migrateFiles = new GoogleMigration.MigrateWriteStream(
        this.logger,
        removeOriginal,
        concurrency
      );
      migrateFiles.on("finish", resolve).on("error", reject);
      allFileMetadata.pipe(migrateFiles).on("error", (error) => {
        migrateFiles.destroy();
        reject(error);
      });
    });
  }
  getFilesForFolder(folder) {
    const fileMetadataStream = this.storageClient.bucket(this.bucketName).getFilesStream({ prefix: folder });
    return new Promise((resolve, reject) => {
      const files = [];
      fileMetadataStream.on("error", (error) => {
        reject(error);
      });
      fileMetadataStream.on("data", (file) => {
        files.push(file.name);
      });
      fileMetadataStream.on("end", () => {
        resolve(files);
      });
    });
  }
}

googleStorage_cjs.GoogleGCSPublish = GoogleGCSPublish;

var local_cjs = {};

var backendPluginApi$2 = require$$0$4;
var catalogModel$4 = require$$0$1;
var express = require$$2$2;
var fs$3 = require$$3$2;
var os$1 = require$$4$5;
var createLimiter$1 = require$$5;
var path$3 = require$$6$1;
var helpers$6 = helpers_cjs$1;
var errors$7 = require$$0$5;

function _interopDefaultCompat$7 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefaultCompat$7(express);
var fs__default$3 = /*#__PURE__*/_interopDefaultCompat$7(fs$3);
var os__default$1 = /*#__PURE__*/_interopDefaultCompat$7(os$1);
var createLimiter__default$1 = /*#__PURE__*/_interopDefaultCompat$7(createLimiter$1);
var path__default$3 = /*#__PURE__*/_interopDefaultCompat$7(path$3);

class LocalPublish {
  legacyPathCasing;
  logger;
  discovery;
  staticDocsDir;
  constructor(options) {
    this.logger = options.logger;
    this.discovery = options.discovery;
    this.legacyPathCasing = options.legacyPathCasing;
    this.staticDocsDir = options.staticDocsDir;
  }
  static fromConfig(config, logger, discovery) {
    const legacyPathCasing = config.getOptionalBoolean(
      "techdocs.legacyUseCaseSensitiveTripletPaths"
    ) || false;
    let staticDocsDir = config.getOptionalString(
      "techdocs.publisher.local.publishDirectory"
    );
    if (!staticDocsDir) {
      try {
        staticDocsDir = backendPluginApi$2.resolvePackagePath(
          "@backstage/plugin-techdocs-backend",
          "static/docs"
        );
      } catch (err) {
        staticDocsDir = os__default$1.default.tmpdir();
      }
    }
    return new LocalPublish({
      logger,
      discovery,
      legacyPathCasing,
      staticDocsDir
    });
  }
  async getReadiness() {
    return {
      isAvailable: true
    };
  }
  async publish({
    entity,
    directory
  }) {
    const entityNamespace = entity.metadata.namespace ?? "default";
    let publishDir;
    try {
      publishDir = this.staticEntityPathJoin(
        entityNamespace,
        entity.kind,
        entity.metadata.name
      );
    } catch (error) {
      throw new errors$7.ForwardedError(
        `Unable to publish TechDocs site for entity: ${catalogModel$4.stringifyEntityRef(
          entity
        )}`,
        error
      );
    }
    if (!fs__default$3.default.existsSync(publishDir)) {
      this.logger.info(`Could not find ${publishDir}, creating the directory.`);
      fs__default$3.default.mkdirSync(publishDir, { recursive: true });
    }
    try {
      await fs__default$3.default.copy(directory, publishDir);
      this.logger.info(`Published site stored at ${publishDir}`);
    } catch (error) {
      this.logger.debug(
        `Failed to copy docs from ${directory} to ${publishDir}`
      );
      throw error;
    }
    const techdocsApiUrl = await this.discovery.getBaseUrl("techdocs");
    const publishedFilePaths = (await helpers$6.getFileTreeRecursively(publishDir)).map(
      (abs) => {
        return abs.split(`${this.staticDocsDir}/`)[1];
      }
    );
    return {
      remoteUrl: `${techdocsApiUrl}/static/docs/${encodeURIComponent(
        entity.metadata.name
      )}`,
      objects: publishedFilePaths
    };
  }
  async fetchTechDocsMetadata(entityName) {
    let metadataPath;
    try {
      metadataPath = this.staticEntityPathJoin(
        entityName.namespace,
        entityName.kind,
        entityName.name,
        "techdocs_metadata.json"
      );
    } catch (err) {
      throw new errors$7.ForwardedError(
        `Unexpected entity when fetching metadata: ${catalogModel$4.stringifyEntityRef(
          entityName
        )}`,
        err
      );
    }
    try {
      return await fs__default$3.default.readJson(metadataPath);
    } catch (err) {
      throw new errors$7.ForwardedError(
        `Unable to read techdocs_metadata.json at ${metadataPath}. Error: ${err}`,
        err
      );
    }
  }
  docsRouter() {
    const router = express__default.default.Router();
    router.use((req, res, next) => {
      if (this.legacyPathCasing) {
        return next();
      }
      const [_, namespace, kind, name, ...rest] = req.path.split("/");
      if (!namespace || !kind || !name) {
        return next();
      }
      const newPath = [
        _,
        namespace.toLowerCase(),
        kind.toLowerCase(),
        name.toLowerCase(),
        ...rest
      ].join("/");
      if (newPath === req.path) {
        return next();
      }
      return res.redirect(301, req.baseUrl + newPath);
    });
    router.use(
      express__default.default.static(this.staticDocsDir, {
        // Handle content-type header the same as all other publishers.
        setHeaders: (res, filePath) => {
          const fileExtension = path__default$3.default.extname(filePath);
          const headers = helpers$6.getHeadersForFileExtension(fileExtension);
          for (const [header, value] of Object.entries(headers)) {
            res.setHeader(header, value);
          }
        }
      })
    );
    return router;
  }
  async hasDocsBeenGenerated(entity) {
    const namespace = entity.metadata.namespace ?? "default";
    try {
      const indexHtmlPath = this.staticEntityPathJoin(
        namespace,
        entity.kind,
        entity.metadata.name,
        "index.html"
      );
      await fs__default$3.default.access(indexHtmlPath, fs__default$3.default.constants.F_OK);
      return true;
    } catch (err) {
      if (err.name === "NotAllowedError") {
        this.logger.error(
          `Unexpected entity when checking if generated: ${catalogModel$4.stringifyEntityRef(
            entity
          )}`
        );
      }
      return false;
    }
  }
  /**
   * This code will never run in practice. It is merely here to illustrate how
   * to implement this method for other storage providers.
   */
  async migrateDocsCase({
    removeOriginal = false,
    concurrency = 25
  }) {
    const files = await helpers$6.getFileTreeRecursively(this.staticDocsDir);
    const limit = createLimiter__default$1.default(concurrency);
    await Promise.all(
      files.map(
        (f) => limit(async (file) => {
          const relativeFile = file.replace(
            `${this.staticDocsDir}${path__default$3.default.sep}`,
            ""
          );
          const newFile = helpers$6.lowerCaseEntityTripletInStoragePath(relativeFile);
          if (relativeFile === newFile) {
            return;
          }
          await new Promise((resolve) => {
            const migrate = removeOriginal ? fs__default$3.default.move : fs__default$3.default.copyFile;
            this.logger.debug(`Migrating ${relativeFile}`);
            migrate(file, newFile, (err) => {
              if (err) {
                this.logger.warn(
                  `Unable to migrate ${relativeFile}: ${err.message}`
                );
              }
              resolve();
            });
          });
        }, f)
      )
    );
  }
  /**
   * Utility wrapper around path.join(), used to control legacy case logic.
   */
  staticEntityPathJoin(...allParts) {
    let staticEntityPath = this.staticDocsDir;
    allParts.map((part) => part.split(path__default$3.default.sep)).flat().forEach((part, index) => {
      if (index < 3) {
        staticEntityPath = backendPluginApi$2.resolveSafeChildPath(
          staticEntityPath,
          this.legacyPathCasing ? part : part.toLowerCase()
        );
        return;
      }
      staticEntityPath = backendPluginApi$2.resolveSafeChildPath(staticEntityPath, part);
    });
    return staticEntityPath;
  }
}

local_cjs.LocalPublish = LocalPublish;

var openStackSwift_cjs = {};

var fs$2 = require$$3$2;
var JSON5 = require$$8;
var createLimiter = require$$5;
var path$2 = require$$6$1;
var openstackSwiftSdk = require$$4$6;
var types = require$$5$3;
var stream$1 = require$$6;
var helpers$5 = helpers_cjs$1;
var errors$6 = require$$0$5;

function _interopDefaultCompat$6 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$2 = /*#__PURE__*/_interopDefaultCompat$6(fs$2);
var JSON5__default = /*#__PURE__*/_interopDefaultCompat$6(JSON5);
var createLimiter__default = /*#__PURE__*/_interopDefaultCompat$6(createLimiter);
var path__default$2 = /*#__PURE__*/_interopDefaultCompat$6(path$2);

const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (e) {
      throw new errors$6.ForwardedError("Unable to parse the response data", e);
    }
  });
};
const bufferToStream = (buffer) => {
  const stream$1$1 = new stream$1.Readable();
  stream$1$1.push(buffer);
  stream$1$1.push(null);
  return stream$1$1;
};
class OpenStackSwiftPublish {
  storageClient;
  containerName;
  logger;
  constructor(options) {
    this.storageClient = options.storageClient;
    this.containerName = options.containerName;
    this.logger = options.logger;
  }
  static fromConfig(config, logger) {
    let containerName = "";
    try {
      containerName = config.getString(
        "techdocs.publisher.openStackSwift.containerName"
      );
    } catch (error) {
      throw new Error(
        "Since techdocs.publisher.type is set to 'openStackSwift' in your app config, techdocs.publisher.openStackSwift.containerName is required."
      );
    }
    const openStackSwiftConfig = config.getConfig(
      "techdocs.publisher.openStackSwift"
    );
    const storageClient = new openstackSwiftSdk.SwiftClient({
      authEndpoint: openStackSwiftConfig.getString("authUrl"),
      swiftEndpoint: openStackSwiftConfig.getString("swiftUrl"),
      credentialId: openStackSwiftConfig.getString("credentials.id"),
      secret: openStackSwiftConfig.getString("credentials.secret")
    });
    return new OpenStackSwiftPublish({ storageClient, containerName, logger });
  }
  /*
   * Check if the defined container exists. Being able to connect means the configuration is good
   * and the storage client will work.
   */
  async getReadiness() {
    try {
      const container = await this.storageClient.getContainerMetadata(
        this.containerName
      );
      if (!(container instanceof types.NotFound)) {
        this.logger.info(
          `Successfully connected to the OpenStack Swift container ${this.containerName}.`
        );
        return {
          isAvailable: true
        };
      }
      this.logger.error(
        `Could not retrieve metadata about the OpenStack Swift container ${this.containerName}. Make sure the container exists. Also make sure that authentication is setup either by explicitly defining credentials and region in techdocs.publisher.openStackSwift in app config or by using environment variables. Refer to https://backstage.io/docs/features/techdocs/using-cloud-storage`
      );
      return {
        isAvailable: false
      };
    } catch (err) {
      errors$6.assertError(err);
      this.logger.error(`from OpenStack client library: ${err.message}`);
      return {
        isAvailable: false
      };
    }
  }
  /**
   * Upload all the files from the generated `directory` to the OpenStack Swift container.
   * Directory structure used in the bucket is - entityNamespace/entityKind/entityName/index.html
   */
  async publish({
    entity,
    directory
  }) {
    try {
      const objects = [];
      const allFilesToUpload = await helpers$5.getFileTreeRecursively(directory);
      const limiter = createLimiter__default.default(10);
      const uploadPromises = [];
      for (const filePath of allFilesToUpload) {
        const relativeFilePath = path__default$2.default.relative(directory, filePath);
        const relativeFilePathPosix = relativeFilePath.split(path__default$2.default.sep).join(path__default$2.default.posix.sep);
        const entityRootDir = `${entity.metadata.namespace}/${entity.kind}/${entity.metadata.name}`;
        const destination = `${entityRootDir}/${relativeFilePathPosix}`;
        objects.push(destination);
        const uploadFile = limiter(async () => {
          const fileBuffer = await fs__default$2.default.readFile(filePath);
          const stream = bufferToStream(fileBuffer);
          return this.storageClient.upload(
            this.containerName,
            destination,
            stream
          );
        });
        uploadPromises.push(uploadFile);
      }
      await Promise.all(uploadPromises);
      this.logger.info(
        `Successfully uploaded all the generated files for Entity ${entity.metadata.name}. Total number of files: ${allFilesToUpload.length}`
      );
      return { objects };
    } catch (e) {
      const errorMessage = `Unable to upload file(s) to OpenStack Swift. ${e}`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
  }
  async fetchTechDocsMetadata(entityName) {
    return await new Promise(async (resolve, reject) => {
      const entityRootDir = `${entityName.namespace}/${entityName.kind}/${entityName.name}`;
      const downloadResponse = await this.storageClient.download(
        this.containerName,
        `${entityRootDir}/techdocs_metadata.json`
      );
      if (!(downloadResponse instanceof types.NotFound)) {
        const stream = downloadResponse.data;
        try {
          const techdocsMetadataJson = await streamToBuffer(stream);
          if (!techdocsMetadataJson) {
            throw new Error(
              `Unable to parse the techdocs metadata file ${entityRootDir}/techdocs_metadata.json.`
            );
          }
          const techdocsMetadata = JSON5__default.default.parse(
            techdocsMetadataJson.toString("utf-8")
          );
          resolve(techdocsMetadata);
        } catch (err) {
          errors$6.assertError(err);
          this.logger.error(err.message);
          reject(new Error(err.message));
        }
      } else {
        reject({
          message: `TechDocs metadata fetch failed, The file /rootDir/${entityRootDir}/techdocs_metadata.json does not exist !`
        });
      }
    });
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return async (req, res) => {
      const filePath = decodeURI(req.path.replace(/^\//, ""));
      const fileExtension = path__default$2.default.extname(filePath);
      const responseHeaders = helpers$5.getHeadersForFileExtension(fileExtension);
      const downloadResponse = await this.storageClient.download(
        this.containerName,
        filePath
      );
      if (!(downloadResponse instanceof types.NotFound)) {
        const stream = downloadResponse.data;
        try {
          for (const [headerKey, headerValue] of Object.entries(
            responseHeaders
          )) {
            res.setHeader(headerKey, headerValue);
          }
          res.send(await streamToBuffer(stream));
        } catch (err) {
          errors$6.assertError(err);
          this.logger.warn(
            `TechDocs OpenStack swift router failed to serve content from container ${this.containerName} at path ${filePath}: ${err.message}`
          );
          res.status(404).send("File Not Found");
        }
      } else {
        this.logger.warn(
          `TechDocs OpenStack swift router failed to serve content from container ${this.containerName} at path ${filePath}: Not found`
        );
        res.status(404).send("File Not Found");
      }
    };
  }
  /**
   * A helper function which checks if index.html of an Entity's docs site is available. This
   * can be used to verify if there are any pre-generated docs available to serve.
   */
  async hasDocsBeenGenerated(entity) {
    const entityRootDir = `${entity.metadata.namespace}/${entity.kind}/${entity.metadata.name}`;
    try {
      const fileResponse = await this.storageClient.getMetadata(
        this.containerName,
        `${entityRootDir}/index.html`
      );
      if (!(fileResponse instanceof types.NotFound)) {
        return true;
      }
      return false;
    } catch (err) {
      errors$6.assertError(err);
      this.logger.warn(err.message);
      return false;
    }
  }
  async migrateDocsCase({
    removeOriginal = false,
    concurrency = 25
  }) {
    const allObjects = await this.getAllObjectsFromContainer();
    const limiter = createLimiter__default.default(concurrency);
    await Promise.all(
      allObjects.map(
        (f) => limiter(async (file) => {
          let newPath;
          try {
            newPath = helpers$5.lowerCaseEntityTripletInStoragePath(file);
          } catch (e) {
            errors$6.assertError(e);
            this.logger.warn(e.message);
            return;
          }
          if (file === newPath) {
            return;
          }
          try {
            this.logger.debug(`Migrating ${file} to ${newPath}`);
            await this.storageClient.copy(
              this.containerName,
              file,
              this.containerName,
              newPath
            );
            if (removeOriginal) {
              await this.storageClient.delete(this.containerName, file);
            }
          } catch (e) {
            errors$6.assertError(e);
            this.logger.warn(`Unable to migrate ${file}: ${e.message}`);
          }
        }, f)
      )
    );
  }
  /**
   * Returns a list of all object keys from the configured container.
   */
  async getAllObjectsFromContainer({ prefix } = { prefix: "" }) {
    let objects = [];
    const OSS_MAX_LIMIT = Math.pow(2, 31) - 1;
    const allObjects = await this.storageClient.list(
      this.containerName,
      prefix,
      OSS_MAX_LIMIT
    );
    objects = allObjects.map((object) => object.name);
    return objects;
  }
}

openStackSwift_cjs.OpenStackSwiftPublish = OpenStackSwiftPublish;

var awsS3 = awsS3_cjs;
var azureBlobStorage = azureBlobStorage_cjs;
var googleStorage = googleStorage_cjs;
var local = local_cjs;
var openStackSwift = openStackSwift_cjs;

class Publisher {
  publishers = /* @__PURE__ */ new Map();
  register(type, publisher) {
    this.publishers.set(type, publisher);
  }
  get(config) {
    const publisherType = config.getOptionalString(
      "techdocs.publisher.type"
    ) ?? "local";
    if (!publisherType) {
      throw new Error("TechDocs publisher type not specified for the entity");
    }
    const publisher = this.publishers.get(publisherType);
    if (!publisher) {
      throw new Error(
        `TechDocs publisher '${publisherType}' is not registered`
      );
    }
    return publisher;
  }
  /**
   * Returns a instance of TechDocs publisher
   * @param config - A Backstage configuration
   * @param options - Options for configuring the publisher factory
   */
  static async fromConfig(config, options) {
    const { logger, discovery, customPublisher } = options;
    const publishers = new Publisher();
    if (customPublisher) {
      publishers.register("techdocs", customPublisher);
      return customPublisher;
    }
    const publisherType = config.getOptionalString(
      "techdocs.publisher.type"
    ) ?? "local";
    switch (publisherType) {
      case "googleGcs":
        logger.info("Creating Google Storage Bucket publisher for TechDocs");
        publishers.register(
          publisherType,
          googleStorage.GoogleGCSPublish.fromConfig(
            config,
            logger,
            options.publisherSettings?.googleGcs
          )
        );
        break;
      case "awsS3":
        logger.info("Creating AWS S3 Bucket publisher for TechDocs");
        publishers.register(
          publisherType,
          await awsS3.AwsS3Publish.fromConfig(config, logger)
        );
        break;
      case "azureBlobStorage":
        logger.info(
          "Creating Azure Blob Storage Container publisher for TechDocs"
        );
        publishers.register(
          publisherType,
          azureBlobStorage.AzureBlobStoragePublish.fromConfig(config, logger)
        );
        break;
      case "openStackSwift":
        logger.info(
          "Creating OpenStack Swift Container publisher for TechDocs"
        );
        publishers.register(
          publisherType,
          openStackSwift.OpenStackSwiftPublish.fromConfig(config, logger)
        );
        break;
      case "local":
        logger.info("Creating Local publisher for TechDocs");
        publishers.register(
          publisherType,
          local.LocalPublish.fromConfig(config, logger, discovery)
        );
        break;
      default:
        logger.info("Creating Local publisher for TechDocs");
        publishers.register(
          publisherType,
          local.LocalPublish.fromConfig(config, logger, discovery)
        );
    }
    return publishers.get(config);
  }
}

publish_cjs.Publisher = Publisher;

var extensions_cjs = {};

var backendPluginApi$1 = require$$0$4;

const techdocsBuildsExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "techdocs.builds"
});
const techdocsGeneratorExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "techdocs.generator"
});
const techdocsPreparerExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "techdocs.preparer"
});
const techdocsPublisherExtensionPoint = backendPluginApi$1.createExtensionPoint({
  id: "techdocs.publisher"
});

extensions_cjs.techdocsBuildsExtensionPoint = techdocsBuildsExtensionPoint;
extensions_cjs.techdocsGeneratorExtensionPoint = techdocsGeneratorExtensionPoint;
extensions_cjs.techdocsPreparerExtensionPoint = techdocsPreparerExtensionPoint;
extensions_cjs.techdocsPublisherExtensionPoint = techdocsPublisherExtensionPoint;

var techdocs_cjs = {};

var mkdocsPatchers_cjs = {};

var fs$1 = require$$3$2;
var yaml = require$$5$1;
var helpers$4 = helpers_cjs$2;
var errors$5 = require$$0$5;

function _interopDefaultCompat$5 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default$1 = /*#__PURE__*/_interopDefaultCompat$5(fs$1);
var yaml__default = /*#__PURE__*/_interopDefaultCompat$5(yaml);

const patchMkdocsFile = async (mkdocsYmlPath, logger, updateAction) => {
  let didEdit = false;
  let mkdocsYmlFileString;
  try {
    mkdocsYmlFileString = await fs__default$1.default.readFile(mkdocsYmlPath, "utf8");
  } catch (error) {
    errors$5.assertError(error);
    logger.warn(
      `Could not read MkDocs YAML config file ${mkdocsYmlPath} before running the generator: ${error.message}`
    );
    return;
  }
  let mkdocsYml;
  try {
    mkdocsYml = yaml__default.default.load(mkdocsYmlFileString, { schema: helpers$4.MKDOCS_SCHEMA });
    if (typeof mkdocsYml === "string" || typeof mkdocsYml === "undefined") {
      throw new Error("Bad YAML format.");
    }
  } catch (error) {
    errors$5.assertError(error);
    logger.warn(
      `Error in parsing YAML at ${mkdocsYmlPath} before running the generator. ${error.message}`
    );
    return;
  }
  didEdit = updateAction(mkdocsYml);
  try {
    if (didEdit) {
      await fs__default$1.default.writeFile(
        mkdocsYmlPath,
        yaml__default.default.dump(mkdocsYml, { schema: helpers$4.MKDOCS_SCHEMA }),
        "utf8"
      );
    }
  } catch (error) {
    errors$5.assertError(error);
    logger.warn(
      `Could not write to ${mkdocsYmlPath} after updating it before running the generator. ${error.message}`
    );
    return;
  }
};
const patchMkdocsYmlPreBuild = async (mkdocsYmlPath, logger, parsedLocationAnnotation, scmIntegrations) => {
  await patchMkdocsFile(mkdocsYmlPath, logger, (mkdocsYml) => {
    if (!("repo_url" in mkdocsYml) || !("edit_uri" in mkdocsYml)) {
      const result = helpers$4.getRepoUrlFromLocationAnnotation(
        parsedLocationAnnotation,
        scmIntegrations,
        mkdocsYml.docs_dir
      );
      if (result.repo_url || result.edit_uri) {
        mkdocsYml.repo_url = mkdocsYml.repo_url || result.repo_url;
        mkdocsYml.edit_uri = mkdocsYml.edit_uri || result.edit_uri;
        logger.info(
          `Set ${JSON.stringify(
            result
          )}. You can disable this feature by manually setting 'repo_url' or 'edit_uri' according to the MkDocs documentation at https://www.mkdocs.org/user-guide/configuration/#repo_url`
        );
        return true;
      }
    }
    return false;
  });
};
const patchMkdocsYmlWithPlugins = async (mkdocsYmlPath, logger, defaultPlugins = ["techdocs-core"]) => {
  await patchMkdocsFile(mkdocsYmlPath, logger, (mkdocsYml) => {
    if (!("plugins" in mkdocsYml)) {
      mkdocsYml.plugins = defaultPlugins;
      return true;
    }
    let changesMade = false;
    defaultPlugins.forEach((dp) => {
      if (!(mkdocsYml.plugins.includes(dp) || mkdocsYml.plugins.some((p) => p.hasOwnProperty(dp)))) {
        mkdocsYml.plugins = [.../* @__PURE__ */ new Set([...mkdocsYml.plugins, dp])];
        changesMade = true;
      }
    });
    return changesMade;
  });
};

mkdocsPatchers_cjs.patchMkdocsYmlPreBuild = patchMkdocsYmlPreBuild;
mkdocsPatchers_cjs.patchMkdocsYmlWithPlugins = patchMkdocsYmlWithPlugins;

var path$1 = require$$6$1;
var integration$1 = require$$1$3;
var helpers$3 = helpers_cjs$2;
var mkdocsPatchers = mkdocsPatchers_cjs;
var errors$4 = require$$0$5;
var DockerContainerRunner = DockerContainerRunner_cjs;

function _interopDefaultCompat$4 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var path__default$1 = /*#__PURE__*/_interopDefaultCompat$4(path$1);

class TechdocsGenerator {
  /**
   * The default docker image (and version) used to generate content. Public
   * and static so that techdocs-node consumers can use the same version.
   */
  static defaultDockerImage = "spotify/techdocs:v1.2.4";
  logger;
  containerRunner;
  options;
  scmIntegrations;
  /**
   * Returns a instance of TechDocs generator
   * @param config - A Backstage configuration
   * @param options - Options to configure the generator
   */
  static fromConfig(config, options) {
    const { containerRunner, logger } = options;
    const scmIntegrations = integration$1.ScmIntegrations.fromConfig(config);
    return new TechdocsGenerator({
      logger,
      containerRunner,
      config,
      scmIntegrations
    });
  }
  constructor(options) {
    this.logger = options.logger;
    this.options = readGeneratorConfig(options.config, options.logger);
    this.containerRunner = options.containerRunner;
    this.scmIntegrations = options.scmIntegrations;
  }
  /** {@inheritDoc GeneratorBase.run} */
  async run(options) {
    const {
      inputDir,
      outputDir,
      parsedLocationAnnotation,
      etag,
      logger: childLogger,
      logStream,
      siteOptions,
      runAsDefaultUser
    } = options;
    const { path: mkdocsYmlPath, content } = await helpers$3.getMkdocsYml(
      inputDir,
      siteOptions
    );
    const docsDir = await helpers$3.validateMkdocsYaml(inputDir, content);
    if (parsedLocationAnnotation) {
      await mkdocsPatchers.patchMkdocsYmlPreBuild(
        mkdocsYmlPath,
        childLogger,
        parsedLocationAnnotation,
        this.scmIntegrations
      );
    }
    if (this.options.legacyCopyReadmeMdToIndexMd) {
      await helpers$3.patchIndexPreBuild({ inputDir, logger: childLogger, docsDir });
    }
    const defaultPlugins = this.options.defaultPlugins ?? [];
    if (!this.options.omitTechdocsCoreMkdocsPlugin && !defaultPlugins.includes("techdocs-core")) {
      defaultPlugins.push("techdocs-core");
    }
    await mkdocsPatchers.patchMkdocsYmlWithPlugins(mkdocsYmlPath, childLogger, defaultPlugins);
    const mountDirs = {
      [inputDir]: "/input",
      [outputDir]: "/output"
    };
    try {
      switch (this.options.runIn) {
        case "local":
          await helpers$3.runCommand({
            command: "mkdocs",
            args: ["build", "-d", outputDir, "-v"],
            options: {
              cwd: inputDir
            },
            logStream
          });
          childLogger.info(
            `Successfully generated docs from ${inputDir} into ${outputDir} using local mkdocs`
          );
          break;
        case "docker": {
          const containerRunner = this.containerRunner || new DockerContainerRunner.DockerContainerRunner();
          await containerRunner.runContainer({
            imageName: this.options.dockerImage ?? TechdocsGenerator.defaultDockerImage,
            args: ["build", "-d", "/output"],
            logStream,
            mountDirs,
            workingDir: "/input",
            // Set the home directory inside the container as something that applications can
            // write to, otherwise they will just fail trying to write to /
            envVars: { HOME: "/tmp" },
            pullImage: this.options.pullImage,
            defaultUser: runAsDefaultUser
          });
          childLogger.info(
            `Successfully generated docs from ${inputDir} into ${outputDir} using techdocs-container`
          );
          break;
        }
        default:
          throw new Error(
            `Invalid config value "${this.options.runIn}" provided in 'techdocs.generators.techdocs'.`
          );
      }
    } catch (error) {
      this.logger.debug(
        `Failed to generate docs from ${inputDir} into ${outputDir}`
      );
      throw new errors$4.ForwardedError(
        `Failed to generate docs from ${inputDir} into ${outputDir}`,
        error
      );
    }
    await helpers$3.createOrUpdateMetadata(
      path__default$1.default.join(outputDir, "techdocs_metadata.json"),
      childLogger
    );
    if (etag) {
      await helpers$3.storeEtagMetadata(
        path__default$1.default.join(outputDir, "techdocs_metadata.json"),
        etag
      );
    }
  }
}
function readGeneratorConfig(config, logger) {
  const legacyGeneratorType = config.getOptionalString(
    "techdocs.generators.techdocs"
  );
  if (legacyGeneratorType) {
    logger.warn(
      `The 'techdocs.generators.techdocs' configuration key is deprecated and will be removed in the future. Please use 'techdocs.generator' instead. See here https://backstage.io/docs/features/techdocs/configuration`
    );
  }
  return {
    runIn: legacyGeneratorType ?? config.getOptionalString("techdocs.generator.runIn") ?? "docker",
    dockerImage: config.getOptionalString("techdocs.generator.dockerImage"),
    pullImage: config.getOptionalBoolean("techdocs.generator.pullImage"),
    omitTechdocsCoreMkdocsPlugin: config.getOptionalBoolean(
      "techdocs.generator.mkdocs.omitTechdocsCorePlugin"
    ),
    legacyCopyReadmeMdToIndexMd: config.getOptionalBoolean(
      "techdocs.generator.mkdocs.legacyCopyReadmeMdToIndexMd"
    ),
    defaultPlugins: config.getOptionalStringArray(
      "techdocs.generator.mkdocs.defaultPlugins"
    )
  };
}

techdocs_cjs.TechdocsGenerator = TechdocsGenerator;
techdocs_cjs.readGeneratorConfig = readGeneratorConfig;

var generators_cjs = {};

var helpers$2 = helpers_cjs$2;
var techdocs$1 = techdocs_cjs;

class Generators {
  generatorMap = /* @__PURE__ */ new Map();
  /**
   * Returns a generators instance containing a generator for TechDocs
   * @param config - A Backstage configuration
   * @param options - Options to configure the TechDocs generator
   */
  static async fromConfig(config, options) {
    const generators = new Generators();
    const techdocsGenerator = options.customGenerator ?? techdocs$1.TechdocsGenerator.fromConfig(config, options);
    generators.register("techdocs", techdocsGenerator);
    return generators;
  }
  /**
   * Register a generator in the generators collection
   * @param generatorKey - Unique identifier for the generator
   * @param generator - The generator instance to register
   */
  register(generatorKey, generator) {
    this.generatorMap.set(generatorKey, generator);
  }
  /**
   * Returns the generator for a given TechDocs entity
   * @param entity - A TechDocs entity instance
   */
  get(entity) {
    const generatorKey = helpers$2.getGeneratorKey(entity);
    const generator = this.generatorMap.get(generatorKey);
    if (!generator) {
      throw new Error(`No generator registered for entity: "${generatorKey}"`);
    }
    return generator;
  }
}

generators_cjs.Generators = Generators;

var index = index_cjs;
var dir = dir_cjs;
var url = url_cjs;
var preparers = preparers_cjs;
var publish = publish_cjs;
var helpers$1 = helpers_cjs;
var extensions = extensions_cjs;
var techdocs = techdocs_cjs;
var generators = generators_cjs;
var helpers = helpers_cjs$2;



index_cjs$1.getMkDocsYml = index.getMkDocsYml;
index_cjs$1.DirectoryPreparer = dir.DirectoryPreparer;
index_cjs$1.UrlPreparer = url.UrlPreparer;
index_cjs$1.Preparers = preparers.Preparers;
index_cjs$1.Publisher = publish.Publisher;
index_cjs$1.getDocFilesFromRepository = helpers$1.getDocFilesFromRepository;
index_cjs$1.getLocationForEntity = helpers$1.getLocationForEntity;
index_cjs$1.parseReferenceAnnotation = helpers$1.parseReferenceAnnotation;
index_cjs$1.transformDirLocation = helpers$1.transformDirLocation;
index_cjs$1.techdocsBuildsExtensionPoint = extensions.techdocsBuildsExtensionPoint;
index_cjs$1.techdocsGeneratorExtensionPoint = extensions.techdocsGeneratorExtensionPoint;
index_cjs$1.techdocsPreparerExtensionPoint = extensions.techdocsPreparerExtensionPoint;
index_cjs$1.techdocsPublisherExtensionPoint = extensions.techdocsPublisherExtensionPoint;
index_cjs$1.TechdocsGenerator = techdocs.TechdocsGenerator;
index_cjs$1.Generators = generators.Generators;
index_cjs$1.getMkdocsYml = helpers.getMkdocsYml;

var router_cjs = {};

var DocsSynchronizer_cjs = {};

var BuildMetadataStorage_cjs = {};

const lastUpdatedRecord = {};
class BuildMetadataStorage$2 {
  entityUid;
  lastUpdatedRecord;
  constructor(entityUid) {
    this.entityUid = entityUid;
    this.lastUpdatedRecord = lastUpdatedRecord;
  }
  setLastUpdated() {
    this.lastUpdatedRecord[this.entityUid] = Date.now();
  }
  getLastUpdated() {
    return this.lastUpdatedRecord[this.entityUid];
  }
}
const shouldCheckForUpdate = (entityUid) => {
  const lastUpdated = new BuildMetadataStorage$2(entityUid).getLastUpdated();
  if (lastUpdated) {
    if (Date.now() - lastUpdated < 60 * 1e3) {
      return false;
    }
  }
  return true;
};

BuildMetadataStorage_cjs.BuildMetadataStorage = BuildMetadataStorage$2;
BuildMetadataStorage_cjs.shouldCheckForUpdate = shouldCheckForUpdate;

var builder_cjs = {};

var catalogModel$3 = require$$0$1;
var errors$3 = require$$0$5;
var pluginTechdocsNode$2 = index_cjs$1;
var fs = require$$3$2;
var os = require$$4$5;
var path = require$$6$1;
var BuildMetadataStorage$1 = BuildMetadataStorage_cjs;

function _interopDefaultCompat$3 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat$3(fs);
var os__default = /*#__PURE__*/_interopDefaultCompat$3(os);
var path__default = /*#__PURE__*/_interopDefaultCompat$3(path);

class DocsBuilder {
  preparer;
  generator;
  publisher;
  entity;
  logger;
  config;
  scmIntegrations;
  logStream;
  cache;
  constructor({
    preparers,
    generators,
    publisher,
    entity,
    logger,
    config,
    scmIntegrations,
    logStream,
    cache
  }) {
    this.preparer = preparers.get(entity);
    this.generator = generators.get(entity);
    this.publisher = publisher;
    this.entity = entity;
    this.logger = logger;
    this.config = config;
    this.scmIntegrations = scmIntegrations;
    this.logStream = logStream;
    this.cache = cache;
  }
  /**
   * Build the docs and return whether they have been newly generated or have been cached
   * @returns true, if the docs have been built. false, if the cached docs are still up-to-date.
   */
  async build() {
    if (!this.entity.metadata.uid) {
      throw new Error(
        "Trying to build documentation for entity not in software catalog"
      );
    }
    this.logger.info(
      `Step 1 of 3: Preparing docs for entity ${catalogModel$3.stringifyEntityRef(
        this.entity
      )}`
    );
    let storedEtag;
    if (await this.publisher.hasDocsBeenGenerated(this.entity)) {
      try {
        storedEtag = (await this.publisher.fetchTechDocsMetadata({
          namespace: this.entity.metadata.namespace ?? catalogModel$3.DEFAULT_NAMESPACE,
          kind: this.entity.kind,
          name: this.entity.metadata.name
        })).etag;
      } catch (err) {
        this.logger.warn(
          `Unable to read techdocs_metadata.json, proceeding with fresh build, error ${err}.`
        );
      }
    }
    let preparedDir;
    let newEtag;
    try {
      const preparerResponse = await this.preparer.prepare(this.entity, {
        etag: storedEtag,
        logger: this.logger
      });
      preparedDir = preparerResponse.preparedDir;
      newEtag = preparerResponse.etag;
    } catch (err) {
      if (errors$3.isError(err) && err.name === "NotModifiedError") {
        new BuildMetadataStorage$1.BuildMetadataStorage(this.entity.metadata.uid).setLastUpdated();
        this.logger.debug(
          `Docs for ${catalogModel$3.stringifyEntityRef(
            this.entity
          )} are unmodified. Using cache, skipping generate and prepare`
        );
        return false;
      }
      throw err;
    }
    this.logger.info(
      `Prepare step completed for entity ${catalogModel$3.stringifyEntityRef(
        this.entity
      )}, stored at ${preparedDir}`
    );
    this.logger.info(
      `Step 2 of 3: Generating docs for entity ${catalogModel$3.stringifyEntityRef(
        this.entity
      )}`
    );
    const workingDir = this.config.getOptionalString(
      "backend.workingDirectory"
    );
    const tmpdirPath = workingDir || os__default.default.tmpdir();
    const tmpdirResolvedPath = fs__default.default.realpathSync(tmpdirPath);
    const outputDir = await fs__default.default.mkdtemp(
      path__default.default.join(tmpdirResolvedPath, "techdocs-tmp-")
    );
    const parsedLocationAnnotation = pluginTechdocsNode$2.getLocationForEntity(
      this.entity,
      this.scmIntegrations
    );
    await this.generator.run({
      inputDir: preparedDir,
      outputDir,
      parsedLocationAnnotation,
      etag: newEtag,
      logger: this.logger,
      logStream: this.logStream,
      siteOptions: {
        name: this.entity.metadata.title ?? this.entity.metadata.name
      }
    });
    if (this.preparer.shouldCleanPreparedDirectory()) {
      this.logger.debug(
        `Removing prepared directory ${preparedDir} since the site has been generated`
      );
      try {
        fs__default.default.remove(preparedDir);
      } catch (error) {
        errors$3.assertError(error);
        this.logger.debug(`Error removing prepared directory ${error.message}`);
      }
    }
    this.logger.info(
      `Step 3 of 3: Publishing docs for entity ${catalogModel$3.stringifyEntityRef(
        this.entity
      )}`
    );
    const published = await this.publisher.publish({
      entity: this.entity,
      directory: outputDir
    });
    if (this.cache && published && published?.objects?.length) {
      this.logger.debug(
        `Invalidating ${published.objects.length} cache objects`
      );
      await this.cache.invalidateMultiple(published.objects);
    }
    try {
      fs__default.default.remove(outputDir);
      this.logger.debug(
        `Removing generated directory ${outputDir} since the site has been published`
      );
    } catch (error) {
      errors$3.assertError(error);
      this.logger.debug(`Error removing generated directory ${error.message}`);
    }
    new BuildMetadataStorage$1.BuildMetadataStorage(this.entity.metadata.uid).setLastUpdated();
    return true;
  }
}

builder_cjs.DocsBuilder = DocsBuilder;

var catalogModel$2 = require$$0$1;
var errors$2 = require$$0$5;
var fetch = require$$4;
var pLimit = require$$5;
var stream = require$$6;
var winston = require$$5$4;
var BuildMetadataStorage = BuildMetadataStorage_cjs;
var builder = builder_cjs;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var fetch__default = /*#__PURE__*/_interopDefaultCompat$2(fetch);
var pLimit__default = /*#__PURE__*/_interopDefaultCompat$2(pLimit);
var winston__namespace = /*#__PURE__*/_interopNamespaceCompat(winston);

class DocsSynchronizer$1 {
  publisher;
  logger;
  buildLogTransport;
  config;
  scmIntegrations;
  cache;
  buildLimiter;
  constructor({
    publisher,
    logger,
    buildLogTransport,
    config,
    scmIntegrations,
    cache
  }) {
    this.config = config;
    this.logger = logger;
    this.buildLogTransport = buildLogTransport;
    this.publisher = publisher;
    this.scmIntegrations = scmIntegrations;
    this.cache = cache;
    this.buildLimiter = pLimit__default.default(10);
  }
  async doSync({
    responseHandler: { log, error, finish },
    entity,
    preparers,
    generators
  }) {
    const taskLogger = winston__namespace.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston__namespace.format.combine(
        winston__namespace.format.colorize(),
        winston__namespace.format.timestamp(),
        winston__namespace.format.simple()
      ),
      defaultMeta: {}
    });
    const logStream = new stream.PassThrough();
    logStream.on("data", async (data) => {
      log(data.toString().trim());
    });
    taskLogger.add(new winston__namespace.transports.Stream({ stream: logStream }));
    if (this.buildLogTransport) {
      taskLogger.add(this.buildLogTransport);
    }
    if (!BuildMetadataStorage.shouldCheckForUpdate(entity.metadata.uid)) {
      finish({ updated: false });
      return;
    }
    let foundDocs = false;
    try {
      const docsBuilder = new builder.DocsBuilder({
        preparers,
        generators,
        publisher: this.publisher,
        logger: taskLogger,
        entity,
        config: this.config,
        scmIntegrations: this.scmIntegrations,
        logStream,
        cache: this.cache
      });
      const interval = setInterval(() => {
        taskLogger.info(
          "The docs building process is taking a little bit longer to process this entity. Please bear with us."
        );
      }, 1e4);
      const updated = await this.buildLimiter(() => docsBuilder.build());
      clearInterval(interval);
      if (!updated) {
        finish({ updated: false });
        return;
      }
    } catch (e) {
      errors$2.assertError(e);
      const msg = `Failed to build the docs page for entity ${catalogModel$2.stringifyEntityRef(
        entity
      )}: ${e.message}`;
      taskLogger.error(msg);
      this.logger.error(msg, e);
      error(e);
      return;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await this.publisher.hasDocsBeenGenerated(entity)) {
        foundDocs = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1e3));
    }
    if (!foundDocs) {
      this.logger.error(
        "Published files are taking longer to show up in storage. Something went wrong."
      );
      error(
        new errors$2.NotFoundError(
          "Sorry! It took too long for the generated docs to show up in storage. Are you sure the docs project is generating an `index.html` file? Otherwise, check back later."
        )
      );
      return;
    }
    finish({ updated: true });
  }
  async doCacheSync({
    responseHandler: { finish },
    discovery,
    token,
    entity
  }) {
    if (!BuildMetadataStorage.shouldCheckForUpdate(entity.metadata.uid) || !this.cache) {
      finish({ updated: false });
      return;
    }
    const baseUrl = await discovery.getBaseUrl("techdocs");
    const namespace = entity.metadata?.namespace || catalogModel$2.DEFAULT_NAMESPACE;
    const kind = entity.kind;
    const name = entity.metadata.name;
    const legacyPathCasing = this.config.getOptionalBoolean(
      "techdocs.legacyUseCaseSensitiveTripletPaths"
    ) || false;
    const tripletPath = `${namespace}/${kind}/${name}`;
    const entityTripletPath = `${legacyPathCasing ? tripletPath : tripletPath.toLocaleLowerCase("en-US")}`;
    try {
      const [sourceMetadata, cachedMetadata] = await Promise.all([
        this.publisher.fetchTechDocsMetadata({ namespace, kind, name }),
        fetch__default.default(
          `${baseUrl}/static/docs/${entityTripletPath}/techdocs_metadata.json`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        ).then(
          (f) => f.json().catch(() => void 0)
        )
      ]);
      if (sourceMetadata.build_timestamp !== cachedMetadata.build_timestamp) {
        const files = [
          .../* @__PURE__ */ new Set([
            ...sourceMetadata.files || [],
            ...cachedMetadata.files || []
          ])
        ].map((f) => `${entityTripletPath}/${f}`);
        await this.cache.invalidateMultiple(files);
        finish({ updated: true });
      } else {
        finish({ updated: false });
      }
    } catch (e) {
      errors$2.assertError(e);
      this.logger.error(
        `Error syncing cache for ${entityTripletPath}: ${e.message}`
      );
      finish({ updated: false });
    } finally {
      new BuildMetadataStorage.BuildMetadataStorage(entity.metadata.uid).setLastUpdated();
    }
  }
}

DocsSynchronizer_cjs.DocsSynchronizer = DocsSynchronizer$1;

var cacheMiddleware_cjs = {};

var router$2 = require$$0$8;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var router__default$1 = /*#__PURE__*/_interopDefaultCompat$1(router$2);

const createCacheMiddleware = ({
  cache
}) => {
  const cacheMiddleware = router__default$1.default();
  cacheMiddleware.use(async (req, res, next) => {
    const socket = res.socket;
    const isCacheable = req.path.startsWith("/static/docs/");
    const isGetRequest = req.method === "GET";
    if (!isCacheable || !socket) {
      next();
      return;
    }
    const reqPath = decodeURI(req.path.match(/\/static\/docs\/(.*)$/)[1]);
    const realEnd = socket.end.bind(socket);
    const realWrite = socket.write.bind(socket);
    let writeToCache = true;
    const chunks = [];
    socket.write = (data, encoding, callback) => {
      chunks.push(Buffer.from(data));
      if (typeof encoding === "function") {
        return realWrite(data, encoding);
      }
      return realWrite(data, encoding, callback);
    };
    socket.on("close", async (hadError) => {
      const content = Buffer.concat(chunks);
      const head = content.toString("utf8", 0, 12);
      if (isGetRequest && writeToCache && !hadError && head.match(/HTTP\/\d\.\d 200/)) {
        await cache.set(reqPath, content);
      }
    });
    const cached = await cache.get(reqPath);
    if (cached) {
      writeToCache = false;
      realEnd(cached);
      return;
    }
    next();
  });
  return cacheMiddleware;
};

cacheMiddleware_cjs.createCacheMiddleware = createCacheMiddleware;

var TechDocsCache_cjs = {};

var errors$1 = require$$0$5;

class CacheInvalidationError extends errors$1.CustomErrorBase {
}
class TechDocsCache$1 {
  cache;
  logger;
  readTimeout;
  constructor({
    cache,
    logger,
    readTimeout
  }) {
    this.cache = cache;
    this.logger = logger;
    this.readTimeout = readTimeout;
  }
  static fromConfig(config, { cache, logger }) {
    const timeout = config.getOptionalNumber("techdocs.cache.readTimeout");
    const readTimeout = timeout === void 0 ? 1e3 : timeout;
    return new TechDocsCache$1({ cache, logger, readTimeout });
  }
  async get(path) {
    try {
      const response = await Promise.race([
        this.cache.get(path),
        new Promise((cancelAfter) => setTimeout(cancelAfter, this.readTimeout))
      ]);
      if (response !== void 0) {
        this.logger.debug(`Cache hit: ${path}`);
        return Buffer.from(response, "base64");
      }
      this.logger.debug(`Cache miss: ${path}`);
      return response;
    } catch (e) {
      errors$1.assertError(e);
      this.logger.warn(`Error getting cache entry ${path}: ${e.message}`);
      this.logger.debug(e.message, e);
      return void 0;
    }
  }
  async set(path, data) {
    this.logger.debug(`Writing cache entry for ${path}`);
    this.cache.set(path, data.toString("base64")).catch((e) => this.logger.error("write error", e));
  }
  async invalidate(path) {
    return this.cache.delete(path);
  }
  async invalidateMultiple(paths) {
    const settled = await Promise.allSettled(
      paths.map((path) => this.cache.delete(path))
    );
    const rejected = settled.filter(
      (s) => s.status === "rejected"
    );
    if (rejected.length) {
      throw new CacheInvalidationError(
        "TechDocs cache invalidation error",
        rejected
      );
    }
    return settled;
  }
}

TechDocsCache_cjs.CacheInvalidationError = CacheInvalidationError;
TechDocsCache_cjs.TechDocsCache = TechDocsCache$1;

var CachedEntityLoader_cjs = {};

var catalogModel$1 = require$$0$1;

class CachedEntityLoader$1 {
  catalog;
  cache;
  readTimeout = 1e3;
  constructor({ catalog, cache }) {
    this.catalog = catalog;
    this.cache = cache;
  }
  async load(entityRef, token) {
    const cacheKey = this.getCacheKey(entityRef, token);
    let result = await this.getFromCache(cacheKey);
    if (result) {
      return result;
    }
    result = await this.catalog.getEntityByRef(entityRef, { token });
    if (result) {
      this.cache.set(cacheKey, result, { ttl: 5e3 });
    }
    return result;
  }
  async getFromCache(key) {
    return await Promise.race([
      this.cache.get(key),
      new Promise((cancelAfter) => setTimeout(cancelAfter, this.readTimeout))
    ]);
  }
  getCacheKey(entityName, token) {
    const key = ["catalog", catalogModel$1.stringifyEntityRef(entityName)];
    if (token) {
      key.push(token);
    }
    return key.join(":");
  }
}

CachedEntityLoader_cjs.CachedEntityLoader = CachedEntityLoader$1;

var DefaultDocsBuildStrategy_cjs = {};

class DefaultDocsBuildStrategy$1 {
  config;
  constructor(config) {
    this.config = config;
  }
  static fromConfig(config) {
    return new DefaultDocsBuildStrategy$1(config);
  }
  async shouldBuild(_) {
    return [void 0, "local"].includes(
      this.config.getOptionalString("techdocs.builder")
    );
  }
}

DefaultDocsBuildStrategy_cjs.DefaultDocsBuildStrategy = DefaultDocsBuildStrategy$1;

var backendCommon$1 = require$$0$3;
var catalogClient = require$$1;
var catalogModel = require$$0$1;
var errors = require$$0$5;
var pluginTechdocsNode$1 = index_cjs$1;
var router$1 = require$$0$8;
var integration = require$$1$3;
var DocsSynchronizer = DocsSynchronizer_cjs;
var cacheMiddleware = cacheMiddleware_cjs;
var TechDocsCache = TechDocsCache_cjs;
var CachedEntityLoader = CachedEntityLoader_cjs;
var DefaultDocsBuildStrategy = DefaultDocsBuildStrategy_cjs;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var router__default = /*#__PURE__*/_interopDefaultCompat(router$1);

function isOutOfTheBoxOption(opt) {
  return opt.preparers !== void 0;
}
async function createRouter(options) {
  const router = router__default.default();
  const { publisher, config, logger, discovery } = options;
  const { auth, httpAuth } = backendCommon$1.createLegacyAuthAdapters(options);
  const catalogClient$1 = options.catalogClient ?? new catalogClient.CatalogClient({ discoveryApi: discovery });
  const docsBuildStrategy = options.docsBuildStrategy ?? DefaultDocsBuildStrategy.DefaultDocsBuildStrategy.fromConfig(config);
  const buildLogTransport = options.buildLogTransport;
  const entityLoader = new CachedEntityLoader.CachedEntityLoader({
    catalog: catalogClient$1,
    cache: options.cache.getClient()
  });
  let cache;
  const defaultTtl = config.getOptionalNumber("techdocs.cache.ttl");
  if (defaultTtl) {
    const cacheClient = options.cache.getClient({ defaultTtl });
    cache = TechDocsCache.TechDocsCache.fromConfig(config, { cache: cacheClient, logger });
  }
  const scmIntegrations = integration.ScmIntegrations.fromConfig(config);
  const docsSynchronizer = new DocsSynchronizer.DocsSynchronizer({
    publisher,
    logger,
    buildLogTransport,
    config,
    scmIntegrations,
    cache
  });
  router.get("/metadata/techdocs/:namespace/:kind/:name", async (req, res) => {
    const { kind, namespace, name } = req.params;
    const entityName = { kind, namespace, name };
    const credentials = await httpAuth.credentials(req);
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: credentials,
      targetPluginId: "catalog"
    });
    const entity = await entityLoader.load(entityName, token);
    if (!entity) {
      throw new errors.NotFoundError(
        `Unable to get metadata for '${catalogModel.stringifyEntityRef(entityName)}'`
      );
    }
    try {
      const techdocsMetadata = await publisher.fetchTechDocsMetadata(
        entityName
      );
      res.json(techdocsMetadata);
    } catch (err) {
      logger.info(
        `Unable to get metadata for '${catalogModel.stringifyEntityRef(
          entityName
        )}' with error ${err}`
      );
      throw new errors.NotFoundError(
        `Unable to get metadata for '${catalogModel.stringifyEntityRef(entityName)}'`,
        err
      );
    }
  });
  router.get("/metadata/entity/:namespace/:kind/:name", async (req, res) => {
    const { kind, namespace, name } = req.params;
    const entityName = { kind, namespace, name };
    const credentials = await httpAuth.credentials(req);
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: credentials,
      targetPluginId: "catalog"
    });
    const entity = await entityLoader.load(entityName, token);
    if (!entity) {
      throw new errors.NotFoundError(
        `Unable to get metadata for '${catalogModel.stringifyEntityRef(entityName)}'`
      );
    }
    try {
      const locationMetadata = pluginTechdocsNode$1.getLocationForEntity(entity, scmIntegrations);
      res.json({ ...entity, locationMetadata });
    } catch (err) {
      logger.info(
        `Unable to get metadata for '${catalogModel.stringifyEntityRef(
          entityName
        )}' with error ${err}`
      );
      throw new errors.NotFoundError(
        `Unable to get metadata for '${catalogModel.stringifyEntityRef(entityName)}'`,
        err
      );
    }
  });
  router.get("/sync/:namespace/:kind/:name", async (req, res) => {
    const { kind, namespace, name } = req.params;
    const credentials = await httpAuth.credentials(req);
    const { token } = await auth.getPluginRequestToken({
      onBehalfOf: credentials,
      targetPluginId: "catalog"
    });
    const entity = await entityLoader.load({ kind, namespace, name }, token);
    if (!entity?.metadata?.uid) {
      throw new errors.NotFoundError("Entity metadata UID missing");
    }
    const responseHandler = createEventStream(res);
    const shouldBuild = await docsBuildStrategy.shouldBuild({ entity });
    if (!shouldBuild) {
      if (cache) {
        const { token: techDocsToken } = await auth.getPluginRequestToken({
          onBehalfOf: await auth.getOwnServiceCredentials(),
          targetPluginId: "techdocs"
        });
        await docsSynchronizer.doCacheSync({
          responseHandler,
          discovery,
          token: techDocsToken,
          entity
        });
        return;
      }
      responseHandler.finish({ updated: false });
      return;
    }
    if (isOutOfTheBoxOption(options)) {
      const { preparers, generators } = options;
      await docsSynchronizer.doSync({
        responseHandler,
        entity,
        preparers,
        generators
      });
      return;
    }
    responseHandler.error(
      new Error(
        "Invalid configuration. docsBuildStrategy.shouldBuild returned 'true', but no 'preparer' was provided to the router initialization."
      )
    );
  });
  if (config.getOptionalBoolean("permission.enabled")) {
    router.use(
      "/static/docs/:namespace/:kind/:name",
      async (req, _res, next) => {
        const { kind, namespace, name } = req.params;
        const entityName = { kind, namespace, name };
        const credentials = await httpAuth.credentials(req, {
          allowLimitedAccess: true
        });
        const { token } = await auth.getPluginRequestToken({
          onBehalfOf: credentials,
          targetPluginId: "catalog"
        });
        const entity = await entityLoader.load(entityName, token);
        if (!entity) {
          throw new errors.NotFoundError(
            `Entity not found for ${catalogModel.stringifyEntityRef(entityName)}`
          );
        }
        next();
      }
    );
  }
  if (cache) {
    router.use(cacheMiddleware.createCacheMiddleware({ logger, cache }));
  }
  router.use("/static/docs", publisher.docsRouter());
  return router;
}
function createEventStream(res) {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream"
  });
  res.socket?.on("close", () => {
    res.end();
  });
  const send = (type, data) => {
    res.write(`event: ${type}
data: ${JSON.stringify(data)}

`);
    if (res.flush) {
      res.flush();
    }
  };
  return {
    log: (data) => {
      send("log", data);
    },
    error: (e) => {
      send("error", e.message);
      res.end();
    },
    finish: (result) => {
      send("finish", result);
      res.end();
    }
  };
}

router_cjs.createEventStream = createEventStream;
router_cjs.createRouter = createRouter;

var backendCommon = require$$0$3;
var backendPluginApi = require$$0$4;
var pluginTechdocsNode = index_cjs$1;
var router = router_cjs;
var alpha = require$$1$1;

const techdocsPlugin = backendPluginApi.createBackendPlugin({
  pluginId: "techdocs",
  register(env) {
    let docsBuildStrategy;
    let buildLogTransport;
    env.registerExtensionPoint(pluginTechdocsNode.techdocsBuildsExtensionPoint, {
      setBuildStrategy(buildStrategy) {
        if (docsBuildStrategy) {
          throw new Error("DocsBuildStrategy may only be set once");
        }
        docsBuildStrategy = buildStrategy;
      },
      setBuildLogTransport(transport) {
        if (buildLogTransport) {
          throw new Error("BuildLogTransport may only be set once");
        }
        buildLogTransport = transport;
      }
    });
    let customTechdocsGenerator;
    env.registerExtensionPoint(pluginTechdocsNode.techdocsGeneratorExtensionPoint, {
      setTechdocsGenerator(generator) {
        if (customTechdocsGenerator) {
          throw new Error("TechdocsGenerator may only be set once");
        }
        customTechdocsGenerator = generator;
      }
    });
    const customPreparers = /* @__PURE__ */ new Map();
    env.registerExtensionPoint(pluginTechdocsNode.techdocsPreparerExtensionPoint, {
      registerPreparer(protocol, preparer) {
        if (customPreparers.has(protocol)) {
          throw new Error(
            `Preparer for protocol ${protocol} is already registered`
          );
        }
        customPreparers.set(protocol, preparer);
      }
    });
    let customTechdocsPublisher;
    const publisherSettings = {};
    env.registerExtensionPoint(pluginTechdocsNode.techdocsPublisherExtensionPoint, {
      registerPublisher(type, publisher) {
        if (customTechdocsPublisher) {
          throw new Error(`Publisher for type ${type} is already registered`);
        }
        customTechdocsPublisher = publisher;
      },
      registerPublisherSettings(publisher, settings) {
        publisherSettings[publisher] = settings;
      }
    });
    env.registerInit({
      deps: {
        config: backendPluginApi.coreServices.rootConfig,
        logger: backendPluginApi.coreServices.logger,
        urlReader: backendPluginApi.coreServices.urlReader,
        http: backendPluginApi.coreServices.httpRouter,
        discovery: backendPluginApi.coreServices.discovery,
        cache: backendPluginApi.coreServices.cache,
        httpAuth: backendPluginApi.coreServices.httpAuth,
        auth: backendPluginApi.coreServices.auth,
        catalog: alpha.catalogServiceRef
      },
      async init({
        config,
        logger,
        urlReader,
        http,
        discovery,
        cache,
        httpAuth,
        auth,
        catalog
      }) {
        const winstonLogger = backendCommon.loggerToWinstonLogger(logger);
        const preparers = await pluginTechdocsNode.Preparers.fromConfig(config, {
          reader: urlReader,
          logger: winstonLogger
        });
        for (const [protocol, preparer] of customPreparers.entries()) {
          preparers.register(protocol, preparer);
        }
        const generators = await pluginTechdocsNode.Generators.fromConfig(config, {
          logger: winstonLogger,
          customGenerator: customTechdocsGenerator
        });
        const publisher = await pluginTechdocsNode.Publisher.fromConfig(config, {
          logger: winstonLogger,
          discovery,
          customPublisher: customTechdocsPublisher,
          publisherSettings
        });
        await publisher.getReadiness();
        const cacheManager = backendCommon.cacheToPluginCacheManager(cache);
        http.use(
          await router.createRouter({
            logger: winstonLogger,
            cache: cacheManager,
            docsBuildStrategy,
            buildLogTransport,
            preparers,
            generators,
            publisher,
            config,
            discovery,
            httpAuth,
            auth,
            catalogClient: catalog
          })
        );
        http.addAuthPolicy({
          path: "/static",
          allow: "user-cookie"
        });
      }
    });
  }
});

plugin_cjs.techdocsPlugin = techdocsPlugin;

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var plugin = plugin_cjs;

const _feature = plugin.techdocsPlugin;

var _default = alpha_cjs.default = _feature;

const bundle = require$$0$4.createBackendFeatureLoader({
  async loader() {
    return [_default, _default$1];
  }
});

exports["default"] = bundle;
//# sourceMappingURL=index.cjs.js.map
