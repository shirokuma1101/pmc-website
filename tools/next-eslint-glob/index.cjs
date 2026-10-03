// eslint-disable-next-line @typescript-eslint/no-require-imports -- Next.js loads this synchronous adapter as CommonJS.
const { globSync: tinyGlobSync } = require("tinyglobby");

// @next/eslint-plugin-next uses only synchronous directory discovery. Keep
// fast-glob's exact-directory semantics instead of globby's recursive expansion.
function globSync(patterns, options = {}) {
  return tinyGlobSync(patterns, { ...options, expandDirectories: false });
}

module.exports = { globSync, sync: globSync };
