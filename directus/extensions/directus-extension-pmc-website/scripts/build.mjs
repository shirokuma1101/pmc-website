import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src/index.js");
const output = resolve(root, "dist/index.js");

await mkdir(dirname(output), { recursive: true });
await copyFile(source, output);
console.log("Built directus-extension-pmc-website.");
