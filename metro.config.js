const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// .jslib = third-party JS shipped as a raw asset (not bundled as source).
// Used for the OSMD build that gets inlined into the score WebView so the
// app renders scores offline instead of loading OSMD from a CDN.
config.resolver.assetExts.push("jslib");

module.exports = config;
