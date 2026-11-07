// Hikvision access control terminals (face terminals, turnstile readers) over
// ISAPI, their HTTP API with digest authentication.
//
// Gymix turns each queued command into a "plan": the HTTP requests to make,
// each with alternatives for older firmware. Plans run either here (devices
// reachable over the internet) or in the Gymix Bridge on the gym's network,
// which executes them as given, so device knowledge lives in one place.
//
// Expiry is enforced by the device itself: every person is stored with a
// validity period ending on their membership's last day. Blocking someone
// sets a period in the past, so their face stays enrolled for a renewal.

import { createHash, randomBytes } from "node:crypto";

export type HikStep = {
  method: "GET" | "PUT" | "POST";
  path: string;
  json?: unknown;
  xml?: string;
  // Tried in order if this request fails (e.g. firmware without SetUp).
  alt?: HikStep[];
};

const isoDay = (date: string, end: boolean) => `${date}T${end ? "23:59:59" : "00:00:00"}`;
const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\r\n\t"\\]/g, " ").trim().slice(0, max);

function userInfo(p: Record<string, unknown>, doorNo: number, begin: string, end: string) {
  return {
    UserInfo: {
      employeeNo: clean(p.pin, 32),
      name: clean(p.name, 32) || `Member ${clean(p.pin, 9)}`,
      userType: "normal",
      Valid: { enable: true, beginTime: begin, endTime: end, timeType: "local" },
      doorRight: String(doorNo),
      RightPlan: [{ doorNo, planTemplateNo: "1" }],
    },
  };
}

// The requests for one queued command.
export function planFor(kind: string, payload: Record<string, unknown>, doorNo = 1): HikStep[] {
  if (kind === "upsert_user") {
    const body = userInfo(payload, doorNo, isoDay(String(payload.valid_from), false), isoDay(String(payload.valid_until), true));
    const steps: HikStep[] = [
      {
        method: "PUT",
        path: "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
        json: body,
        alt: [
          { method: "POST", path: "/ISAPI/AccessControl/UserInfo/Record?format=json", json: body },
          { method: "PUT", path: "/ISAPI/AccessControl/UserInfo/Modify?format=json", json: body },
        ],
      },
    ];
    const card = String(payload.card ?? "");
    if (/^\d{1,20}$/.test(card)) {
      const cardBody = { CardInfo: { employeeNo: clean(payload.pin, 32), cardNo: card, cardType: "normalCard" } };
      steps.push({
        method: "PUT",
        path: "/ISAPI/AccessControl/CardInfo/SetUp?format=json",
        json: cardBody,
        alt: [
          { method: "POST", path: "/ISAPI/AccessControl/CardInfo/Record?format=json", json: cardBody },
          { method: "PUT", path: "/ISAPI/AccessControl/CardInfo/Modify?format=json", json: cardBody },
        ],
      });
    }
    return steps;
  }
  if (kind === "revoke_user") {
    // A validity period in the past: refused at the door, face kept.
    const body = userInfo(payload, doorNo, "2000-01-01T00:00:00", "2000-01-01T00:00:01");
    return [
      {
        method: "PUT",
        path: "/ISAPI/AccessControl/UserInfo/SetUp?format=json",
        json: body,
        alt: [{ method: "PUT", path: "/ISAPI/AccessControl/UserInfo/Modify?format=json", json: body }],
      },
    ];
  }
  if (kind === "sync_time") {
    return [{ method: "PUT", path: "/ISAPI/System/time", xml: `<Time><timeMode>NTP</timeMode></Time>` }];
  }
  if (kind === "reboot") return [{ method: "PUT", path: "/ISAPI/System/reboot" }];
  return [];
}

// ---------------------------------------------------------------- digest HTTP
export type HikTarget = { host: string; username: string; password: string };
export type HikResponse = { status: number; text: string };

