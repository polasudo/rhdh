'use strict';

var fs = require('fs');
var path = require('path');
var glob = require('glob');
var yaml = require('js-yaml');

function _interopDefaultCompat (e) { return e && typeof e === 'object' && 'default' in e ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefaultCompat(fs);
var path__default = /*#__PURE__*/_interopDefaultCompat(path);
var yaml__default = /*#__PURE__*/_interopDefaultCompat(yaml);

const findTopmostFolder = (folderName, startPath = process.cwd()) => {
  let currentPath = path__default.default.resolve(startPath);
  let topmostFoundPath = null;
  while (currentPath !== path__default.default.parse(currentPath).root) {
    const targetFolderPath2 = path__default.default.join(currentPath, folderName);
    if (fs__default.default.existsSync(targetFolderPath2) && fs__default.default.statSync(targetFolderPath2).isDirectory()) {
      topmostFoundPath = targetFolderPath2;
    }
    currentPath = path__default.default.dirname(currentPath);
  }
  const targetFolderPath = path__default.default.join(currentPath, folderName);
  if (fs__default.default.existsSync(targetFolderPath) && fs__default.default.statSync(targetFolderPath).isDirectory()) {
    topmostFoundPath = targetFolderPath;
  }
  if (!topmostFoundPath) {
    console.warn(`Folder "${folderName}" not found in any parent directory`);
  }
  return topmostFoundPath;
};
const readYamlFiles = (folderPath) => {
  const yamlFiles = glob.glob.sync(path__default.default.join(folderPath, "**/*.@(yaml|yml)"));
  const jsonFiles = [];
  yamlFiles.forEach((filePath) => {
    try {
      const fileContent = fs__default.default.readFileSync(filePath, "utf8");
      const jsonData = yaml__default.default.load(fileContent);
      jsonFiles.push({ filePath, content: jsonData });
    } catch (error) {
      console.error(`Error parsing YAML file: ${filePath}`, error);
    }
  });
  return jsonFiles;
};

exports.findTopmostFolder = findTopmostFolder;
exports.readYamlFiles = readYamlFiles;
//# sourceMappingURL=file-utils.cjs.js.map
