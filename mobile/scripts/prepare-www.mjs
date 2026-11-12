// The website address is one setting: GYMIX_APP_URL (default below). This
// script puts it everywhere the app needs it:
//   www/                 the start page and the offline screen
//   android              gradle.properties gymixHost (links that open the app)
//   ios                  Info.plist GymixHost + WKAppBoundDomains, App.entitlements applinks
// Run through `npm run sync` (or `npm run prepare`).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = (process.env.GYMIX_APP_URL ?? "https://gymix-seven.vercel.app").replace(/\/+$/, "");
if (!/^https:\/\/[^/\s]+$/.test(url)) {
  console.error(`GYMIX_APP_URL must be https://your-domain (got ${url})`);
  process.exit(1);
}
const host = new URL(url).host;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const at = (...p) => path.join(root, ...p);

fs.mkdirSync(at("www"), { recursive: true });
for (const f of fs.readdirSync(at("www-src"))) {
  fs.writeFileSync(at("www", f), fs.readFileSync(at("www-src", f), "utf8").replaceAll("__GYMIX_APP_URL__", url));
}

function edit(file, fn) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) fs.writeFileSync(file, after);
}

edit(at("android", "gradle.properties"), (s) =>
  /^gymixHost=.*$/m.test(s) ? s.replace(/^gymixHost=.*$/m, `gymixHost=${host}`) : `${s.trimEnd()}\n\n# The Gymix website host (set by npm run sync).\ngymixHost=${host}\n`,
);
edit(at("ios", "App", "App", "Info.plist"), (s) =>
  s
    .replace(/(<key>GymixHost<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${host}$2`)
    .replace(/(<key>WKAppBoundDomains<\/key>\s*<array>\s*<string>)[^<]*(<\/string>)/, `$1${host}$2`),
);
edit(at("ios", "App", "App", "App.entitlements"), (s) => s.replace(/applinks:[^<]*/, `applinks:${host}`));

console.log(`Gymix app set up for ${url}`);
