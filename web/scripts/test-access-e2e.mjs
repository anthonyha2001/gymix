// End-to-end test of door access against the running app (BASE, default
// http://localhost:3123) and the LOCAL database: a simulated ZKTeco terminal, a
// mock Hikvision device with digest auth (direct, and through the real Gymix
// Bridge in public/downloads). Needs the QA gym: run scripts/qa-seed.mjs first.
//   SERVICE_KEY=... node scripts/test-access-e2e.mjs
import http from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3123";
const db = createClient("http://127.0.0.1:54321", process.env.SERVICE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) failed++; };

const { data: gym } = await db.from("gyms").select("id, timezone").eq("name", "QA Iron House").single();
const { data: nour } = await db.from("members").select("id, access_pin, full_name").eq("gym_id", gym.id).eq("full_name", "Nour Khalil").single();
const { data: rami } = await db.from("members").select("id, access_pin").eq("gym_id", gym.id).eq("full_name", "Rami Haddad").single();
await db.from("access_devices").delete().eq("gym_id", gym.id);
await db.from("checkins").delete().eq("gym_id", gym.id);
await db.from("access_biometrics").delete().eq("gym_id", gym.id);
await db.from("members").update({ access_card: null }).eq("gym_id", gym.id);

// ---------------------------------------------------------------- ZKTeco
console.log("\n== ZKTeco push");
const { data: zk, error: zkErr } = await db.from("access_devices")
  .insert({ gym_id: gym.id, vendor: "zkteco", name: "QA main door", serial_number: "QAZK0001", connection: "push" }).select().single();
check(!zkErr, `device created ${zkErr?.message ?? ""}`);
const zkGet = async (path) => (await fetch(`${BASE}${path}`)).text();
const zkPost = async (path, body) => (await fetch(`${BASE}${path}`, { method: "POST", body, headers: { "Content-Type": "text/plain" } })).text();

const hs = await zkGet(`/iclock/cdata?SN=QAZK0001&options=all&pushver=2.4.1&language=69`);
check(hs.startsWith("GET OPTION FROM: QAZK0001") && hs.includes("Realtime=1") && hs.includes("TimeZone="), "handshake answered with options");
check((await zkGet(`/iclock/cdata.aspx?SN=QAZK0001&options=all`)).startsWith("GET OPTION FROM"), ".aspx path works too");
check((await zkGet(`/iclock/getrequest?SN=NOPE1234`)) === "OK", "unknown device just gets OK");

const req1 = await zkGet(`/iclock/getrequest?SN=QAZK0001&INFO=Ver%208.0.4.2,2,0,1,192.168.1.201,10,7,12,11,111`);
const line = req1.split("\n").find((l) => l.includes(`USERINFO PIN=${nour.access_pin}\t`));
check(Boolean(line) && line.includes("Name=Nour Khalil"), `active member sent to the terminal: ${JSON.stringify(line?.slice(0, 80))}`);
check(!req1.includes(`PIN=${rami.access_pin}\t`), "member without a membership not sent");
const cmdId = Number(line?.match(/^C:(\d+):/)?.[1]);
check((await zkGet(`/iclock/getrequest?SN=QAZK0001`)) === "OK", "nothing handed out twice");
check((await zkPost(`/iclock/devicecmd?SN=QAZK0001`, `ID=${cmdId}&Return=0&CMD=DATA\n`)) === "OK", "command result accepted");
const { data: c1 } = await db.from("access_commands").select("status").eq("id", cmdId).single();
check(c1.status === "done", "command marked done");
const { data: dev1 } = await db.from("access_devices").select("info, last_seen_at").eq("id", zk.id).single();
check(dev1.info?.firmware === "Ver 8.0.4.2" && dev1.last_seen_at, "device info and last seen saved");

