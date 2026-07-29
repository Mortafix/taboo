import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const publicRoot = resolve(import.meta.dirname, "../public");
await mkdir(publicRoot, { recursive: true });

const iconSvg = (size, maskable = false) => {
  const padding = maskable ? size * 0.18 : size * 0.08;
  const radius = maskable ? 0 : size * 0.2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ef5b5f"/>
          <stop offset="1" stop-color="#8f3440"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="${size * 0.03}" stdDeviation="${size * 0.035}" flood-opacity=".24"/></filter>
      </defs>
      <rect width="${size}" height="${size}" rx="${radius}" fill="#32181e"/>
      <rect x="${padding}" y="${padding}" width="${size - padding * 2}" height="${size - padding * 2}" rx="${size * 0.16}" fill="url(#bg)" filter="url(#shadow)"/>
      <circle cx="${size * 0.73}" cy="${size * 0.28}" r="${size * 0.08}" fill="#fff3cf" opacity=".9"/>
      <text x="50%" y="59%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="${size * 0.48}" fill="#fff3cf">T</text>
      <rect x="${size * 0.29}" y="${size * 0.73}" width="${size * 0.42}" height="${size * 0.055}" rx="${size * 0.028}" fill="#32181e" opacity=".72"/>
    </svg>`;
};

for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false],
]) {
  await sharp(Buffer.from(iconSvg(size, maskable))).png().toFile(resolve(publicRoot, name));
}

console.log("Icone PWA generate.");
