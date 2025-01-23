'use strict';

var fs = require('fs');
var path = require('path');
var semver = require('semver');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var path__default = /*#__PURE__*/_interopDefaultCompat(path);
var semver__default = /*#__PURE__*/_interopDefaultCompat(semver);

class LocalPluginInstallStatusProcessor {
  workspacesPath = this.findWorkspacesPath();
  customPaths;
  /**
   *
   * @param paths - pass the workspaces to find the installed packages. Defaults to backstage default workspaces ['packages/app', 'packages/backend']
   */
  constructor(paths) {
    this.customPaths = paths ?? ["packages/app", "packages/backend"]?.map(
      (cpath) => `${this.workspacesPath}/${cpath}/package.json`
    );
  }
  getProcessorName() {
    return "LocalPluginInstallStatusProcessor";
  }
  findWorkspacesPath(startPath = process.cwd()) {
    let currentPath = path__default.default.resolve(startPath);
    while (currentPath !== path__default.default.parse(currentPath).root) {
      const packageJsonPath = path__default.default.join(currentPath, "package.json");
      if (fs__default.default.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs__default.default.readFileSync(packageJsonPath, "utf8")
        );
        if (packageJson.workspaces) {
          return currentPath;
        }
      }
      currentPath = path__default.default.dirname(currentPath);
    }
    return "";
  }
  isPackageInstalled(packageName, packageJsonPath, versionRange) {
    try {
      const absolutePackageJsonPath = path__default.default.resolve(packageJsonPath);
      if (!fs__default.default.existsSync(absolutePackageJsonPath)) {
        throw new Error(
          `package.json not found at: ${absolutePackageJsonPath}`
        );
      }
      const packageJson = JSON.parse(
        fs__default.default.readFileSync(absolutePackageJsonPath, "utf8")
      );
      const dependencies = packageJson.dependencies;
      const devDependencies = packageJson.devDependencies;
      const isInPackageJson = dependencies?.[packageName] || devDependencies?.[packageName];
      const nodeModulesPath = path__default.default.resolve(
        this.workspacesPath,
        "node_modules",
        packageName
      );
      const isInNodeModules = fs__default.default.existsSync(nodeModulesPath);
      const packageInstalled = Boolean(isInPackageJson && isInNodeModules);
      if (packageInstalled) {
        if (!versionRange) {
          return true;
        }
        const packagePath = path__default.default.resolve(nodeModulesPath, "package.json");
        const installedPackageJson = JSON.parse(
          fs__default.default.readFileSync(packagePath, "utf8")
        );
        const installedVersion = installedPackageJson.version;
        if (semver__default.default.satisfies(installedVersion, versionRange)) {
          return true;
        }
        return false;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  isJSON(str) {
    if (typeof str !== "string") {
      return false;
    }
    try {
      const parsed = JSON.parse(str);
      return typeof parsed === "object" && parsed !== null;
    } catch (e) {
      return false;
    }
  }
  async preProcessEntity(entity) {
    if (entity.apiVersion === backstagePluginMarketplaceCommon.MARKETPLACE_API_VERSION && entity.kind === backstagePluginMarketplaceCommon.MarketplaceKinds.plugin) {
      let installStatus = backstagePluginMarketplaceCommon.InstallStatus.NotInstalled;
      if (entity?.spec?.packages?.length) {
        const somePackagesInstalled = entity.spec.packages.some(
          (marketplacePackageOrString) => {
            const npmPackage = typeof marketplacePackageOrString === "string" ? {
              name: marketplacePackageOrString
            } : marketplacePackageOrString;
            const versions = npmPackage?.version?.split(",");
            return versions ? versions?.every(
              (version) => this.customPaths.some(
                (cpath) => this.isPackageInstalled(npmPackage?.name, cpath, version)
              )
            ) : this.customPaths.some(
              (cpath) => this.isPackageInstalled(npmPackage?.name, cpath)
            );
          }
        );
        installStatus = somePackagesInstalled ? backstagePluginMarketplaceCommon.InstallStatus.Installed : backstagePluginMarketplaceCommon.InstallStatus.NotInstalled;
      }
      return {
        ...entity,
        spec: {
          ...entity.spec,
          installStatus
        }
      };
    }
    return entity;
  }
}

exports.LocalPluginInstallStatusProcessor = LocalPluginInstallStatusProcessor;
//# sourceMappingURL=LocalPluginInstallStatusProcessor.cjs.js.map