// Enrolled a fingerprint and a card on the terminal.
const oper = `USER PIN=${nour.access_pin}\tName=Nour Khalil\tPri=0\tPasswd=\tCard=4455667\tGrp=1\tTZ=0000000100000000\nFP PIN=${nour.access_pin}\tFID=6\tSize=4\tValid=1\tTMP=QUJD\n`;
check((await zkPost(`/iclock/cdata?SN=QAZK0001&table=OPERLOG&Stamp=1`, oper)) === "OK: 2", "operation log accepted");
const { data: fp } = await db.from("access_biometrics").select("kind, slot").eq("member_id", nour.id);
check(fp?.length === 1 && fp[0].kind === "FP" && fp[0].slot === "6", "fingerprint template kept");
const { data: card } = await db.from("members").select("access_card").eq("id", nour.id).single();
check(card.access_card === "4455667", "card enrolled on the device saved to the member");
const req2 = await zkGet(`/iclock/getrequest?SN=QAZK0001`);
check(req2.includes(`Card=4455667`), "card change sent back as an update");

// Door punches: an entry 3 minutes ago, then an unknown PIN.
const local = new Intl.DateTimeFormat("sv-SE", { timeZone: gym.timezone, dateStyle: "short", timeStyle: "medium" }).format(new Date(Date.now() - 180000));
const att = `${nour.access_pin}\t${local}\t0\t15\t0\t0\n99999\t${local}\t0\t1\t0\t0\n`;
check((await zkPost(`/iclock/cdata?SN=QAZK0001&table=ATTLOG&Stamp=9`, att)) === "OK: 2", "attendance accepted");
const { data: ck } = await db.from("checkins").select("source, allowed, checked_in_at").eq("member_id", nour.id);
check(ck?.length === 1 && ck[0].source === "device" && ck[0].allowed, "entry became a check-in");
check(ck?.[0] && Math.abs(new Date(ck[0].checked_in_at).getTime() - (Date.now() - 180000)) < 5000, "check-in keeps the punch time (timezone converted)");
const { data: ev } = await db.from("access_events").select("outcome, method").eq("device_id", zk.id).order("id");
check(ev?.map((e) => e.outcome).join(",") === "checked_in,unknown_member" && ev[0].method === "face", `events recorded: ${ev?.map((e) => e.outcome)}`);
check((await zkPost(`/iclock/cdata?SN=QAZK0001&table=ATTLOG&Stamp=9`, att)) === "OK: 2", "resent attendance accepted");
const { count: evCount } = await db.from("access_events").select("id", { count: "exact", head: true }).eq("device_id", zk.id);
check(evCount === 2, "resent attendance not duplicated");

// ---------------------------------------------------------------- mock Hikvision device
const seen = [];
const REALM = "DS-K1T341";
const NONCE = "abc123nonce";
const hik = http.createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Digest ")) {
    res.writeHead(401, { "WWW-Authenticate": `Digest realm="${REALM}", qop="auth", nonce="${NONCE}", opaque="op"` }).end();
    return;
  }
  const f = Object.fromEntries([...auth.matchAll(/(\w+)="?([^",]+)"?/g)].map((m) => [m[1], m[2]]));
  const md5 = (s) => createHash("md5").update(s).digest("hex");
  const expected = md5(`${md5(`admin:${REALM}:Hik12345`)}:${NONCE}:${f.nc}:${f.cnonce}:auth:${md5(`${req.method}:${f.uri}`)}`);
  if (f.response !== expected) { res.writeHead(401).end(); return; }
  seen.push({ method: req.method, url: req.url, body });
  if (req.url.startsWith("/ISAPI/System/deviceInfo")) {
    res.writeHead(200, { "Content-Type": "application/xml" }).end("<DeviceInfo><deviceName>Gate</deviceName><model>DS-K1T341AM</model><serialNumber>DS-K1T341AM20230101</serialNumber><firmwareVersion>V3.2.30</firmwareVersion></DeviceInfo>");
    return;
  }
  // Older firmware: no SetUp, so Gymix must fall back to Record.
  if (req.url.includes("/UserInfo/SetUp")) { res.writeHead(404, { "Content-Type": "application/json" }).end('{"statusCode":4,"statusString":"Invalid Operation","subStatusCode":"notSupport"}'); return; }
  res.writeHead(200, { "Content-Type": "application/json" }).end('{"statusCode":1,"statusString":"OK"}');
});
await new Promise((r) => hik.listen(18080, "127.0.0.1", r));

