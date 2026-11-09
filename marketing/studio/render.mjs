// Renders a Gymix animated episode to MP4.
//   node render.mjs episodes/abou-bkra-ep1.html out/abou-bkra-ep1.mp4 [--fps 30] [--preview 4.2]
// An episode is an HTML page at 1080x1920 that defines:
//   window.DURATION      length in seconds
//   window.renderAt(t)   draws the frame at time t (seconds); must be deterministic
// The page is driven frame by frame (no real-time playback), captured by headless
// Chrome over the DevTools protocol, and encoded with the bundled ffmpeg (H.264,
// yuv420p, faststart: plays everywhere, including Instagram and TikTok).
// --preview T saves a single PNG of the frame at T seconds instead of a video.
// Carousels: node render.mjs carousels/x.html out/x --slides --size 1080x1350
//   The page sets window.SLIDES (count) and window.showSlide(i); each slide is
//   saved as out/x/01.png, 02.png…
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ffmpeg from "ffmpeg-static";
import { synthWav } from "./synth.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const [input, output] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!input || !output) {
  console.error("usage: node render.mjs <episode.html> <out.mp4|out.png> [--fps 30] [--preview seconds]");
  process.exit(1);
}
const FPS = Number(opt("fps", 30));
const PREVIEW = opt("preview", null);
const [W, H] = (opt("size", "1080x1920")).split("x").map(Number);
const SLIDES = args.includes("--slides");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(process.env.TEMP ?? "/tmp", "studio-"));
const chrome = spawn(
  CHROME,
  ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${W},${H}`, "about:blank"],
  { stdio: "ignore" },
);

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
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === "Runtime.exceptionThrown") console.error("page error:", msg.params.exceptionDetails.exception?.description);
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "eval failed");
  return r.result?.result?.value;
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: pathToFileURL(path.resolve(input)).href });
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    if ((await evaluate("document.readyState")) === "complete") break;
  }
  await evaluate("document.fonts.ready.then(() => true)");
  if (SLIDES) {
    const count = Number(await evaluate("window.SLIDES"));
    if (!count) throw new Error("A carousel must set window.SLIDES");
    fs.mkdirSync(output, { recursive: true });
    for (let i = 0; i < count; i++) {
      await evaluate(`(window.showSlide(${i}), new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
      const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
      fs.writeFileSync(path.join(output, `${String(i + 1).padStart(2, "0")}.png`), Buffer.from(r.result.data, "base64"));
    }
    console.log(`done ${output} (${count} slides, ${W}x${H})`);
    process.exitCode = 0;
  }
  const duration = SLIDES ? 0 : Number(await evaluate("window.DURATION"));
  if (!SLIDES && !duration) throw new Error("The episode must set window.DURATION");

  const shot = async (t) => {
    await evaluate(`(window.renderAt(${t}), new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))`);
    const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    return Buffer.from(r.result.data, "base64");
  };

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  if (SLIDES) {
    // done above
  } else if (PREVIEW !== null) {
    fs.writeFileSync(output, await shot(Number(PREVIEW)));
    console.log("preview", output);
  } else {
    const frames = Math.round(duration * FPS);
    // The episode's sound (window.AUDIO: a list of notes and effects) is synthesised to a WAV and muxed in.
    const audio = await evaluate("JSON.stringify(window.AUDIO ?? null)");
    const cues = JSON.parse(audio ?? "null");
    const wavPath = cues ? path.resolve(output).replace(/\.mp4$/i, ".wav") : null;
    if (cues) fs.writeFileSync(wavPath, synthWav(cues, duration));
    const encArgs = ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-"];
    if (wavPath) encArgs.push("-i", wavPath, "-c:a", "aac", "-b:a", "192k", "-shortest");
    encArgs.push("-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output);
    const enc = spawn(
      ffmpeg,
      encArgs,
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let log = "";
    enc.stderr.on("data", (d) => (log += d));
    for (let f = 0; f < frames; f++) {
      const png = await shot(f / FPS);
      if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once("drain", r));
      if (f % FPS === 0) process.stdout.write(`\r${Math.round((f / frames) * 100)}%`);
    }
    enc.stdin.end();
    const code = await new Promise((r) => enc.on("close", r));
    if (code !== 0) throw new Error(`ffmpeg failed:\n${log.slice(-1500)}`);
    if (wavPath) fs.rmSync(wavPath, { force: true });
    console.log(`\rdone ${output} (${frames} frames, ${duration}s @ ${FPS}fps${cues ? ", with sound" : ""})`);
  }
} finally {
  ws.close();
  chrome.kill();
}
