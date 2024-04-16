'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var require$$0 = require('@backstage/backend-common');
var require$$1 = require('@backstage/backend-plugin-api');
var require$$0$1 = require('path');
var require$$1$1 = require('@backstage/integration');
var require$$3 = require('@backstage/errors');
var require$$4 = require('child_process');
var require$$5 = require('fs-extra');
var require$$6 = require('git-url-parse');
var require$$7 = require('js-yaml');
var require$$8 = require('stream');
var require$$2 = require('@backstage/catalog-model');
var require$$10 = require('mime-types');
var require$$11 = require('p-limit');
var require$$12 = require('recursive-readdir');
var require$$13 = require('@backstage/integration-aws-node');
var require$$14 = require('@aws-sdk/client-s3');
var require$$15 = require('@aws-sdk/credential-providers');
var require$$16 = require('@smithy/node-http-handler');
var require$$17 = require('@aws-sdk/lib-storage');
var require$$18 = require('hpagent');
var require$$19 = require('json5');
var require$$20 = require('@azure/identity');
var require$$21 = require('@azure/storage-blob');
var require$$22 = require('@google-cloud/storage');
var require$$23 = require('express');
var require$$24 = require('os');
var require$$25 = require('@trendyol-js/openstack-swift-sdk');
var require$$26 = require('@trendyol-js/openstack-swift-sdk/lib/types');
var require$$3$2 = require('dockerode');
var require$$1$2 = require('@backstage/catalog-client');
var require$$5$2 = require('express-promise-router');
var require$$5$1 = require('node-fetch');
var require$$10$1 = require('winston');
var require$$4$1 = require('lodash/unescape');
var require$$3$1 = require('@backstage/plugin-catalog-common/alpha');
var require$$2$1 = require('@backstage/backend-tasks');
var require$$3$3 = require('@backstage/plugin-catalog-node/alpha');
var require$$5$3 = require('@backstage/plugin-search-backend-node/alpha');

var alpha_cjs$1 = {};

var index_cjs$2 = {};

var path = require$$0$1;
var integration = require$$1$1;
var backendCommon$3 = require$$0;
var errors = require$$3;
var child_process = require$$4;
var fs = require$$5;
var gitUrlParse = require$$6;
var yaml = require$$7;
var stream$1 = require$$8;
var catalogModel$1 = require$$2;
var mime = require$$10;
var createLimiter = require$$11;
var recursiveReadDir = require$$12;
var integrationAwsNode = require$$13;
var clientS3 = require$$14;
var credentialProviders = require$$15;
var nodeHttpHandler = require$$16;
var libStorage = require$$17;
var hpagent = require$$18;
var JSON5 = require$$19;
var identity = require$$20;
var storageBlob = require$$21;
var storage = require$$22;
var express = require$$23;
var os = require$$24;
var openstackSwiftSdk = require$$25;
var types = require$$26;
var backendPluginApi$2 = require$$1;

function _interopDefaultCompat$2 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefaultCompat$2(path);
var fs__default = /*#__PURE__*/_interopDefaultCompat$2(fs);
var gitUrlParse__default = /*#__PURE__*/_interopDefaultCompat$2(gitUrlParse);
var yaml__default = /*#__PURE__*/_interopDefaultCompat$2(yaml);
var mime__default = /*#__PURE__*/_interopDefaultCompat$2(mime);
var createLimiter__default = /*#__PURE__*/_interopDefaultCompat$2(createLimiter);
var recursiveReadDir__default = /*#__PURE__*/_interopDefaultCompat$2(recursiveReadDir);
var JSON5__default = /*#__PURE__*/_interopDefaultCompat$2(JSON5);
var express__default = /*#__PURE__*/_interopDefaultCompat$2(express);
var os__default = /*#__PURE__*/_interopDefaultCompat$2(os);

