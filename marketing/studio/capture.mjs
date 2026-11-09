// Captures real Gymix screens from the live demo for marketing posts.
//   node capture.mjs [baseUrl]   (default http://localhost:3123)
// Starts a fresh demo (sample gym "Atlas Fitness"), then saves crisp (2x) PNGs to
// out/screens/: the owner overview, a refused check-in at the desk, and the
// member app home on a phone. Only the demo's sample data is ever captured.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3123";
const OUT = "out/screens";
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9900 + Math.floor(Math.random() * 90);
const profile = fs.mkdtempSync(path.join(process.env.TEMP ?? "/tmp", "capture-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });

let ws;
for (let i = 0; i < 60 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {}
  if (!ws) await sleep(200);
}
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const size = (width, height, mobile) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile });
const go = async (url) => {
  await send("Page.navigate", { url: BASE + url });
  for (let i = 0; i < 120; i++) { await sleep(250); if ((await evaluate("document.readyState")) === "complete") break; }
  await sleep(2500);
};
const click = (text) => evaluate(`(() => { const el = [...document.querySelectorAll('button, a')].find(e => e.offsetParent !== null && e.innerText.trim() === ${JSON.stringify(text)}); if (el) el.click(); return !!el; })()`);
const hideChrome = () => evaluate(`(() => { const s = document.createElement('style'); s.textContent = '[data-demo-guide], [data-install-prompt], nextjs-portal, [role=status].mb-5 { display: none !important }'; document.head.appendChild(s); document.querySelectorAll('style').forEach(st => { if (st.textContent.includes('gx-next-pulse')) st.remove(); }); return 1 })()`);
const shot = async (name, clip) => {
  const r = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.result.data, "base64"));
  console.log("saved", name);
};
const rect = (selector) => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null })()`);

try {
  await send("Page.enable");
  await send("Runtime.enable");
  // Start a demo (desktop).
  await size(1280, 900, false);
  await go("/demo");
  await click("Start the demo");
  for (let i = 0; i < 60; i++) { await sleep(500); if ((await evaluate("location.pathname")) === "/dashboard") break; }
  await sleep(3000);

  // 1 · Overview: the stat cards.
  await go("/dashboard");
  await hideChrome();
  await sleep(500);
  const stats = await evaluate(`(() => { const h = [...document.querySelectorAll('p, span, div')].find(e => e.innerText?.trim() === 'Active members'); let el = h; for (let i = 0; i < 6 && el; i++) { el = el.parentElement; if (el && el.getBoundingClientRect().width > 900) break; } const r = el.getBoundingClientRect(); return { x: r.x - 16, y: r.y - 16, width: r.width + 32, height: r.height + 32 }; })()`);
  await shot("overview-stats", stats);
  await shot("overview-full", { x: 0, y: 0, width: 1280, height: 800 });

  // 2 · A refused check-in at the desk (an expired member).
  await go("/dashboard/check-in");
  await hideChrome();
  // The live list already holds the demo's refused entry (an expired member).
  await sleep(800);
  const list = await evaluate(`(() => { const h = [...document.querySelectorAll('h2, p, span')].find(e => e.innerText?.trim() === 'Latest check-ins'); let el = h; while (el && el.getBoundingClientRect().height < 400) el = el.parentElement; const r = el.getBoundingClientRect(); return { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: Math.min(r.height, 720) + 12 }; })()`);
  await shot("checkin-list", list);

  // 3 · The member app on a phone.
  await go("/dashboard");
  await click("Member app");
  for (let i = 0; i < 40; i++) { await sleep(500); if ((await evaluate("location.pathname")) === "/portal") break; }
  await size(430, 932, true);
  await go("/portal");
  await hideChrome();
  await sleep(800);
  await shot("member-home", { x: 0, y: 0, width: 430, height: 800 });
} finally {
  ws.close();
  chrome.kill();
}