function digestHeader(challenge: string, method: string, uri: string, user: string, pass: string, nc: number) {
  const get = (k: string) => challenge.match(new RegExp(`${k}="?([^",]+)"?`, "i"))?.[1];
  const realm = get("realm") ?? "";
  const nonce = get("nonce") ?? "";
  const qop = get("qop")?.split(",").map((q) => q.trim()).includes("auth") ? "auth" : undefined;
  const opaque = get("opaque");
  const md5 = (s: string) => createHash("md5").update(s).digest("hex");
  const ha1 = md5(`${user}:${realm}:${pass}`);
  const ha2 = md5(`${method}:${uri}`);
  const ncHex = nc.toString(16).padStart(8, "0");
  const cnonce = randomBytes(8).toString("hex");
  const response = qop ? md5(`${ha1}:${nonce}:${ncHex}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`);
  return [
    `Digest username="${user}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    qop ? `qop=${qop}, nc=${ncHex}, cnonce="${cnonce}"` : "",
    `response="${response}"`,
    opaque ? `opaque="${opaque}"` : "",
    `algorithm=MD5`,
  ]
    .filter(Boolean)
    .join(", ");
}

// One ISAPI request with digest authentication (and basic, which some
// older devices still use).
export async function hikRequest(target: HikTarget, step: Pick<HikStep, "method" | "path" | "json" | "xml">, timeoutMs = 8000): Promise<HikResponse> {
  const url = target.host.replace(/\/+$/, "") + step.path;
  const body = step.json !== undefined ? JSON.stringify(step.json) : step.xml;
  const headers: Record<string, string> = {};
  if (step.json !== undefined) headers["Content-Type"] = "application/json";
  else if (step.xml !== undefined) headers["Content-Type"] = "application/xml";
  const send = (auth?: string) =>
    fetch(url, { method: step.method, body, headers: auth ? { ...headers, Authorization: auth } : headers, signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });

  let res = await send();
  if (res.status === 401) {
    const challenge = res.headers.get("www-authenticate") ?? "";
    await res.arrayBuffer().catch(() => {});
    const uri = new URL(url).pathname + new URL(url).search;
    res = /digest/i.test(challenge)
      ? await send(digestHeader(challenge, step.method, uri, target.username, target.password, 1))
      : await send(`Basic ${Buffer.from(`${target.username}:${target.password}`).toString("base64")}`);
  }
  return { status: res.status, text: (await res.text()).slice(0, 4000) };
}

// What went wrong, in words an owner can act on.
export function failureText(r: HikResponse) {
  if (r.status === 401) return "The device refused the username or password.";
  if (r.status === 404) return "This device doesn't support that request (check the model and firmware).";
  const sub = r.text.match(/"subStatusCode"\s*:\s*"([^"]+)"/)?.[1] ?? r.text.match(/<subStatusCode>([^<]+)</)?.[1];
  const status = r.text.match(/"statusString"\s*:\s*"([^"]+)"/)?.[1] ?? r.text.match(/<statusString>([^<]+)</)?.[1];
  return `Device answered ${r.status}${status ? `: ${status}` : ""}${sub ? ` (${sub})` : ""}`;
}

// Runs a plan: each step, falling back to its alternatives. Returns the first
// failure, or null when every step succeeded.
export async function runPlan(target: HikTarget, steps: HikStep[]): Promise<string | null> {
  for (const step of steps) {
    let last: HikResponse | null = null;
    for (const attempt of [step, ...(step.alt ?? [])]) {
      last = await hikRequest(target, attempt);
      if (last.status >= 200 && last.status < 300) break;
    }
    if (!last || last.status < 200 || last.status >= 300) return last ? failureText(last) : "No answer";
  }
  return null;
}

// Model, serial and firmware from /ISAPI/System/deviceInfo (XML).
export function parseDeviceInfo(xml: string) {
  const tag = (t: string) => xml.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1]?.trim() || null;
  return { model: tag("model"), serial: tag("serialNumber"), firmware: tag("firmwareVersion"), name: tag("deviceName") };
}

// ---------------------------------------------------------------- events
export type HikEvent = {
  pin: string | null;
  card: string | null;
  at: Date;
  granted: boolean;
  out: boolean | null;
  method: "face" | "fingerprint" | "card" | "pin" | "qr" | "unknown";
  raw: Record<string, unknown>;
};

// Access-granted minor codes (major type 5): card, fingerprint, face,
// card+fingerprint/face combos, QR code and PIN passes.
const GRANTED = new Set([1, 4, 38, 39, 40, 41, 42, 75, 77, 78, 104, 105, 162, 163, 166]);

function methodOf(mode: unknown, sub: number): HikEvent["method"] {
  const m = String(mode ?? "").toLowerCase();
  if (m.includes("face")) return "face";
  if (m.includes("fp") || m.includes("finger")) return "fingerprint";
  if (m.includes("card")) return "card";
  if (m.includes("qr")) return "qr";
  if (m.includes("pw") || m.includes("password") || m.includes("employeeno")) return "pin";
  if (sub === 75) return "face";
  if (sub === 38) return "fingerprint";
  if (sub === 1) return "card";
  return "unknown";
}

// The JSON object out of a JSON body, a multipart body (the JSON part plus a
// picture) or an XML EventNotificationAlert.
function eventObject(body: string, contentType: string): Record<string, unknown> | null {
  const tryJson = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  if (contentType.includes("multipart/")) {
    const boundary = contentType.match(/boundary="?([^";]+)"?/)?.[1];
    if (boundary) {
      for (const part of body.split(`--${boundary}`)) {
        const split = part.indexOf("\r\n\r\n");
        const payload = split >= 0 ? part.slice(split + 4).trim() : part.trim();
        if (payload.startsWith("{")) {
          const obj = tryJson(payload);
          if (obj) return obj;
        }
      }
    }
  }
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) return tryJson(trimmed);
  if (trimmed.startsWith("<")) {
    const tag = (t: string) => trimmed.match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
    return {
      eventType: tag("eventType"),
      dateTime: tag("dateTime"),
      AccessControllerEvent: {
        majorEventType: Number(tag("majorEventType")),
        subEventType: Number(tag("subEventType")),
        employeeNoString: tag("employeeNoString") ?? tag("employeeNo"),
        cardNo: tag("cardNo"),
        currentVerifyMode: tag("currentVerifyMode"),
        attendanceStatus: tag("attendanceStatus"),
      },
    };
  }
  return null;
}

// A door event, or null for heartbeats and anything that isn't a person at the door.
export function parseEvent(body: string, contentType: string): HikEvent | null {
  const obj = eventObject(body, contentType);
  if (!obj || obj.eventType !== "AccessControllerEvent") return null;
  const ev = (obj.AccessControllerEvent ?? {}) as Record<string, unknown>;
  const major = Number(ev.majorEventType);
  const sub = Number(ev.subEventType);
  if (major !== 5) return null;
  const pin = String(ev.employeeNoString ?? ev.employeeNo ?? "").trim() || null;
  const card = String(ev.cardNo ?? "").trim() || null;
  if (!pin && !card) return null;
  const at = new Date(String(obj.dateTime ?? ""));
  const status = String(ev.attendanceStatus ?? "").toLowerCase();
  return {
    pin,
    card,
    at: Number.isNaN(at.getTime()) ? new Date() : at,
    granted: GRANTED.has(sub),
    out: status === "checkout" || status === "breakout" ? true : status === "checkin" || status === "breakin" ? false : null,
    method: methodOf(ev.currentVerifyMode, sub),
    raw: { major, sub, serialNo: ev.serialNo ?? null, verify: ev.currentVerifyMode ?? null, attendance: ev.attendanceStatus ?? null, ip: obj.ipAddress ?? null },
  };
}
