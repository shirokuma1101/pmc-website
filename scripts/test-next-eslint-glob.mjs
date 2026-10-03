import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { ESLint } from "eslint";

const require = createRequire(import.meta.url);
const nextPluginPath = require.resolve("@next/eslint-plugin-next");
const pluginRequire = createRequire(nextPluginPath);
const { getRootDirs } = pluginRequire("./utils/get-root-dirs.js");
const nextPlugin = require("@next/eslint-plugin-next");

test("the lockfile excludes vulnerable glob code and has only the supported caller", () => {
  const { packages } = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const names = Object.keys(packages);
  assert.equal(names.some((name) => /\/node_modules\/(braces|micromatch)$/.test(`/${name}`)), false);
  assert.equal(packages["node_modules/fast-glob"].resolved, "tools/next-eslint-glob");
  const callers = Object.entries(packages).filter(([, entry]) => entry.dependencies?.["fast-glob"]).map(([name]) => name);
  assert.deepEqual(callers, ["node_modules/@next/eslint-plugin-next"]);
});

test("Next.js root discovery preserves exact directories, globs and arrays", () => {
  const root = mkdtempSync(path.join(tmpdir(), "pmc-eslint-glob-"));
  const alpha = path.join(root, "apps", "alpha");
  const beta = path.join(root, "apps", "beta");
  try {
    mkdirSync(path.join(alpha, "pages"), { recursive: true });
    mkdirSync(beta, { recursive: true });
    writeFileSync(path.join(root, "apps", "file.txt"), "not a directory");
    const discover = (rootDir) => getRootDirs({ cwd: root, settings: { next: { rootDir } } }).map((directory) => path.resolve(directory)).sort();
    assert.deepEqual(discover(undefined), [root]);
    assert.deepEqual(discover(alpha), [alpha]);
    assert.deepEqual(discover(path.join(root, "apps", "*")), [alpha, beta]);
    assert.deepEqual(discover(path.join(root, "apps", "{alpha,beta}")), [alpha, beta]);
    assert.deepEqual(discover([alpha, beta, null]), [alpha, beta]);
    assert.deepEqual(discover(path.join(root, "missing")), []);
    assert.deepEqual(discover(alpha.replaceAll(path.sep, "\\")), [alpha]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Next.js still detects forbidden internal HTML links through root globs", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "pmc-eslint-rule-"));
  try {
    const pages = path.join(root, "apps", "site", "pages");
    mkdirSync(pages, { recursive: true });
    writeFileSync(path.join(pages, "about.js"), "export default function About() {}");
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: [{
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@next/next": nextPlugin },
        settings: { next: { rootDir: path.join(root, "apps", "*") } },
        rules: { "@next/next/no-html-link-for-pages": "error" },
      }],
    });
    const [result] = await eslint.lintText('const link = <a href="/about">About</a>;', { filePath: path.join(root, "page.js") });
    assert.equal(result.errorCount, 1);
    assert.equal(result.messages[0].ruleId, "@next/next/no-html-link-for-pages");
    const [external] = await eslint.lintText('const link = <a href="https://example.com">External</a>;', { filePath: path.join(root, "page.js") });
    assert.equal(external.errorCount, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the plugin resolves to the local adapter and preserves lint rules", async () => {
  assert.equal(pluginRequire("fast-glob"), require("../tools/next-eslint-glob/index.cjs"));
  const eslint = new ESLint();
  const config = await eslint.calculateConfigForFile("src/app/page.tsx");
  assert.equal(config.rules["@next/next/no-html-link-for-pages"][0], 2);
  assert.equal(config.rules["react-hooks/rules-of-hooks"][0], 2);
  assert.equal(config.rules["@typescript-eslint/no-unused-vars"][0], 1);
});
