const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(__dirname, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot]),
);
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...(config.resolver?.nodeModulesPaths ?? []),
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ]),
);

module.exports = config;
