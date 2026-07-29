import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
const assetsRoot = resolve(distRoot, "assets");
const serviceWorkerPath = resolve(distRoot, "sw.js");

const assetFiles = (await readdir(assetsRoot))
  .filter((file) => !file.endsWith(".map"))
  .sort()
  .map((file) => `/assets/${file}`);
const version = createHash("sha256")
  .update(assetFiles.join("\n"))
  .digest("hex")
  .slice(0, 10);

const source = await readFile(serviceWorkerPath, "utf8");
const finalized = source
  .replace("__BUILD_VERSION__", version)
  .replace('"__VITE_ASSETS__"', assetFiles.map((file) => JSON.stringify(file)).join(",\n  "));

await writeFile(serviceWorkerPath, finalized);
console.log(`Service worker pronto: ${assetFiles.length} asset, cache ${version}.`);
