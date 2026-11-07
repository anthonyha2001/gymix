#!/usr/bin/env node
// Gymix Bridge: connects door devices on a gym's local network to Gymix.
//
//   * Hikvision: runs the requests Gymix plans (adding, updating and blocking
//     members), checks each device is online, points each device's event
//     notifications at this bridge and relays the events to Gymix over HTTPS.
//   * ZKTeco terminals that can't use HTTPS: set their cloud server to this
//     computer (port 8091) and the bridge relays their push traffic to Gymix.
//
// Needs Node 18 or newer, nothing else. Run it on a computer that stays on, on
// the same network as the devices:
//   GYMIX_URL=https://your-gymix-site GYMIX_BRIDGE_TOKEN=... node gymix-bridge.mjs
// Optional: BRIDGE_PORT (default 8091), BRIDGE_IP (this computer's address as
// the devices see it; found automatically).

import http from "node:http";
import os from "node:os";
import { createHash, randomBytes } from "node:crypto";

const VERSION = "1.0.0";
const GYMIX = (process.env.GYMIX_URL ?? "").replace(/\/+$/, "");
const TOKEN = process.env.GYMIX_BRIDGE_TOKEN ?? "";
const PORT = Number(process.env.BRIDGE_PORT ?? 8091);
const IP = process.env.BRIDGE_IP ?? lanAddress();

if (!/^https?:\/\//.test(GYMIX) || !/^[0-9a-f]{64}$/i.test(TOKEN)) {
  console.error("Set GYMIX_URL (your Gymix address) and GYMIX_BRIDGE_TOKEN (Gymix → Access → Gymix Bridge).");
  process.exit(1);
}

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === "IPv4" && !a.internal) return a.address;
  }
  return "127.0.0.1";
}

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- digest HTTP to devices
function digest(challenge, method, uri, user, pass) {
  const get = (k) => challenge.match(new RegExp(`${k}="?([^",]+)"?`, "i"))?.[1];
  const md5 = (s) => createHash("md5").update(s).digest("hex");
  const realm = get("realm") ?? "";
  const nonce = get("nonce") ?? "";
  const qop = (get("qop") ?? "").split(",").map((q) => q.trim()).includes("auth") ? "auth" : null;
  const opaque = get("opaque");
  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method}:${uri}`);
  const cnonce = randomBytes(8).toString("hex");
  const response = qop ? md5(`${ha1}:${nonce}:00000001:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
  return [
    `Digest username="${user}"`, `realm="${realm}"`, `nonce="${nonce}"`, `uri="${uri}"`,
    qop ? `qop=${qop}, nc=00000001, cnonce="${cnonce}"` : "", `response="${response}"`,
    opaque ? `opaque="${opaque}"` : "", "algorithm=MD5",
  ].filter(Boolean).join(", ");
}

async function deviceRequest(device, step, timeoutMs = 8000) {
  const url = device.host.replace(/\/+$/, "") + step.path;
  const body = step.json !== undefined ? JSON.stringify(step.json) : step.xml;
  const headers = {};
  if (step.json !== undefined) headers["Content-Type"] = "application/json";
  else if (step.xml !== undefined) headers["Content-Type"] = "application/xml";
  const send = (auth) => fetch(url, { method: step.method, body, headers: auth ? { ...headers, Authorization: auth } : headers, signal: AbortSignal.timeout(timeoutMs) });
  let res = await send();
  if (res.status === 401) {
    const challenge = res.headers.get("www-authenticate") ?? "";
    await res.arrayBuffer().catch(() => {});
    const u = new URL(url);
    res = /digest/i.test(challenge)
      ? await send(digest(challenge, step.method, u.pathname + u.search, device.username, device.password))
      : await send(`Basic ${Buffer.from(`${device.username}:${device.password}`).toString("base64")}`);
  }
  return { status: res.status, text: (await res.text()).slice(0, 4000) };
}

const failure = (r) => {
  if (r.status === 401) return "The device refused the username or password.";
  if (r.status === 404) return "This device doesn't support that request.";
  const status = r.text.match(/"statusString"\s*:\s*"([^"]+)"/)?.[1] ?? r.text.match(/<statusString>([^<]+)</)?.[1];
  const sub = r.text.match(/"subStatusCode"\s*:\s*"([^"]+)"/)?.[1] ?? r.text.match(/<subStatusCode>([^<]+)</)?.[1];
  return `Device answered ${r.status}${status ? `: ${status}` : ""}${sub ? ` (${sub})` : ""}`;
};

async function runSteps(device, steps) {
  for (const step of steps) {
    let last = null;
    for (const attempt of [step, ...(step.alt ?? [])]) {
      last = await deviceRequest(device, attempt);
      if (last.status >= 200 && last.status < 300) break;
    }
    if (!last || last.status < 200 || last.status >= 300) return last ? failure(last) : "No answer";
  }
  return null;
}