console.log("\n== Hikvision direct");
const { data: hd, error: hdErr } = await db.from("access_devices")
  .insert({ gym_id: gym.id, vendor: "hikvision", name: "QA turnstile", connection: "direct", host: "http://127.0.0.1:18080", username: "admin" }).select().single();
check(!hdErr, `direct device created ${hdErr?.message ?? ""}`);
await db.from("access_device_secrets").insert({ device_id: hd.id, password: "Hik12345" });
// An event from the device: recorded, and the device is sent what's queued.
const event = { ipAddress: "192.168.1.64", dateTime: new Date(Date.now() - 60000).toISOString(), eventType: "AccessControllerEvent",
  AccessControllerEvent: { majorEventType: 5, subEventType: 75, employeeNoString: String(nour.access_pin), currentVerifyMode: "face", attendanceStatus: "checkOut", serialNo: 7 } };
const boundary = "MIME_boundary";
const multipart = `--${boundary}\r\nContent-Disposition: form-data; name="AccessControllerEvent"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(event)}\r\n--${boundary}--\r\n`;
const er = await fetch(`${BASE}/api/access/hikvision/${hd.event_token}`, { method: "POST", body: multipart, headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` } });
check(er.status === 200, "event endpoint answered");
check((await fetch(`${BASE}/api/access/hikvision/${"0".repeat(64)}`, { method: "POST", body: "{}" })).status === 404, "unknown token refused");
await sleep(4000);
const record = seen.find((s) => s.url.includes("/UserInfo/Record"));
const body = record ? JSON.parse(record.body) : null;
check(Boolean(record), "fell back from SetUp to Record (older firmware)");
check(body?.UserInfo?.employeeNo === String(nour.access_pin) && body.UserInfo.Valid.endTime.endsWith("T23:59:59"), `person sent with validity ending on the membership's last day: ${body?.UserInfo?.Valid?.endTime}`);
check(seen.some((s) => s.url.includes("/CardInfo/SetUp") && s.body.includes("4455667")), "card sent");
const { data: hcmds } = await db.from("access_commands").select("status").eq("device_id", hd.id);
check(hcmds?.length > 0 && hcmds.every((c) => c.status === "done"), `direct commands done (${hcmds?.map((c) => c.status)})`);
const { data: hdev } = await db.from("access_devices").select("info, last_error").eq("id", hd.id).single();
check(hdev.info?.model === "DS-K1T341AM" && !hdev.last_error, "device info read over digest auth");
const { data: hev } = await db.from("access_events").select("direction, outcome").eq("device_id", hd.id);
check(hev?.[0]?.direction === "in" && hev[0].outcome === "already_in", `entry device records "in" even for checkOut status: ${JSON.stringify(hev)}`);

// Revoke: freezing Nour blocks her on the device with a past validity period.
seen.length = 0;
const { data: ms } = await db.from("memberships").select("id").eq("member_id", nour.id).limit(1).single();
await db.from("memberships").update({ frozen_on: new Date().toISOString().slice(0, 10) }).eq("id", ms.id);
await fetch(`${BASE}/api/access/hikvision/${hd.event_token}`, { method: "POST", body: JSON.stringify({ eventType: "heartBeat" }), headers: { "Content-Type": "application/json" } });
// Heartbeats don't trigger a run; an event does.
await fetch(`${BASE}/api/access/hikvision/${hd.event_token}`, { method: "POST", body: JSON.stringify({ ...event, dateTime: new Date().toISOString(), AccessControllerEvent: { ...event.AccessControllerEvent, subEventType: 76 } }), headers: { "Content-Type": "application/json" } });
await sleep(4000);
const block = seen.find((s) => s.url.includes("/UserInfo/") && s.body.includes("2000-01-01T00:00:01"));
check(Boolean(block), "frozen member blocked with a validity period in the past (face kept)");
await db.from("memberships").update({ frozen_on: null }).eq("id", ms.id);

// ---------------------------------------------------------------- the real bridge
console.log("\n== Gymix Bridge");
await db.from("access_devices").update({ connection: "bridge" }).eq("id", hd.id);
await db.from("access_bridges").delete().eq("gym_id", gym.id);
const { data: br } = await db.from("access_bridges").insert({ gym_id: gym.id }).select().single();
check((await fetch(`${BASE}/api/access/bridge`, { headers: { Authorization: `Bearer ${"f".repeat(64)}` } })).status === 401, "bridge with a wrong token refused");
seen.length = 0;
const bridgeFile = process.env.BRIDGE_FILE ?? fileURLToPath(new URL("../public/downloads/gymix-bridge.mjs", import.meta.url));
const bridge = spawn(process.execPath, [bridgeFile], { env: { ...process.env, GYMIX_URL: BASE, GYMIX_BRIDGE_TOKEN: br.token, BRIDGE_PORT: "18091", BRIDGE_IP: "127.0.0.1" } });
let bridgeLog = "";
bridge.stdout.on("data", (d) => (bridgeLog += d));
bridge.stderr.on("data", (d) => (bridgeLog += d));
await sleep(9000);
check(seen.some((s) => s.url === "/ISAPI/Event/notification/httpHosts/1" && s.body.includes("<portNo>18091</portNo>") && s.body.includes(`/hik/${hd.id}`)), "bridge pointed the device's events at itself");
const { data: bdev } = await db.from("access_devices").select("last_seen_at, info").eq("id", hd.id).single();
check(bdev.info?.via === "bridge" && Date.now() - new Date(bdev.last_seen_at).getTime() < 15000, "bridge reported the device online");
const { data: brow } = await db.from("access_bridges").select("last_seen_at, version").eq("gym_id", gym.id).single();
check(brow.version === "1.0.0" && brow.last_seen_at, "bridge seen with its version");
// The device posts an event to the bridge, which relays it.
const relay = await fetch(`http://127.0.0.1:18091/hik/${hd.id}`, { method: "POST", body: JSON.stringify({ ...event, dateTime: new Date(Date.now() - 30000).toISOString(), AccessControllerEvent: { ...event.AccessControllerEvent, serialNo: 99 } }), headers: { "Content-Type": "application/json" } });
check(relay.status === 200, "bridge relayed a device event");
// A change while the bridge runs reaches the device within seconds.
seen.length = 0;
await db.rpc("resync_access_device", { p_device_id: hd.id }).then(() => {}, () => {});
await db.from("access_grants").delete().eq("device_id", hd.id);
await db.rpc("access_sync_device", { p_device_id: hd.id });
await sleep(8000);
const { data: bcmds } = await db.from("access_commands").select("status").eq("device_id", hd.id).in("status", ["queued", "sent"]);
check(bcmds?.length === 0 && seen.some((s) => s.url.includes("/UserInfo/")), "bridge ran the queued commands on the device");
// ZKTeco relay through the bridge (terminals without HTTPS).
const zr = await (await fetch(`http://127.0.0.1:18091/iclock/cdata?SN=QAZK0001&options=all`)).text();
check(zr.startsWith("GET OPTION FROM: QAZK0001"), "bridge relays ZKTeco push traffic");
bridge.kill();
hik.close();

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
if (failed) console.log("bridge log:\n" + bridgeLog.slice(-1500));
process.exit(failed ? 1 : 0);
