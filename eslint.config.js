const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "server/*", "shared/*", "scripts/*", "supabase/functions/**", "e2e/**"],
  },
]);