const getContentTypeForExtension = (ext) => {
  const defaultContentType = "text/plain; charset=utf-8";
  if (ext.match(/htm|xml|svg/i)) {
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
  const [namespace, kind, name, ...rest] = posixPath.split(path__default.default.posix.sep);
  const lowerNamespace = namespace.toLowerCase();
  const lowerKind = kind.toLowerCase();
  const lowerName = name.toLowerCase();
  return [lowerNamespace, lowerKind, lowerName, ...rest].join(path__default.default.posix.sep);
};
const lowerCaseEntityTripletInStoragePath = (originalPath) => {
  let posixPath = originalPath;
  if (originalPath.includes(path__default.default.win32.sep)) {
    posixPath = originalPath.split(path__default.default.win32.sep).join(path__default.default.posix.sep);
  }
  const parts = posixPath.split(path__default.default.posix.sep);
  if (parts[0] === "") {
    parts.shift();
  }
  if (parts.length <= 3) {
    throw new Error(
      `Encountered file unmanaged by TechDocs ${originalPath}. Skipping.`
    );
  }
  return lowerCaseEntityTriplet(parts.join(path__default.default.posix.sep));
};
const normalizeExternalStorageRootPath = (posixPath) => {
  let normalizedPath = posixPath;
  if (posixPath.startsWith(path__default.default.posix.sep)) {
    normalizedPath = posixPath.slice(1);
  }
  if (normalizedPath.endsWith(path__default.default.posix.sep)) {
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
  var _a, _b;
  const relativeFilePathPosix = localPath.split(path__default.default.sep).join(path__default.default.posix.sep);
  const entityRootDir = `${(_b = (_a = entity.metadata) == null ? void 0 : _a.namespace) != null ? _b : catalogModel$1.DEFAULT_NAMESPACE}/${entity.kind}/${entity.metadata.name}`;
  const relativeFilePathTriplet = `${entityRootDir}/${relativeFilePathPosix}`;
  const destination = useLegacyPathCasing ? relativeFilePathTriplet : lowerCaseEntityTriplet(relativeFilePathTriplet);
  const destinationWithRoot = [
    // The extra filter prevents unintended double slashes and prefixes.
    ...externalStorageRootPath.split(path__default.default.posix.sep).filter((s) => s !== ""),
    destination
  ].join("/");
  return destinationWithRoot;
};
const bulkStorageOperation = async (operation, args, { concurrencyLimit } = { concurrencyLimit: 25 }) => {
  const limiter = createLimiter__default.default(concurrencyLimit);
  await Promise.all(args.map((arg) => limiter(operation, arg)));
};

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
  logStream = new stream$1.PassThrough()
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
    if (integration && ["github", "gitlab", "bitbucketServer"].includes(integration.type)) {
      const { filepathtype } = gitUrlParse__default.default(target);
      if (filepathtype === "") {
        return { repo_url: target };
      }
      const sourceFolder = integration.resolveUrl({
        url: `./${docsFolder}`,
        base: target
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
const MKDOCS_SCHEMA = yaml.DEFAULT_SCHEMA.extend([
  new yaml.Type("", {
    kind: "scalar",
    multi: true,
    representName: (o) => o.type,
    represent: (o) => {
      var _a;
      return (_a = o.data) != null ? _a : "";
    },
    instanceOf: UnknownTag,
    construct: (data, type) => new UnknownTag(data, type)
  }),
  new yaml.Type("", {
    kind: "sequence",
    multi: true,
    representName: (o) => o.type,
    represent: (o) => {
      var _a;
      return (_a = o.data) != null ? _a : "";
    },
    instanceOf: UnknownTag,
    construct: (data, type) => new UnknownTag(data, type)
  })
]);
const generateMkdocsYml = async (inputDir, siteOptions) => {
  var _a;
  try {
    const mkdocsYmlPath = path__default.default.join(inputDir, "mkdocs.yml");
    const defaultSiteName = (_a = siteOptions == null ? void 0 : siteOptions.name) != null ? _a : "Documentation Site";
    const defaultMkdocsContent = {
      site_name: defaultSiteName,
      docs_dir: "docs",
      plugins: ["techdocs-core"]
    };
    await fs__default.default.writeFile(
      mkdocsYmlPath,
      yaml__default.default.dump(defaultMkdocsContent, { schema: MKDOCS_SCHEMA })
    );
  } catch (error) {
    throw new errors.ForwardedError("Could not generate mkdocs.yml file", error);
  }
};
const getMkdocsYml = async (inputDir, options) => {
  let mkdocsYmlPath;
  let mkdocsYmlFileString;
  try {
    if (options == null ? void 0 : options.mkdocsConfigFileName) {
      mkdocsYmlPath = path__default.default.join(inputDir, options.mkdocsConfigFileName);
      if (!await fs__default.default.pathExists(mkdocsYmlPath)) {
        throw new Error(`The specified file ${mkdocsYmlPath} does not exist`);
      }
      mkdocsYmlFileString = await fs__default.default.readFile(mkdocsYmlPath, "utf8");
      return {
        path: mkdocsYmlPath,
        content: mkdocsYmlFileString,
        configIsTemporary: false
      };
    }
    mkdocsYmlPath = path__default.default.join(inputDir, "mkdocs.yaml");
    if (await fs__default.default.pathExists(mkdocsYmlPath)) {
      mkdocsYmlFileString = await fs__default.default.readFile(mkdocsYmlPath, "utf8");
      return {
        path: mkdocsYmlPath,
        content: mkdocsYmlFileString,
        configIsTemporary: false
      };
    }
    mkdocsYmlPath = path__default.default.join(inputDir, "mkdocs.yml");
    if (await fs__default.default.pathExists(mkdocsYmlPath)) {
      mkdocsYmlFileString = await fs__default.default.readFile(mkdocsYmlPath, "utf8");
      return {
        path: mkdocsYmlPath,
        content: mkdocsYmlFileString,
        configIsTemporary: false
      };
    }
    await generateMkdocsYml(inputDir, options);
    mkdocsYmlFileString = await fs__default.default.readFile(mkdocsYmlPath, "utf8");
  } catch (error) {
    throw new errors.ForwardedError(
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
  const mkdocsYml = yaml__default.default.load(mkdocsYmlFileString, {
    schema: MKDOCS_SCHEMA
  });
  if (mkdocsYml === null || typeof mkdocsYml !== "object") {
    return void 0;
  }
  const parsedMkdocsYml = mkdocsYml;
  if (parsedMkdocsYml.docs_dir && !backendCommon$3.isChildPath(inputDir, path.resolve(inputDir, parsedMkdocsYml.docs_dir))) {
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
  const docsPath = path__default.default.join(inputDir, docsDir);
  const indexMdPath = path__default.default.join(docsPath, "index.md");
  if (await fs__default.default.pathExists(indexMdPath)) {
    return;
  }
  logger.warn(`${path__default.default.join(docsDir, "index.md")} not found.`);
  const fallbacks = [
    path__default.default.join(docsPath, "README.md"),
    path__default.default.join(docsPath, "readme.md"),
    path__default.default.join(inputDir, "README.md"),
    path__default.default.join(inputDir, "readme.md")
  ];
  await fs__default.default.ensureDir(docsPath);
  for (const filePath of fallbacks) {
    try {
      await fs__default.default.copyFile(filePath, indexMdPath);
      return;
    } catch (error) {
      logger.warn(`${path__default.default.relative(inputDir, filePath)} not found.`);
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
  const techdocsMetadataDir = techdocsMetadataPath.split(path__default.default.sep).slice(0, -1).join(path__default.default.sep);
  try {
    await fs__default.default.access(techdocsMetadataPath, fs__default.default.constants.F_OK);
  } catch (err) {
    await fs__default.default.writeJson(techdocsMetadataPath, JSON.parse("{}"));
  }
  let json;
  try {
    json = await fs__default.default.readJson(techdocsMetadataPath);
  } catch (err) {
    errors.assertError(err);
    const message = `Invalid JSON at ${techdocsMetadataPath} with error ${err.message}`;
    logger.error(message);
    throw new Error(message);
  }
  json.build_timestamp = Date.now();
  try {
    json.files = (await getFileTreeRecursively(techdocsMetadataDir)).map(
      (file) => file.replace(`${techdocsMetadataDir}${path__default.default.sep}`, "")
    );
  } catch (err) {
    errors.assertError(err);
    json.files = [];
    logger.warn(`Unable to add files list to metadata: ${err.message}`);
  }
  await fs__default.default.writeJson(techdocsMetadataPath, json);
  return;
};
const storeEtagMetadata = async (techdocsMetadataPath, etag) => {
  const json = await fs__default.default.readJson(techdocsMetadataPath);
  json.etag = etag;
  await fs__default.default.writeJson(techdocsMetadataPath, json);
};

const patchMkdocsFile = async (mkdocsYmlPath, logger, updateAction) => {
  let didEdit = false;
  let mkdocsYmlFileString;
  try {
    mkdocsYmlFileString = await fs__default.default.readFile(mkdocsYmlPath, "utf8");
  } catch (error) {
    errors.assertError(error);
    logger.warn(
      `Could not read MkDocs YAML config file ${mkdocsYmlPath} before running the generator: ${error.message}`
    );
    return;
  }
  let mkdocsYml;
  try {
    mkdocsYml = yaml__default.default.load(mkdocsYmlFileString, { schema: MKDOCS_SCHEMA });
    if (typeof mkdocsYml === "string" || typeof mkdocsYml === "undefined") {
      throw new Error("Bad YAML format.");
    }
  } catch (error) {
    errors.assertError(error);
    logger.warn(
      `Error in parsing YAML at ${mkdocsYmlPath} before running the generator. ${error.message}`
    );
    return;
  }
  didEdit = updateAction(mkdocsYml);
  try {
    if (didEdit) {
      await fs__default.default.writeFile(
        mkdocsYmlPath,
        yaml__default.default.dump(mkdocsYml, { schema: MKDOCS_SCHEMA }),
        "utf8"
      );
    }
  } catch (error) {
    errors.assertError(error);
    logger.warn(
      `Could not write to ${mkdocsYmlPath} after updating it before running the generator. ${error.message}`
    );
    return;
  }
};
const patchMkdocsYmlPreBuild = async (mkdocsYmlPath, logger, parsedLocationAnnotation, scmIntegrations) => {
  await patchMkdocsFile(mkdocsYmlPath, logger, (mkdocsYml) => {
    if (!("repo_url" in mkdocsYml) && !("edit_uri" in mkdocsYml)) {
      const result = getRepoUrlFromLocationAnnotation(
        parsedLocationAnnotation,
        scmIntegrations,
        mkdocsYml.docs_dir
      );
      if (result.repo_url || result.edit_uri) {
        mkdocsYml.repo_url = result.repo_url;
        mkdocsYml.edit_uri = result.edit_uri;
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

var __defProp$a = Object.defineProperty;
var __defNormalProp$a = (obj, key, value) => key in obj ? __defProp$a(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$a = (obj, key, value) => {
  __defNormalProp$a(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const _TechdocsGenerator = class _TechdocsGenerator {
  constructor(options) {
    __publicField$a(this, "logger");
    __publicField$a(this, "containerRunner");
    __publicField$a(this, "options");
    __publicField$a(this, "scmIntegrations");
    this.logger = options.logger;
    this.options = readGeneratorConfig(options.config, options.logger);
    this.containerRunner = options.containerRunner;
    this.scmIntegrations = options.scmIntegrations;
  }
  /**
   * Returns a instance of TechDocs generator
   * @param config - A Backstage configuration
   * @param options - Options to configure the generator
   */
  static fromConfig(config, options) {
    const { containerRunner, logger } = options;
    const scmIntegrations = integration.ScmIntegrations.fromConfig(config);
    return new _TechdocsGenerator({
      logger,
      containerRunner,
      config,
      scmIntegrations
    });
  }
  /** {@inheritDoc GeneratorBase.run} */
  async run(options) {
    var _a, _b;
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
    const { path: mkdocsYmlPath, content } = await getMkdocsYml(
      inputDir,
      siteOptions
    );
    const docsDir = await validateMkdocsYaml(inputDir, content);
    if (parsedLocationAnnotation) {
      await patchMkdocsYmlPreBuild(
        mkdocsYmlPath,
        childLogger,
        parsedLocationAnnotation,
        this.scmIntegrations
      );
    }
    if (this.options.legacyCopyReadmeMdToIndexMd) {
      await patchIndexPreBuild({ inputDir, logger: childLogger, docsDir });
    }
    const defaultPlugins = (_a = this.options.defaultPlugins) != null ? _a : [];
    if (!this.options.omitTechdocsCoreMkdocsPlugin && !defaultPlugins.includes("techdocs-core")) {
      defaultPlugins.push("techdocs-core");
    }
    await patchMkdocsYmlWithPlugins(mkdocsYmlPath, childLogger, defaultPlugins);
    const mountDirs = {
      [inputDir]: "/input",
      [outputDir]: "/output"
    };
    try {
      switch (this.options.runIn) {
        case "local":
          await runCommand({
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
        case "docker":
          if (this.containerRunner === void 0) {
            throw new Error(
              "Invalid state: containerRunner cannot be undefined when runIn is 'docker'"
            );
          }
          await this.containerRunner.runContainer({
            imageName: (_b = this.options.dockerImage) != null ? _b : _TechdocsGenerator.defaultDockerImage,
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
        default:
          throw new Error(
            `Invalid config value "${this.options.runIn}" provided in 'techdocs.generators.techdocs'.`
          );
      }
    } catch (error) {
      this.logger.debug(
        `Failed to generate docs from ${inputDir} into ${outputDir}`
      );
      throw new errors.ForwardedError(
        `Failed to generate docs from ${inputDir} into ${outputDir}`,
        error
      );
    }
    await createOrUpdateMetadata(
      path__default.default.join(outputDir, "techdocs_metadata.json"),
      childLogger
    );
    if (etag) {
      await storeEtagMetadata(
        path__default.default.join(outputDir, "techdocs_metadata.json"),
        etag
      );
    }
  }
};
/**
 * The default docker image (and version) used to generate content. Public
 * and static so that techdocs-node consumers can use the same version.
 */
__publicField$a(_TechdocsGenerator, "defaultDockerImage", "spotify/techdocs:v1.2.3");
let TechdocsGenerator = _TechdocsGenerator;
function readGeneratorConfig(config, logger) {
  var _a;
  const legacyGeneratorType = config.getOptionalString(
    "techdocs.generators.techdocs"
  );
  if (legacyGeneratorType) {
    logger.warn(
      `The 'techdocs.generators.techdocs' configuration key is deprecated and will be removed in the future. Please use 'techdocs.generator' instead. See here https://backstage.io/docs/features/techdocs/configuration`
    );
  }
  return {
    runIn: (_a = legacyGeneratorType != null ? legacyGeneratorType : config.getOptionalString("techdocs.generator.runIn")) != null ? _a : "docker",
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

var __defProp$9 = Object.defineProperty;
var __defNormalProp$9 = (obj, key, value) => key in obj ? __defProp$9(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$9 = (obj, key, value) => {
  __defNormalProp$9(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class Generators {
  constructor() {
    __publicField$9(this, "generatorMap", /* @__PURE__ */ new Map());
  }
  /**
   * Returns a generators instance containing a generator for TechDocs
   * @param config - A Backstage configuration
   * @param options - Options to configure the TechDocs generator
   */
  static async fromConfig(config, options) {
    var _a;
    const generators = new Generators();
    const techdocsGenerator = (_a = options.customGenerator) != null ? _a : TechdocsGenerator.fromConfig(config, options);
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
    const generatorKey = getGeneratorKey(entity);
    const generator = this.generatorMap.get(generatorKey);
    if (!generator) {
      throw new Error(`No generator registered for entity: "${generatorKey}"`);
    }
    return generator;
  }
}

const getMkDocsYml = getMkdocsYml;

const parseReferenceAnnotation = (annotationName, entity) => {
  var _a;
  const annotation = (_a = entity.metadata.annotations) == null ? void 0 : _a[annotationName];
  if (!annotation) {
    throw new errors.InputError(
      `No location annotation provided in entity: ${entity.metadata.name}`
    );
  }
  const { type, target } = catalogModel$1.parseLocationRef(annotation);
  return {
    type,
    target
  };
};
const transformDirLocation = (entity, dirAnnotation, scmIntegrations) => {
  const location = catalogModel$1.getEntitySourceLocation(entity);
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
      const target = backendCommon$3.resolveSafeChildPath(
        path__default.default.dirname(location.target),
        dirAnnotation.target
      );
      return {
        type: "dir",
        target
      };
    }
    default:
      throw new errors.InputError(`Unable to resolve location type ${location.type}`);
  }
};
const getLocationForEntity = (entity, scmIntegration) => {
  const annotation = parseReferenceAnnotation(
    "backstage.io/techdocs-ref",
    entity
  );
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
  var _a, _b;
  const { target } = parseReferenceAnnotation(
    "backstage.io/techdocs-ref",
    entity
  );
  (_a = opts == null ? void 0 : opts.logger) == null ? void 0 : _a.debug(`Reading files from ${target}`);
  const readTreeResponse = await reader.readTree(target, { etag: opts == null ? void 0 : opts.etag });
  const preparedDir = await readTreeResponse.dir();
  (_b = opts == null ? void 0 : opts.logger) == null ? void 0 : _b.debug(`Tree downloaded and stored at ${preparedDir}`);
  return {
    preparedDir,
    etag: readTreeResponse.etag
  };
};

var __defProp$8 = Object.defineProperty;
var __defNormalProp$8 = (obj, key, value) => key in obj ? __defProp$8(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$8 = (obj, key, value) => {
  __defNormalProp$8(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class DirectoryPreparer {
  constructor(config, _logger, reader) {
    __publicField$8(this, "scmIntegrations");
    __publicField$8(this, "reader");
    this.reader = reader;
    this.scmIntegrations = integration.ScmIntegrations.fromConfig(config);
  }
  /**
   * Returns a directory preparer instance
   * @param config - A backstage config
   * @param options - A directory preparer options containing a logger and reader
   */
  static fromConfig(config, options) {
    return new DirectoryPreparer(config, options.logger, options.reader);
  }
  /** {@inheritDoc PreparerBase.shouldCleanPreparedDirectory} */
  shouldCleanPreparedDirectory() {
    return false;
  }
  /** {@inheritDoc PreparerBase.prepare} */
  async prepare(entity, options) {
    var _a, _b;
    const annotation = parseReferenceAnnotation(
      "backstage.io/techdocs-ref",
      entity
    );
    const { type, target } = transformDirLocation(
      entity,
      annotation,
      this.scmIntegrations
    );
    switch (type) {
      case "url": {
        (_a = options == null ? void 0 : options.logger) == null ? void 0 : _a.debug(`Reading files from ${target}`);
        const response = await this.reader.readTree(target, {
          etag: options == null ? void 0 : options.etag
        });
        const preparedDir = await response.dir();
        (_b = options == null ? void 0 : options.logger) == null ? void 0 : _b.debug(`Tree downloaded and stored at ${preparedDir}`);
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
        throw new errors.InputError(`Unable to resolve location type ${type}`);
    }
  }
}

var __defProp$7 = Object.defineProperty;
var __defNormalProp$7 = (obj, key, value) => key in obj ? __defProp$7(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$7 = (obj, key, value) => {
  __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class UrlPreparer {
  constructor(reader, logger) {
    __publicField$7(this, "logger");
    __publicField$7(this, "reader");
    this.logger = logger;
    this.reader = reader;
  }
  /**
   * Returns a directory preparer instance
   * @param config - A URL preparer config containing the a logger and reader
   */
  static fromConfig(options) {
    return new UrlPreparer(options.reader, options.logger);
  }
  /** {@inheritDoc PreparerBase.shouldCleanPreparedDirectory} */
  shouldCleanPreparedDirectory() {
    return true;
  }
  /** {@inheritDoc PreparerBase.prepare} */
  async prepare(entity, options) {
    try {
      return await getDocFilesFromRepository(this.reader, entity, {
        etag: options == null ? void 0 : options.etag,
        logger: this.logger
      });
    } catch (error) {
      errors.assertError(error);
      if (error.name === "NotModifiedError") {
        this.logger.debug(`Cache is valid for etag ${options == null ? void 0 : options.etag}`);
      } else {
        this.logger.debug(
          `Unable to fetch files for building docs ${error.message}`
        );
      }
      throw error;
    }
  }
}

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => {
  __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class Preparers {
  constructor() {
    __publicField$6(this, "preparerMap", /* @__PURE__ */ new Map());
  }
  /**
   * Returns a generators instance containing a generator for TechDocs
   * @public
   * @param backstageConfig - A Backstage configuration
   * @param preparerConfig - Options to configure preparers
   */
  static async fromConfig(backstageConfig, options) {
    const preparers = new Preparers();
    const urlPreparer = UrlPreparer.fromConfig({
      reader: options.reader,
      logger: options.logger
    });
    preparers.register("url", urlPreparer);
    const directoryPreparer = DirectoryPreparer.fromConfig(backstageConfig, {
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
    const { type } = parseReferenceAnnotation(
      "backstage.io/techdocs-ref",
      entity
    );
    const preparer = this.preparerMap.get(type);
    if (!preparer) {
      throw new Error(`No preparer registered for type: "${type}"`);
    }
    return preparer;
  }
}

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => {
  __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const streamToBuffer$1 = (stream) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on(
        "error",
        (e) => reject(new errors.ForwardedError("Unable to read stream", e))
      );
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (e) {
      throw new errors.ForwardedError("Unable to parse the response data", e);
    }
  });
};
class AwsS3Publish {
  constructor(options) {
    __publicField$5(this, "storageClient");
    __publicField$5(this, "bucketName");
    __publicField$5(this, "legacyPathCasing");
    __publicField$5(this, "logger");
    __publicField$5(this, "bucketRootPath");
    __publicField$5(this, "sse");
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
    const bucketRootPath = normalizeExternalStorageRootPath(
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
      const remoteFolder = getCloudPathForLocalPath(
        entity,
        void 0,
        useLegacyPathCasing,
        bucketRootPath
      );
      existingFiles = await this.getAllObjectsFromBucket({
        prefix: remoteFolder
      });
    } catch (e) {
      errors.assertError(e);
      this.logger.error(
        `Unable to list files for Entity ${entity.metadata.name}: ${e.message}`
      );
    }
    let absoluteFilesToUpload;
    try {
      absoluteFilesToUpload = await getFileTreeRecursively(directory);
      await bulkStorageOperation(
        async (absoluteFilePath) => {
          const relativeFilePath = path__default.default.relative(directory, absoluteFilePath);
          const fileStream = fs__default.default.createReadStream(absoluteFilePath);
          const params = {
            Bucket: this.bucketName,
            Key: getCloudPathForLocalPath(
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
        (absoluteFilePath) => getCloudPathForLocalPath(
          entity,
          path__default.default.relative(directory, absoluteFilePath),
          useLegacyPathCasing,
          bucketRootPath
        )
      );
      const staleFiles = getStaleFiles(relativeFilesToUpload, existingFiles);
      await bulkStorageOperation(
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
        const entityDir = this.legacyPathCasing ? entityTriplet : lowerCaseEntityTriplet(entityTriplet);
        const entityRootDir = path__default.default.posix.join(this.bucketRootPath, entityDir);
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
          const techdocsMetadata = JSON5__default.default.parse(
            techdocsMetadataJson.toString("utf-8")
          );
          resolve(techdocsMetadata);
        } catch (err) {
          errors.assertError(err);
          this.logger.error(err.message);
          reject(new Error(err.message));
        }
      });
    } catch (e) {
      throw new errors.ForwardedError("TechDocs metadata fetch failed", e);
    }
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return async (req, res) => {
      const decodedUri = decodeURI(req.path.replace(/^\//, ""));
      const filePathNoRoot = this.legacyPathCasing ? decodedUri : lowerCaseEntityTripletInStoragePath(decodedUri);
      const filePath = path__default.default.posix.join(this.bucketRootPath, filePathNoRoot);
      const fileExtension = path__default.default.extname(filePath);
      const responseHeaders = getHeadersForFileExtension(fileExtension);
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
        errors.assertError(err);
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
      const entityDir = this.legacyPathCasing ? entityTriplet : lowerCaseEntityTriplet(entityTriplet);
      const entityRootDir = path__default.default.posix.join(this.bucketRootPath, entityDir);
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
    const limiter = createLimiter__default.default(concurrency);
    await Promise.all(
      allObjects.map(
        (f) => limiter(async (file) => {
          let newPath;
          try {
            newPath = lowerCaseEntityTripletInStoragePath(file);
          } catch (e) {
            errors.assertError(e);
            this.logger.warn(e.message);
            return;
          }
          if (file === newPath) {
            return;
          }
          try {
            this.logger.verbose(`Migrating ${file}`);
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
            errors.assertError(e);
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

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => {
  __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const BATCH_CONCURRENCY = 3;
class AzureBlobStoragePublish {
  constructor(options) {
    __publicField$4(this, "storageClient");
    __publicField$4(this, "containerName");
    __publicField$4(this, "legacyPathCasing");
    __publicField$4(this, "logger");
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
      errors.assertError(e);
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
    const remoteFolder = getCloudPathForLocalPath(
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
      errors.assertError(e);
      this.logger.error(
        `Unable to list files for Entity ${entity.metadata.name}: ${e.message}`
      );
    }
    let absoluteFilesToUpload;
    let container;
    try {
      absoluteFilesToUpload = await getFileTreeRecursively(directory);
      container = this.storageClient.getContainerClient(this.containerName);
      const failedOperations = [];
      await bulkStorageOperation(
        async (absoluteFilePath) => {
          const relativeFilePath = path__default.default.normalize(
            path__default.default.relative(directory, absoluteFilePath)
          );
          const remotePath = getCloudPathForLocalPath(
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
        (absoluteFilePath) => getCloudPathForLocalPath(
          entity,
          path__default.default.relative(directory, absoluteFilePath),
          useLegacyPathCasing
        )
      );
      const staleFiles = getStaleFiles(relativeFilesToUpload, existingFiles);
      await bulkStorageOperation(
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
    const entityRootDir = this.legacyPathCasing ? entityTriplet : lowerCaseEntityTriplet(entityTriplet);
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
      const techdocsMetadata = JSON5__default.default.parse(
        techdocsMetadataJson.toString("utf-8")
      );
      return techdocsMetadata;
    } catch (e) {
      throw new errors.ForwardedError("TechDocs metadata fetch failed", e);
    }
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return (req, res) => {
      const decodedUri = decodeURI(req.path.replace(/^\//, ""));
      const filePath = this.legacyPathCasing ? decodedUri : lowerCaseEntityTripletInStoragePath(decodedUri);
      const fileExtension = path__default.default.extname(filePath);
      const responseHeaders = getHeadersForFileExtension(fileExtension);
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
    const entityRootDir = this.legacyPathCasing ? entityTriplet : lowerCaseEntityTriplet(entityTriplet);
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
      newPath = lowerCaseEntityTripletInStoragePath(originalPath);
    } catch (e) {
      errors.assertError(e);
      this.logger.warn(e.message);
      return;
    }
    if (originalPath === newPath)
      return;
    try {
      this.logger.verbose(`Migrating ${originalPath}`);
      await this.renameBlob(originalPath, newPath, removeOriginal);
    } catch (e) {
      errors.assertError(e);
      this.logger.warn(`Unable to migrate ${originalPath}: ${e.message}`);
    }
  }
  async migrateDocsCase({
    removeOriginal = false,
    concurrency = 25
  }) {
    const promises = [];
    const limiter = createLimiter__default.default(concurrency);
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
    var _a, _b;
    const blobs = [];
    const container = this.storageClient.getContainerClient(this.containerName);
    let iterator = container.listBlobsFlat({ prefix }).byPage({ maxPageSize });
    let response = (await iterator.next()).value;
    do {
      for (const blob of (_b = (_a = response == null ? void 0 : response.segment) == null ? void 0 : _a.blobItems) != null ? _b : []) {
        blobs.push(blob.name);
      }
      iterator = container.listBlobsFlat({ prefix }).byPage({ continuationToken: response.continuationToken, maxPageSize });
      response = (await iterator.next()).value;
    } while (response && response.continuationToken);
    return blobs;
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => {
  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class MigrateWriteStream extends stream$1.Writable {
  constructor(logger, removeOriginal, concurrency) {
    super({ objectMode: true });
    __publicField$3(this, "logger");
    __publicField$3(this, "removeOriginal");
    __publicField$3(this, "maxConcurrency");
    __publicField$3(this, "inFlight", 0);
    this.logger = logger;
    this.removeOriginal = removeOriginal;
    this.maxConcurrency = concurrency;
  }
  _write(file, _encoding, next) {
    let shouldCallNext = true;
    let newFile;
    try {
      newFile = lowerCaseEntityTripletInStoragePath(file.name);
    } catch (e) {
      errors.assertError(e);
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
    this.logger.verbose(`Migrating ${file.name}`);
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

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class GoogleGCSPublish {
  constructor(options) {
    __publicField$2(this, "storageClient");
    __publicField$2(this, "bucketName");
    __publicField$2(this, "legacyPathCasing");
    __publicField$2(this, "logger");
    __publicField$2(this, "bucketRootPath");
    this.storageClient = options.storageClient;
    this.bucketName = options.bucketName;
    this.legacyPathCasing = options.legacyPathCasing;
    this.logger = options.logger;
    this.bucketRootPath = options.bucketRootPath;
  }
  static fromConfig(config, logger) {
    let bucketName = "";
    try {
      bucketName = config.getString("techdocs.publisher.googleGcs.bucketName");
    } catch (error) {
      throw new Error(
        "Since techdocs.publisher.type is set to 'googleGcs' in your app config, techdocs.publisher.googleGcs.bucketName is required."
      );
    }
    const bucketRootPath = normalizeExternalStorageRootPath(
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
    const clientOpts = {};
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
      errors.assertError(err);
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
      const remoteFolder = getCloudPathForLocalPath(
        entity,
        void 0,
        useLegacyPathCasing,
        bucketRootPath
      );
      existingFiles = await this.getFilesForFolder(remoteFolder);
    } catch (e) {
      errors.assertError(e);
      this.logger.error(
        `Unable to list files for Entity ${entity.metadata.name}: ${e.message}`
      );
    }
    let absoluteFilesToUpload;
    try {
      absoluteFilesToUpload = await getFileTreeRecursively(directory);
      await bulkStorageOperation(
        async (absoluteFilePath) => {
          const relativeFilePath = path__default.default.relative(directory, absoluteFilePath);
          const destination = getCloudPathForLocalPath(
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
        (absoluteFilePath) => getCloudPathForLocalPath(
          entity,
          path__default.default.relative(directory, absoluteFilePath),
          useLegacyPathCasing,
          bucketRootPath
        )
      );
      const staleFiles = getStaleFiles(relativeFilesToUpload, existingFiles);
      await bulkStorageOperation(
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
      const entityDir = this.legacyPathCasing ? entityTriplet : lowerCaseEntityTriplet(entityTriplet);
      const entityRootDir = path__default.default.posix.join(this.bucketRootPath, entityDir);
      const fileStreamChunks = [];
      this.storageClient.bucket(this.bucketName).file(`${entityRootDir}/techdocs_metadata.json`).createReadStream().on("error", (err) => {
        this.logger.error(err.message);
        reject(err);
      }).on("data", (chunk) => {
        fileStreamChunks.push(chunk);
      }).on("end", () => {
        const techdocsMetadataJson = Buffer.concat(fileStreamChunks).toString("utf-8");
        resolve(JSON5__default.default.parse(techdocsMetadataJson));
      });
    });
  }
  /**
   * Express route middleware to serve static files on a route in techdocs-backend.
   */
  docsRouter() {
    return (req, res) => {
      const decodedUri = decodeURI(req.path.replace(/^\//, ""));
      const filePathNoRoot = this.legacyPathCasing ? decodedUri : lowerCaseEntityTripletInStoragePath(decodedUri);
      const filePath = path__default.default.posix.join(this.bucketRootPath, filePathNoRoot);
      const fileExtension = path__default.default.extname(filePath);
      const responseHeaders = getHeadersForFileExtension(fileExtension);
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
      const entityDir = this.legacyPathCasing ? entityTriplet : lowerCaseEntityTriplet(entityTriplet);
      const entityRootDir = path__default.default.posix.join(this.bucketRootPath, entityDir);
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
      const migrateFiles = new MigrateWriteStream(
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

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class LocalPublish {
  constructor(options) {
    __publicField$1(this, "legacyPathCasing");
    __publicField$1(this, "logger");
    __publicField$1(this, "discovery");
    __publicField$1(this, "staticDocsDir");
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
        staticDocsDir = backendCommon$3.resolvePackagePath(
          "@backstage/plugin-techdocs-backend",
          "static/docs"
        );
      } catch (err) {
        staticDocsDir = os__default.default.tmpdir();
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
    var _a;
    const entityNamespace = (_a = entity.metadata.namespace) != null ? _a : "default";
    let publishDir;
    try {
      publishDir = this.staticEntityPathJoin(
        entityNamespace,
        entity.kind,
        entity.metadata.name
      );
    } catch (error) {
      throw new errors.ForwardedError(
        `Unable to publish TechDocs site for entity: ${catalogModel$1.stringifyEntityRef(
          entity
        )}`,
        error
      );
    }
    if (!fs__default.default.existsSync(publishDir)) {
      this.logger.info(`Could not find ${publishDir}, creating the directory.`);
      fs__default.default.mkdirSync(publishDir, { recursive: true });
    }
    try {
      await fs__default.default.copy(directory, publishDir);
      this.logger.info(`Published site stored at ${publishDir}`);
    } catch (error) {
      this.logger.debug(
        `Failed to copy docs from ${directory} to ${publishDir}`
      );
      throw error;
    }
    const techdocsApiUrl = await this.discovery.getBaseUrl("techdocs");
    const publishedFilePaths = (await getFileTreeRecursively(publishDir)).map(
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
      throw new errors.ForwardedError(
        `Unexpected entity when fetching metadata: ${catalogModel$1.stringifyEntityRef(
          entityName
        )}`,
        err
      );
    }
    try {
      return await fs__default.default.readJson(metadataPath);
    } catch (err) {
      throw new errors.ForwardedError(
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
          const fileExtension = path__default.default.extname(filePath);
          const headers = getHeadersForFileExtension(fileExtension);
          for (const [header, value] of Object.entries(headers)) {
            res.setHeader(header, value);
          }
        }
      })
    );
    return router;
  }
  async hasDocsBeenGenerated(entity) {
    var _a;
    const namespace = (_a = entity.metadata.namespace) != null ? _a : "default";
    try {
      const indexHtmlPath = this.staticEntityPathJoin(
        namespace,
        entity.kind,
        entity.metadata.name,
        "index.html"
      );
      await fs__default.default.access(indexHtmlPath, fs__default.default.constants.F_OK);
      return true;
    } catch (err) {
      if (err.name === "NotAllowedError") {
        this.logger.error(
          `Unexpected entity when checking if generated: ${catalogModel$1.stringifyEntityRef(
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
    const files = await getFileTreeRecursively(this.staticDocsDir);
    const limit = createLimiter__default.default(concurrency);
    await Promise.all(
      files.map(
        (f) => limit(async (file) => {
          const relativeFile = file.replace(
            `${this.staticDocsDir}${path__default.default.sep}`,
            ""
          );
          const newFile = lowerCaseEntityTripletInStoragePath(relativeFile);
          if (relativeFile === newFile) {
            return;
          }
          await new Promise((resolve) => {
            const migrate = removeOriginal ? fs__default.default.move : fs__default.default.copyFile;
            this.logger.verbose(`Migrating ${relativeFile}`);
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
    allParts.map((part) => part.split(path__default.default.sep)).flat().forEach((part, index) => {
      if (index < 3) {
        staticEntityPath = backendCommon$3.resolveSafeChildPath(
          staticEntityPath,
          this.legacyPathCasing ? part : part.toLowerCase()
        );
        return;
      }
      staticEntityPath = backendCommon$3.resolveSafeChildPath(staticEntityPath, part);
    });
    return staticEntityPath;
  }
}

var __defProp$b = Object.defineProperty;
var __defNormalProp$b = (obj, key, value) => key in obj ? __defProp$b(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$b = (obj, key, value) => {
  __defNormalProp$b(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    try {
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    } catch (e) {
      throw new errors.ForwardedError("Unable to parse the response data", e);
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
  constructor(options) {
    __publicField$b(this, "storageClient");
    __publicField$b(this, "containerName");
    __publicField$b(this, "logger");
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
      errors.assertError(err);
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
      const allFilesToUpload = await getFileTreeRecursively(directory);
      const limiter = createLimiter__default.default(10);
      const uploadPromises = [];
      for (const filePath of allFilesToUpload) {
        const relativeFilePath = path__default.default.relative(directory, filePath);
        const relativeFilePathPosix = relativeFilePath.split(path__default.default.sep).join(path__default.default.posix.sep);
        const entityRootDir = `${entity.metadata.namespace}/${entity.kind}/${entity.metadata.name}`;
        const destination = `${entityRootDir}/${relativeFilePathPosix}`;
        objects.push(destination);
        const uploadFile = limiter(async () => {
          const fileBuffer = await fs__default.default.readFile(filePath);
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
          errors.assertError(err);
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
      const fileExtension = path__default.default.extname(filePath);
      const responseHeaders = getHeadersForFileExtension(fileExtension);
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
          errors.assertError(err);
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
      errors.assertError(err);
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
            newPath = lowerCaseEntityTripletInStoragePath(file);
          } catch (e) {
            errors.assertError(e);
            this.logger.warn(e.message);
            return;
          }
          if (file === newPath) {
            return;
          }
          try {
            this.logger.verbose(`Migrating ${file} to ${newPath}`);
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
            errors.assertError(e);
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

class Publisher {
  /**
   * Returns a instance of TechDocs publisher
   * @param config - A Backstage configuration
   * @param options - Options for configuring the publisher factory
   */
  static async fromConfig(config, options) {
    var _a;
    const { logger, discovery } = options;
    const publisherType = (_a = config.getOptionalString(
      "techdocs.publisher.type"
    )) != null ? _a : "local";
    switch (publisherType) {
      case "googleGcs":
        logger.info("Creating Google Storage Bucket publisher for TechDocs");
        return GoogleGCSPublish.fromConfig(config, logger);
      case "awsS3":
        logger.info("Creating AWS S3 Bucket publisher for TechDocs");
        return await AwsS3Publish.fromConfig(config, logger);
      case "azureBlobStorage":
        logger.info(
          "Creating Azure Blob Storage Container publisher for TechDocs"
        );
        return AzureBlobStoragePublish.fromConfig(config, logger);
      case "openStackSwift":
        logger.info(
          "Creating OpenStack Swift Container publisher for TechDocs"
        );
        return OpenStackSwiftPublish.fromConfig(config, logger);
      case "local":
        logger.info("Creating Local publisher for TechDocs");
        return LocalPublish.fromConfig(config, logger, discovery);
      default:
        logger.info("Creating Local publisher for TechDocs");
        return LocalPublish.fromConfig(config, logger, discovery);
    }
  }
}

const techdocsBuildsExtensionPoint = backendPluginApi$2.createExtensionPoint({
  id: "techdocs.builds"
});
const techdocsGeneratorExtensionPoint = backendPluginApi$2.createExtensionPoint({
  id: "techdocs.generator"
});

index_cjs$2.DirectoryPreparer = DirectoryPreparer;
index_cjs$2.Generators = Generators;
index_cjs$2.Preparers = Preparers;
index_cjs$2.Publisher = Publisher;
index_cjs$2.TechdocsGenerator = TechdocsGenerator;
index_cjs$2.UrlPreparer = UrlPreparer;
index_cjs$2.getDocFilesFromRepository = getDocFilesFromRepository;
index_cjs$2.getLocationForEntity = getLocationForEntity;
index_cjs$2.getMkDocsYml = getMkDocsYml;
index_cjs$2.getMkdocsYml = getMkdocsYml;
index_cjs$2.parseReferenceAnnotation = parseReferenceAnnotation;
index_cjs$2.techdocsBuildsExtensionPoint = techdocsBuildsExtensionPoint;
index_cjs$2.techdocsGeneratorExtensionPoint = techdocsGeneratorExtensionPoint;
index_cjs$2.transformDirLocation = transformDirLocation;

var index_cjs$1 = {};

var index_cjs = {};

var backendCommon$2 = require$$0;
var catalogClient = require$$1$2;
var catalogModel = require$$2;
var alpha$3 = require$$3$1;
var unescape = require$$4$1;
var fetch = require$$5$1;
var pLimit = require$$11;
var stream = require$$8;

function _interopDefaultCompat$1 (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var unescape__default = /*#__PURE__*/_interopDefaultCompat$1(unescape);
var fetch__default = /*#__PURE__*/_interopDefaultCompat$1(fetch);
var pLimit__default = /*#__PURE__*/_interopDefaultCompat$1(pLimit);

const getDocumentText = (entity) => {
  var _a, _b, _c, _d;
  const documentTexts = [];
  documentTexts.push(entity.metadata.description || "");
  if (catalogModel.isUserEntity(entity) || catalogModel.isGroupEntity(entity)) {
    if ((_b = (_a = entity.spec) == null ? void 0 : _a.profile) == null ? void 0 : _b.displayName) {
      documentTexts.push(entity.spec.profile.displayName);
    }
  }
  if (catalogModel.isUserEntity(entity)) {
    if ((_d = (_c = entity.spec) == null ? void 0 : _c.profile) == null ? void 0 : _d.email) {
      documentTexts.push(entity.spec.profile.email);
    }
  }
  return documentTexts.join(" : ");
};
const defaultTechDocsCollatorEntityTransformer = (entity) => {
  var _a, _b, _c, _d, _e, _f;
  return {
    kind: entity.kind,
    namespace: entity.metadata.namespace || "default",
    annotations: entity.metadata.annotations || "",
    name: entity.metadata.name || "",
    title: entity.metadata.title || "",
    text: getDocumentText(entity),
    componentType: ((_b = (_a = entity.spec) == null ? void 0 : _a.type) == null ? void 0 : _b.toString()) || "other",
    type: ((_d = (_c = entity.spec) == null ? void 0 : _c.type) == null ? void 0 : _d.toString()) || "other",
    lifecycle: ((_e = entity.spec) == null ? void 0 : _e.lifecycle) || "",
    owner: ((_f = entity.spec) == null ? void 0 : _f.owner) || "",
    path: ""
  };
};

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class DefaultTechDocsCollatorFactory {
  constructor(options) {
    __publicField(this, "type", "techdocs");
    __publicField(this, "visibilityPermission", alpha$3.catalogEntityReadPermission);
    __publicField(this, "discovery");
    __publicField(this, "locationTemplate");
    __publicField(this, "logger");
    __publicField(this, "auth");
    __publicField(this, "catalogClient");
    __publicField(this, "parallelismLimit");
    __publicField(this, "legacyPathCasing");
    __publicField(this, "entityTransformer");
    var _a, _b, _c;
    this.discovery = options.discovery;
    this.locationTemplate = options.locationTemplate || "/docs/:namespace/:kind/:name/:path";
    this.logger = options.logger.child({ documentType: this.type });
    this.catalogClient = options.catalogClient || new catalogClient.CatalogClient({ discoveryApi: options.discovery });
    this.parallelismLimit = (_a = options.parallelismLimit) != null ? _a : 10;
    this.legacyPathCasing = (_b = options.legacyPathCasing) != null ? _b : false;
    this.entityTransformer = (_c = options.entityTransformer) != null ? _c : defaultTechDocsCollatorEntityTransformer;
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
    return stream.Readable.from(this.execute());
  }
  async *execute() {
    const limit = pLimit__default.default(this.parallelismLimit);
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
            "metadata.annotations.backstage.io/techdocs-ref": catalogClient.CATALOG_FILTER_EXISTS
          },
          limit: batchSize,
          offset: entitiesRetrieved
        },
        { token: catalogToken }
      )).items;
      moreEntitiesToGet = entities.length === batchSize;
      entitiesRetrieved += entities.length;
      const docPromises = entities.filter((it) => {
        var _a, _b;
        return (_b = (_a = it.metadata) == null ? void 0 : _a.annotations) == null ? void 0 : _b["backstage.io/techdocs-ref"];
      }).map(
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
            const searchIndexResponse = await fetch__default.default(
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
            return searchIndex.docs.map((doc) => {
              var _a, _b, _c;
              return {
                ...this.entityTransformer(entity),
                title: unescape__default.default(doc.title),
                text: unescape__default.default(doc.text || ""),
                location: this.applyArgsToFormat(
                  this.locationTemplate || "/docs/:namespace/:kind/:name/:path",
                  {
                    ...entityInfo,
                    path: doc.location
                  }
                ),
                path: doc.location,
                ...entityInfo,
                entityTitle: entity.metadata.title,
                componentType: ((_b = (_a = entity.spec) == null ? void 0 : _a.type) == null ? void 0 : _b.toString()) || "other",
                lifecycle: ((_c = entity.spec) == null ? void 0 : _c.lifecycle) || "",
                owner: getSimpleEntityOwnerString(entity),
                authorization: {
                  resourceRef: catalogModel.stringifyEntityRef(entity)
                }
              };
            });
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
    const owner = entity.relations.find((r) => r.type === catalogModel.RELATION_OWNED_BY);
    if (owner) {
      const { name } = catalogModel.parseEntityRef(owner.targetRef);
      return name;
    }
  }
  return "";
}

index_cjs.DefaultTechDocsCollatorFactory = DefaultTechDocsCollatorFactory;
index_cjs.defaultTechDocsCollatorEntityTransformer = defaultTechDocsCollatorEntityTransformer;

(function (exports) {

	var backendCommon = require$$0;
	var catalogClient = require$$1$2;
	var catalogModel = require$$2;
	var errors = require$$3;
	var pluginTechdocsNode = index_cjs$2;
	var router = require$$5$2;
	var integration = require$$1$1;
	var fetch = require$$5$1;
	var pLimit = require$$11;
	var stream = require$$8;
	var winston = require$$10$1;
	var fs = require$$5;
	var os = require$$24;
	var path = require$$0$1;
	var unescape = require$$4$1;
	var alpha = require$$3$1;
	var pluginSearchBackendModuleTechdocs = index_cjs;

	function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

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

	var router__default = /*#__PURE__*/_interopDefaultCompat(router);
	var fetch__default = /*#__PURE__*/_interopDefaultCompat(fetch);
	var pLimit__default = /*#__PURE__*/_interopDefaultCompat(pLimit);
	var winston__namespace = /*#__PURE__*/_interopNamespaceCompat(winston);
	var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
	var os__default = /*#__PURE__*/_interopDefaultCompat(os);
	var path__default = /*#__PURE__*/_interopDefaultCompat(path);
	var unescape__default = /*#__PURE__*/_interopDefaultCompat(unescape);

	var __defProp$6 = Object.defineProperty;
	var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField$6 = (obj, key, value) => {
	  __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	const lastUpdatedRecord = {};
	class BuildMetadataStorage {
	  constructor(entityUid) {
	    __publicField$6(this, "entityUid");
	    __publicField$6(this, "lastUpdatedRecord");
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
	  const lastUpdated = new BuildMetadataStorage(entityUid).getLastUpdated();
	  if (lastUpdated) {
	    if (Date.now() - lastUpdated < 60 * 1e3) {
	      return false;
	    }
	  }
	  return true;
	};

	var __defProp$5 = Object.defineProperty;
	var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField$5 = (obj, key, value) => {
	  __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class DocsBuilder {
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
	    __publicField$5(this, "preparer");
	    __publicField$5(this, "generator");
	    __publicField$5(this, "publisher");
	    __publicField$5(this, "entity");
	    __publicField$5(this, "logger");
	    __publicField$5(this, "config");
	    __publicField$5(this, "scmIntegrations");
	    __publicField$5(this, "logStream");
	    __publicField$5(this, "cache");
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
	    var _a, _b, _c;
	    if (!this.entity.metadata.uid) {
	      throw new Error(
	        "Trying to build documentation for entity not in software catalog"
	      );
	    }
	    this.logger.info(
	      `Step 1 of 3: Preparing docs for entity ${catalogModel.stringifyEntityRef(
	        this.entity
	      )}`
	    );
	    let storedEtag;
	    if (await this.publisher.hasDocsBeenGenerated(this.entity)) {
	      try {
	        storedEtag = (await this.publisher.fetchTechDocsMetadata({
	          namespace: (_a = this.entity.metadata.namespace) != null ? _a : catalogModel.DEFAULT_NAMESPACE,
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
	      if (errors.isError(err) && err.name === "NotModifiedError") {
	        new BuildMetadataStorage(this.entity.metadata.uid).setLastUpdated();
	        this.logger.debug(
	          `Docs for ${catalogModel.stringifyEntityRef(
	            this.entity
	          )} are unmodified. Using cache, skipping generate and prepare`
	        );
	        return false;
	      }
	      throw err;
	    }
	    this.logger.info(
	      `Prepare step completed for entity ${catalogModel.stringifyEntityRef(
	        this.entity
	      )}, stored at ${preparedDir}`
	    );
	    this.logger.info(
	      `Step 2 of 3: Generating docs for entity ${catalogModel.stringifyEntityRef(
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
	    const parsedLocationAnnotation = pluginTechdocsNode.getLocationForEntity(
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
	        name: (_b = this.entity.metadata.title) != null ? _b : this.entity.metadata.name
	      }
	    });
	    if (this.preparer.shouldCleanPreparedDirectory()) {
	      this.logger.debug(
	        `Removing prepared directory ${preparedDir} since the site has been generated`
	      );
	      try {
	        fs__default.default.remove(preparedDir);
	      } catch (error) {
	        errors.assertError(error);
	        this.logger.debug(`Error removing prepared directory ${error.message}`);
	      }
	    }
	    this.logger.info(
	      `Step 3 of 3: Publishing docs for entity ${catalogModel.stringifyEntityRef(
	        this.entity
	      )}`
	    );
	    const published = await this.publisher.publish({
	      entity: this.entity,
	      directory: outputDir
	    });
	    if (this.cache && published && ((_c = published == null ? void 0 : published.objects) == null ? void 0 : _c.length)) {
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
	      errors.assertError(error);
	      this.logger.debug(`Error removing generated directory ${error.message}`);
	    }
	    new BuildMetadataStorage(this.entity.metadata.uid).setLastUpdated();
	    return true;
	  }
	}

	var __defProp$4 = Object.defineProperty;
	var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField$4 = (obj, key, value) => {
	  __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class DocsSynchronizer {
	  constructor({
	    publisher,
	    logger,
	    buildLogTransport,
	    config,
	    scmIntegrations,
	    cache
	  }) {
	    __publicField$4(this, "publisher");
	    __publicField$4(this, "logger");
	    __publicField$4(this, "buildLogTransport");
	    __publicField$4(this, "config");
	    __publicField$4(this, "scmIntegrations");
	    __publicField$4(this, "cache");
	    __publicField$4(this, "buildLimiter");
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
	    if (!shouldCheckForUpdate(entity.metadata.uid)) {
	      finish({ updated: false });
	      return;
	    }
	    let foundDocs = false;
	    try {
	      const docsBuilder = new DocsBuilder({
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
	      errors.assertError(e);
	      const msg = `Failed to build the docs page for entity ${catalogModel.stringifyEntityRef(
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
	        new errors.NotFoundError(
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
	    var _a;
	    if (!shouldCheckForUpdate(entity.metadata.uid) || !this.cache) {
	      finish({ updated: false });
	      return;
	    }
	    const baseUrl = await discovery.getBaseUrl("techdocs");
	    const namespace = ((_a = entity.metadata) == null ? void 0 : _a.namespace) || catalogModel.DEFAULT_NAMESPACE;
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
	      errors.assertError(e);
	      this.logger.error(
	        `Error syncing cache for ${entityTripletPath}: ${e.message}`
	      );
	      finish({ updated: false });
	    } finally {
	      new BuildMetadataStorage(entity.metadata.uid).setLastUpdated();
	    }
	  }
	}

	const createCacheMiddleware = ({
	  cache
	}) => {
	  const cacheMiddleware = router__default.default();
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

	var __defProp$3 = Object.defineProperty;
	var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField$3 = (obj, key, value) => {
	  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class CacheInvalidationError extends errors.CustomErrorBase {
	}
	class TechDocsCache {
	  constructor({
	    cache,
	    logger,
	    readTimeout
	  }) {
	    __publicField$3(this, "cache");
	    __publicField$3(this, "logger");
	    __publicField$3(this, "readTimeout");
	    this.cache = cache;
	    this.logger = logger;
	    this.readTimeout = readTimeout;
	  }
	  static fromConfig(config, { cache, logger }) {
	    const timeout = config.getOptionalNumber("techdocs.cache.readTimeout");
	    const readTimeout = timeout === void 0 ? 1e3 : timeout;
	    return new TechDocsCache({ cache, logger, readTimeout });
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
	      errors.assertError(e);
	      this.logger.warn(`Error getting cache entry ${path}: ${e.message}`);
	      this.logger.debug(e.stack);
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

	var __defProp$2 = Object.defineProperty;
	var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField$2 = (obj, key, value) => {
	  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class CachedEntityLoader {
	  constructor({ catalog, cache }) {
	    __publicField$2(this, "catalog");
	    __publicField$2(this, "cache");
	    __publicField$2(this, "readTimeout", 1e3);
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
	    const key = ["catalog", catalogModel.stringifyEntityRef(entityName)];
	    if (token) {
	      key.push(token);
	    }
	    return key.join(":");
	  }
	}

	var __defProp$1 = Object.defineProperty;
	var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField$1 = (obj, key, value) => {
	  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class DefaultDocsBuildStrategy {
	  constructor(config) {
	    __publicField$1(this, "config");
	    this.config = config;
	  }
	  static fromConfig(config) {
	    return new DefaultDocsBuildStrategy(config);
	  }
	  async shouldBuild(_) {
	    return this.config.getString("techdocs.builder") === "local";
	  }
	}

	function isOutOfTheBoxOption(opt) {
	  return opt.preparers !== void 0;
	}
	async function createRouter(options) {
	  var _a, _b;
	  const router = router__default.default();
	  const { publisher, config, logger, discovery } = options;
	  const { auth, httpAuth } = backendCommon.createLegacyAuthAdapters(options);
	  const catalogClient$1 = (_a = options.catalogClient) != null ? _a : new catalogClient.CatalogClient({ discoveryApi: discovery });
	  const docsBuildStrategy = (_b = options.docsBuildStrategy) != null ? _b : DefaultDocsBuildStrategy.fromConfig(config);
	  const buildLogTransport = options.buildLogTransport;
	  const entityLoader = new CachedEntityLoader({
	    catalog: catalogClient$1,
	    cache: options.cache.getClient()
	  });
	  let cache;
	  const defaultTtl = config.getOptionalNumber("techdocs.cache.ttl");
	  if (defaultTtl) {
	    const cacheClient = options.cache.getClient({ defaultTtl });
	    cache = TechDocsCache.fromConfig(config, { cache: cacheClient, logger });
	  }
	  const scmIntegrations = integration.ScmIntegrations.fromConfig(config);
	  const docsSynchronizer = new DocsSynchronizer({
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
	      const locationMetadata = pluginTechdocsNode.getLocationForEntity(entity, scmIntegrations);
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
	    var _a2;
	    const { kind, namespace, name } = req.params;
	    const credentials = await httpAuth.credentials(req);
	    const { token } = await auth.getPluginRequestToken({
	      onBehalfOf: credentials,
	      targetPluginId: "catalog"
	    });
	    const entity = await entityLoader.load({ kind, namespace, name }, token);
	    if (!((_a2 = entity == null ? void 0 : entity.metadata) == null ? void 0 : _a2.uid)) {
	      throw new errors.NotFoundError("Entity metadata UID missing");
	    }
	    const responseHandler = createEventStream(res);
	    const shouldBuild = await docsBuildStrategy.shouldBuild({ entity });
	    if (!shouldBuild) {
	      if (cache) {
	        await docsSynchronizer.doCacheSync({
	          responseHandler,
	          discovery,
	          token,
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
	    router.use(createCacheMiddleware({ logger, cache }));
	  }
	  router.use("/static/docs", publisher.docsRouter());
	  router.get("/cookie", async (_, res) => {
	    const { expiresAt } = await httpAuth.issueUserCookie(res);
	    res.json({ expiresAt: expiresAt.toISOString() });
	  });
	  return router;
	}
	function createEventStream(res) {
	  var _a;
	  res.writeHead(200, {
	    Connection: "keep-alive",
	    "Cache-Control": "no-cache",
	    "Content-Type": "text/event-stream"
	  });
	  (_a = res.socket) == null ? void 0 : _a.on("close", () => {
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

	var __defProp = Object.defineProperty;
	var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
	var __publicField = (obj, key, value) => {
	  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
	  return value;
	};
	class DefaultTechDocsCollator {
	  constructor(legacyPathCasing, options) {
	    this.legacyPathCasing = legacyPathCasing;
	    this.options = options;
	    __publicField(this, "type", "techdocs");
	    __publicField(this, "visibilityPermission", alpha.catalogEntityReadPermission);
	  }
	  static fromConfig(config, options) {
	    const legacyPathCasing = config.getOptionalBoolean(
	      "techdocs.legacyUseCaseSensitiveTripletPaths"
	    ) || false;
	    return new DefaultTechDocsCollator(legacyPathCasing, options);
	  }
	  async execute() {
	    const {
	      parallelismLimit,
	      discovery,
	      tokenManager,
	      catalogClient: catalogClient$1,
	      locationTemplate,
	      logger
	    } = this.options;
	    const limit = pLimit__default.default(parallelismLimit != null ? parallelismLimit : 10);
	    const techDocsBaseUrl = await discovery.getBaseUrl("techdocs");
	    const { token } = await tokenManager.getToken();
	    const entities = await (catalogClient$1 != null ? catalogClient$1 : new catalogClient.CatalogClient({ discoveryApi: discovery })).getEntities(
	      {
	        filter: {
	          "metadata.annotations.backstage.io/techdocs-ref": catalogClient.CATALOG_FILTER_EXISTS
	        },
	        fields: [
	          "kind",
	          "namespace",
	          "metadata.annotations",
	          "metadata.name",
	          "metadata.title",
	          "metadata.namespace",
	          "spec.type",
	          "spec.lifecycle",
	          "relations"
	        ]
	      },
	      { token }
	    );
	    const docPromises = entities.items.map(
	      (entity) => limit(async () => {
	        var _a;
	        const entityInfo = DefaultTechDocsCollator.handleEntityInfoCasing(
	          (_a = this.legacyPathCasing) != null ? _a : false,
	          {
	            kind: entity.kind,
	            namespace: entity.metadata.namespace || "default",
	            name: entity.metadata.name
	          }
	        );
	        try {
	          const { token: newToken } = await tokenManager.getToken();
	          const searchIndexResponse = await fetch__default.default(
	            DefaultTechDocsCollator.constructDocsIndexUrl(
	              techDocsBaseUrl,
	              entityInfo
	            ),
	            {
	              headers: {
	                Authorization: `Bearer ${newToken}`
	              }
	            }
	          );
	          const searchIndex = await searchIndexResponse.json();
	          return searchIndex.docs.map((doc) => {
	            var _a2, _b, _c;
	            return {
	              title: unescape__default.default(doc.title),
	              text: unescape__default.default(doc.text || ""),
	              location: this.applyArgsToFormat(
	                locationTemplate || "/docs/:namespace/:kind/:name/:path",
	                {
	                  ...entityInfo,
	                  path: doc.location
	                }
	              ),
	              path: doc.location,
	              ...entityInfo,
	              entityTitle: entity.metadata.title,
	              componentType: ((_b = (_a2 = entity.spec) == null ? void 0 : _a2.type) == null ? void 0 : _b.toString()) || "other",
	              lifecycle: ((_c = entity.spec) == null ? void 0 : _c.lifecycle) || "",
	              owner: getSimpleEntityOwnerString(entity),
	              authorization: {
	                resourceRef: catalogModel.stringifyEntityRef(entity)
	              }
	            };
	          });
	        } catch (e) {
	          logger.debug(
	            `Failed to retrieve tech docs search index for entity ${entityInfo.namespace}/${entityInfo.kind}/${entityInfo.name}`,
	            e
	          );
	          return [];
	        }
	      })
	    );
	    return (await Promise.all(docPromises)).flat();
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
	    const owner = entity.relations.find((r) => r.type === catalogModel.RELATION_OWNED_BY);
	    if (owner) {
	      const { name } = catalogModel.parseEntityRef(owner.targetRef);
	      return name;
	    }
	  }
	  return "";
	}

	const DefaultTechDocsCollatorFactory = pluginSearchBackendModuleTechdocs.DefaultTechDocsCollatorFactory;

	exports.DefaultTechDocsCollator = DefaultTechDocsCollator;
	exports.DefaultTechDocsCollatorFactory = DefaultTechDocsCollatorFactory;
	exports.createRouter = createRouter;
	Object.keys(pluginTechdocsNode).forEach(function (k) {
	  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
	    enumerable: true,
	    get: function () { return pluginTechdocsNode[k]; }
	  });
	});
	
} (index_cjs$1));

Object.defineProperty(alpha_cjs$1, '__esModule', { value: true });

var backendCommon$1 = require$$0;
var backendPluginApi$1 = require$$1;
var pluginTechdocsNode = index_cjs$2;
var Docker = require$$3$2;
var pluginTechdocsBackend = index_cjs$1;

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var Docker__default = /*#__PURE__*/_interopDefaultCompat(Docker);

const techdocsPlugin = backendPluginApi$1.createBackendPlugin({
  pluginId: "techdocs",
  register(env) {
    let docsBuildStrategy;
    env.registerExtensionPoint(pluginTechdocsNode.techdocsBuildsExtensionPoint, {
      setBuildStrategy(buildStrategy) {
        if (docsBuildStrategy) {
          throw new Error("DocsBuildStrategy may only be set once");
        }
        docsBuildStrategy = buildStrategy;
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
    env.registerInit({
      deps: {
        config: backendPluginApi$1.coreServices.rootConfig,
        logger: backendPluginApi$1.coreServices.logger,
        urlReader: backendPluginApi$1.coreServices.urlReader,
        http: backendPluginApi$1.coreServices.httpRouter,
        discovery: backendPluginApi$1.coreServices.discovery,
        cache: backendPluginApi$1.coreServices.cache,
        httpAuth: backendPluginApi$1.coreServices.httpAuth,
        auth: backendPluginApi$1.coreServices.auth
      },
      async init({
        config,
        logger,
        urlReader,
        http,
        discovery,
        cache,
        httpAuth,
        auth
      }) {
        const winstonLogger = backendCommon$1.loggerToWinstonLogger(logger);
        const preparers = await pluginTechdocsNode.Preparers.fromConfig(config, {
          reader: urlReader,
          logger: winstonLogger
        });
        const dockerClient = new Docker__default.default();
        const containerRunner = new backendCommon$1.DockerContainerRunner({ dockerClient });
        const generators = await pluginTechdocsNode.Generators.fromConfig(config, {
          logger: winstonLogger,
          containerRunner,
          customGenerator: customTechdocsGenerator
        });
        const publisher = await pluginTechdocsNode.Publisher.fromConfig(config, {
          logger: winstonLogger,
          discovery
        });
        await publisher.getReadiness();
        const cacheManager = backendCommon$1.cacheToPluginCacheManager(cache);
        http.use(
          await pluginTechdocsBackend.createRouter({
            logger: winstonLogger,
            cache: cacheManager,
            docsBuildStrategy,
            preparers,
            generators,
            publisher,
            config,
            discovery,
            httpAuth,
            auth
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

var _default$1 = alpha_cjs$1.default = techdocsPlugin;

var alpha_cjs = {};

Object.defineProperty(alpha_cjs, '__esModule', { value: true });

var backendCommon = require$$0;
var backendPluginApi = require$$1;
var backendTasks = require$$2$1;
var alpha$1 = require$$3$3;
var pluginSearchBackendModuleTechdocs = index_cjs;
var alpha$2 = require$$5$3;

const techdocsCollatorEntityTransformerExtensionPoint = backendPluginApi.createExtensionPoint({
  id: "search.techdocsCollator.transformer"
});
var alpha = backendPluginApi.createBackendModule({
  pluginId: "search",
  moduleId: "techdocs-collator",
  register(env) {
    let transformer;
    env.registerExtensionPoint(
      techdocsCollatorEntityTransformerExtensionPoint,
      {
        setTransformer(newTransformer) {
          if (transformer) {
            throw new Error(
              "TechDocs collator entity transformer may only be set once"
            );
          }
          transformer = newTransformer;
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
        tokenManager: backendPluginApi.coreServices.tokenManager,
        scheduler: backendPluginApi.coreServices.scheduler,
        catalog: alpha$1.catalogServiceRef,
        indexRegistry: alpha$2.searchIndexRegistryExtensionPoint
      },
      async init({
        config,
        logger,
        auth,
        httpAuth,
        discovery,
        tokenManager,
        scheduler,
        catalog,
        indexRegistry
      }) {
        const defaultSchedule = {
          frequency: { minutes: 10 },
          timeout: { minutes: 15 },
          initialDelay: { seconds: 3 }
        };
        const schedule = config.has("search.collators.techdocs.schedule") ? backendTasks.readTaskScheduleDefinitionFromConfig(
          config.getConfig("search.collators.techdocs.schedule")
        ) : defaultSchedule;
        indexRegistry.addCollator({
          schedule: scheduler.createScheduledTaskRunner(schedule),
          factory: pluginSearchBackendModuleTechdocs.DefaultTechDocsCollatorFactory.fromConfig(config, {
            discovery,
            tokenManager,
            auth,
            httpAuth,
            logger: backendCommon.loggerToWinstonLogger(logger),
            catalogClient: catalog,
            entityTransformer: transformer
          })
        });
      }
    });
  }
});

var _default = alpha_cjs.default = alpha;
alpha_cjs.techdocsCollatorEntityTransformerExtensionPoint = techdocsCollatorEntityTransformerExtensionPoint;

const dynamicPluginInstaller = {
  kind: "new",
  install: () => [_default$1(), _default()]
};

exports.dynamicPluginInstaller = dynamicPluginInstaller;
//# sourceMappingURL=index.cjs.js.map