// ---------------------------------------------------------------- talking to Gymix
async function gymix(method, body) {
  const res = await fetch(`${GYMIX}/api/access/bridge`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "X-Bridge-Version": VERSION, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401) throw new Error("Gymix refused the bridge token. Copy it again from Gymix → Access.");
  if (!res.ok) throw new Error(`Gymix answered ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------- device checks and event setup
const devices = new Map(); // id → { ...device, checkedAt, configuredAt }

async function checkDevice(d) {
  const report = { id: d.id, online: false };
  try {
    const info = await deviceRequest(d, { method: "GET", path: "/ISAPI/System/deviceInfo" }, 6000);
    if (info.status === 401) return { ...report, online: true, error: "The device refused the username or password." };
    if (info.status < 200 || info.status >= 300) return { ...report, error: failure(info) };
    const tag = (t) => info.text.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1]?.trim() ?? null;
    report.online = true;
    report.info = { model: tag("model"), serial: tag("serialNumber"), firmware: tag("firmwareVersion"), via: "bridge" };
  } catch {
    return { ...report, error: `The bridge can't reach ${d.host}. Check the address and that the device is on.` };
  }
  // Point the device's event notifications at this bridge (once an hour).
  if (!d.configuredAt || Date.now() - d.configuredAt > 3600_000) {
    const xml =
      `<HttpHostNotification version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema"><id>1</id>` +
      `<url>/hik/${d.id}</url><protocolType>HTTP</protocolType><parameterFormatType>JSON</parameterFormatType>` +
      `<addressingFormatType>ipaddress</addressingFormatType><ipAddress>${IP}</ipAddress><portNo>${PORT}</portNo>` +
      `<httpAuthenticationMethod>none</httpAuthenticationMethod></HttpHostNotification>`;
    try {
      const r = await deviceRequest(d, { method: "PUT", path: "/ISAPI/Event/notification/httpHosts/1", xml });
      if (r.status >= 200 && r.status < 300) d.configuredAt = Date.now();
      else report.error = `Couldn't set the device to send events here: ${failure(r)}`;
    } catch {
      report.error = "Couldn't set the device to send events here.";
    }
  }
  return report;
}

// ---------------------------------------------------------------- local listener: events and ZKTeco relay
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  try {
    const hik = req.url.match(/^\/hik\/([0-9a-f-]{36})/);
    if (hik) {
      const d = devices.get(hik[1]);
      if (!d) { res.writeHead(404).end("Unknown device"); return; }
      const r = await fetch(d.event_url, { method: "POST", body, headers: { "Content-Type": req.headers["content-type"] ?? "application/json" }, signal: AbortSignal.timeout(15000) });
      res.writeHead(r.ok ? 200 : 502, { "Content-Type": "text/plain" }).end(r.ok ? "OK" : "Gymix error");
      return;
    }
    if (req.url.startsWith("/iclock/")) {
      const r = await fetch(GYMIX + req.url, { method: req.method, body: req.method === "POST" ? body : undefined, headers: { "Content-Type": req.headers["content-type"] ?? "text/plain" }, signal: AbortSignal.timeout(15000) });
      res.writeHead(r.status, { "Content-Type": "text/plain" }).end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain" }).end(`Gymix Bridge ${VERSION}`);
  } catch (e) {
    log("relay failed:", e.message);
    res.writeHead(502, { "Content-Type": "text/plain" }).end("Gymix unreachable");
  }
});
server.listen(PORT, () => log(`Gymix Bridge ${VERSION} listening on ${IP}:${PORT}, connected to ${GYMIX}`));

// ---------------------------------------------------------------- main loop
let failures = 0;
for (;;) {
  try {
    const work = await gymix("GET");
    failures = 0;
    for (const d of work.devices) devices.set(d.id, { ...devices.get(d.id), ...d });
    for (const id of [...devices.keys()]) if (!work.devices.some((d) => d.id === id)) devices.delete(id);

    const results = [];
    for (const cmd of work.commands) {
      const d = devices.get(cmd.device_id);
      let error = d ? null : "Device not found";
      if (d) {
        try {
          error = await runSteps(d, cmd.steps);
        } catch {
          error = `The bridge can't reach ${d.host}.`;
        }
      }
      results.push({ id: cmd.id, device_id: cmd.device_id, ok: !error, error });
      log(`${d?.name ?? cmd.device_id}: command ${cmd.id} ${error ? `failed: ${error}` : "done"}`);
    }

    const checks = [];
    for (const d of devices.values()) {
      if (!d.checkedAt || Date.now() - d.checkedAt > 60_000) {
        d.checkedAt = Date.now();
        checks.push(await checkDevice(d));
      }
    }
    if (results.length || checks.length) await gymix("POST", { results, devices: checks });
    await sleep((work.poll_seconds ?? 5) * 1000);
  } catch (e) {
    failures++;
    log(e.message);
    await sleep(Math.min(60, 5 * failures) * 1000);
  }
}
