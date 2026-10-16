/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname, module */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Workspace packages use TypeScript's NodeNext-compatible .js specifiers.
// Metro needs the matching TypeScript source extension at bundle time.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    if (
      moduleName.startsWith(".") &&
      moduleName.endsWith(".js") &&
      typeof context.resolveRequest === "function"
    ) {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
