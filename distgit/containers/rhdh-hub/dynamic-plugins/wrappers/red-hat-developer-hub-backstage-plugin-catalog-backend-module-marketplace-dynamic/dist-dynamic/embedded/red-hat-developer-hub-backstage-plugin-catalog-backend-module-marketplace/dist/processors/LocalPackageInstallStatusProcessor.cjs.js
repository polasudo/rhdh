'use strict';

var fs = require('fs');
var path = require('path');
var semver = require('semver');
var backstagePluginMarketplaceCommon = require('@red-hat-developer-hub/backstage-plugin-marketplace-common');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var path__default = /*#__PURE__*/_interopDefaultCompat(path);
var semver__default = /*#__PURE__*/_interopDefaultCompat(semver);

class LocalPackageInstallStatusProcessor {
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
    return "LocalPackageInstallStatusProcessor";
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
          return backstagePluginMarketplaceCommon.MarketplacePackageInstallStatus.Installed;
        }
        const packagePath = path__default.default.resolve(nodeModulesPath, "package.json");
        const installedPackageJson = JSON.parse(
          fs__default.default.readFileSync(packagePath, "utf8")
        );
        const installedVersion = installedPackageJson.version;
        if (semver__default.default.satisfies(installedVersion, versionRange)) {
          return backstagePluginMarketplaceCommon.MarketplacePackageInstallStatus.Installed;
        }
        return backstagePluginMarketplaceCommon.MarketplacePackageInstallStatus.UpdateAvailable;
      }
      return null;
    } catch (error) {
      console.warn("xxx", error);
      return null;
    }
  }
  async preProcessEntity(entity) {
    if (backstagePluginMarketplaceCommon.isMarketplacePackage(entity)) {
      if (entity.spec?.packageName && !entity.spec.installStatus) {
        const packageName = entity.spec.packageName;
        const version = entity.spec.version;
        let installStatus = undefined;
        this.customPaths.forEach((customPaths) => {
          if (!installStatus) {
            const status = this.isPackageInstalled(
              packageName,
              customPaths,
              version
            );
            if (status) {
              installStatus = status;
            }
          }
        });
        if (!installStatus) {
          installStatus = backstagePluginMarketplaceCommon.MarketplacePackageInstallStatus.NotInstalled;
        }
        return {
          ...entity,
          spec: {
            ...entity.spec,
            installStatus
          }
        };
      }
    }
    return entity;
  }
}

exports.LocalPackageInstallStatusProcessor = LocalPackageInstallStatusProcessor;
//# sourceMappingURL=LocalPackageInstallStatusProcessor.cjs.js.map
