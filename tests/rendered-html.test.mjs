import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

test("builds the Taboo app shell and production metadata", async () => {
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /<html[^>]*lang="it"/i);
  assert.match(html, /<title>Taboo — Parla senza dire troppo<\/title>/i);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /favicon\.svg/);
  assert.match(html, /favicon-96x96\.png/);
  assert.match(html, /favicon\.ico/);
  assert.match(html, /apple-touch-icon\.png/);
  assert.match(html, /Sto preparando le carte/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships an installable offline manifest and service worker", async () => {
  const [manifestSource, serviceWorker] = await Promise.all([
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait-primary");
  assert.equal(manifest.lang, "it");
  assert.ok(manifest.icons.some((icon) => icon.purpose === "maskable"));
  assert.match(serviceWorker, /__BUILD_VERSION__/);
  assert.match(serviceWorker, /SKIP_WAITING/);
  assert.match(serviceWorker, /event\.request\.mode === "navigate"/);
});

test("ships an opaque, safe-area maskable icon", async () => {
  const { width, height, hasAlpha } = await sharp(
    fileURLToPath(new URL("../public/icon-maskable-512.png", import.meta.url)),
  ).metadata();

  assert.equal(width, 512);
  assert.equal(height, 512);
  assert.equal(hasAlpha, false);
});
