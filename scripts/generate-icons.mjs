import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const publicRoot = resolve(import.meta.dirname, "../public");
const sourceIcon = resolve(publicRoot, "favicon.svg");
await mkdir(publicRoot, { recursive: true });

const renderIcon = (name, size, options = {}) => {
  const contentSize = options.contentSize ?? size;
  let pipeline = sharp(sourceIcon, { density: 300 }).resize(contentSize, contentSize, {
    fit: "contain",
  });

  if (options.background) {
    const inset = (size - contentSize) / 2;
    pipeline = pipeline
      .extend({
        top: inset,
        bottom: inset,
        left: inset,
        right: inset,
        background: options.background,
      })
      .flatten({ background: options.background });
  }

  return pipeline.png().toFile(resolve(publicRoot, name));
};

await Promise.all([
  renderIcon("icon-192.png", 192),
  renderIcon("icon-512.png", 512),
  renderIcon("apple-touch-icon.png", 180, { background: "#ca5a59" }),
  renderIcon("icon-maskable-512.png", 512, {
    // Maskable icons need an opaque background and the artwork inside the
    // platform-safe central area.
    background: "#ca5a59",
    contentSize: 410,
  }),
]);

console.log("Icone PWA generate.");
