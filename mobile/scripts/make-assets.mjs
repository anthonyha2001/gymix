// Draws the source images for the app icon and splash screen from the Gymix
// mark (same paths as web/src/components/logo-mark.tsx), then
// `npm run assets` turns them into every size iOS and Android need.
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = (f) => path.join(root, "assets", f);
const LIME = "#c8f135";
const INK = "#0d1117";
const PATHS = [
  ["M47.6 35.5 A27 23 0 1 0 69 58 H48", 16, "butt"],
  ["M60.8 29.1 A13 13 0 0 1 71.9 40.2", 8.5, "round"],
  ["M62.3 18.2 A24 24 0 0 1 82.8 38.7", 8.5, "round"],
];
const mark = (color) =>
  `<g transform="translate(3,-1.5)" fill="none" stroke="${color}" stroke-linejoin="round">${PATHS.map(([d, w, c]) => `<path d="${d}" stroke-width="${w}" stroke-linecap="${c}"/>`).join("")}</g>`;

// Mark centred in a square, at `scale` of its width, on `bg` (or transparent).
const square = (size, { bg, color, scale }) => {
  const s = scale;
  const off = (100 - 100 * s) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ""}<g transform="translate(${off},${off}) scale(${s})">${mark(color)}</g></svg>`,
  );
};

// Splash: ink background, the lime tile in the middle (like the website's opening screen).
const splash = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="${INK}"/><g transform="translate(410,410)"><rect width="180" height="180" rx="40" fill="${LIME}"/><g transform="translate(18,18) scale(1.44)">${mark(INK)}</g></g></svg>`,
  );

await sharp(square(1024, { bg: LIME, color: INK, scale: 0.78 })).png().toFile(out("icon-only.png"));
// Android adaptive icon: the mark on its own layer (the system crops to circles etc.).
await sharp(square(1024, { color: INK, scale: 0.5 })).png().toFile(out("icon-foreground.png"));
await sharp(square(1024, { bg: LIME, color: LIME, scale: 0 })).png().toFile(out("icon-background.png"));
await sharp(splash(2732)).png().toFile(out("splash.png"));
await sharp(splash(2732)).png().toFile(out("splash-dark.png"));
console.log("assets/ drawn");
