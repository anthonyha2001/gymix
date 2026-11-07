// The ZKTeco "push" protocol (ADMS / iclock), spoken by ZKTeco terminals with
// a cloud server setting. The device calls us; we never call it:
//   GET  /iclock/cdata?SN=…            handshake: we answer with options
//   POST /iclock/cdata?SN=…&table=…    it uploads attendance (ATTLOG) and
//                                      operations (OPERLOG: users, cards,
//                                      fingerprints, faces) as text lines
//   GET  /iclock/getrequest?SN=…       it asks for work: we answer with
//                                      commands, one per line, or "OK"
//   POST /iclock/devicecmd?SN=…        it reports how each command went
// Fields within a line are separated by tabs.

export type ZkCommand = { id: number; kind: string; payload: Record<string, unknown> };

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/[\t\r\n]/g, " ")
    .trim()
    .slice(0, max);

// Options sent at the handshake. Realtime=1 makes the device upload each
// event as it happens; TransFlag asks for users, cards and biometric
// templates too, so they can be kept and shared between doors.
export function handshake(serial: string, offsetHours: number) {
  return [
    `GET OPTION FROM: ${serial}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=9999",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;12:00",
    "TransInterval=1",
    "TransFlag=TransData AttLog OpLog EnrollUser ChgUser EnrollFP ChgFP FACE",
    `TimeZone=${offsetHours}`,
    "Realtime=1",
    "Encrypt=None",
    "ServerVer=2.4.1",
  ].join("\n");
}

// "Key=Value\tKey=Value" → { Key: "Value", … } (values may contain "=").
export function fields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split("\t")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

const lines = (body: string) => body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

export type AttLog = { pin: string; time: string; status: number; verify: number };

// ATTLOG: "PIN\tYYYY-MM-DD HH:MM:SS\tStatus\tVerify\tWorkcode\t…"
export function parseAttLog(body: string): AttLog[] {
  const out: AttLog[] = [];
  for (const line of lines(body)) {
    const [pin, time, status, verify] = line.split("\t");
    if (!pin || !time) continue;
    out.push({ pin: pin.trim(), time: time.trim(), status: Number(status) || 0, verify: Number(verify) || 0 });
  }
  return out;
}

export type OperRecord =
  | { type: "user"; pin: string; card: string | null; name: string }
  | { type: "biometric"; kind: "FP" | "FACE" | "BIODATA"; pin: string; slot: string; fields: Record<string, string> }
  | { type: "other" };

// OPERLOG (and BIODATA uploads): "USER PIN=1\tName=…\tCard=…", "FP PIN=1\tFID=6\tTMP=…",
// "FACE PIN=1\tFID=0\tTMP=…", "BIODATA Pin=1\tNo=0\tIndex=0\tType=9\tTmp=…", "OPLOG …".
export function parseOperLog(body: string): OperRecord[] {
  return lines(body).map((line): OperRecord => {
    const space = line.indexOf(" ");
    const head = (space > 0 ? line.slice(0, space) : line).toUpperCase();
    const f = fields(space > 0 ? line.slice(space + 1) : "");
    const pin = f.PIN ?? f.Pin ?? f.pin ?? "";
    if (!/^\d{1,9}$/.test(pin)) return { type: "other" };
    if (head === "USER") {
      const card = (f.Card ?? "").replace(/^\[|\]$/g, "");
      return { type: "user", pin, name: f.Name ?? "", card: /^\d{1,20}$/.test(card) && !/^0+$/.test(card) ? card : null };
    }
    if (head === "FP" || head === "FACE" || head === "BIODATA") {
      const rest = { ...f };
      delete rest.PIN;
      delete rest.Pin;
      delete rest.pin;
      const slot = head === "BIODATA" ? `${f.Type ?? "0"}-${f.No ?? "0"}-${f.Index ?? "0"}` : (f.FID ?? "0");
      return { type: "biometric", kind: head, pin, slot, fields: rest };
    }
    return { type: "other" };
  });
}

// The device's command results: "ID=12&Return=0&CMD=DATA" per line.
export function parseCommandResults(body: string) {
  return lines(body)
    .map((line) => new URLSearchParams(line))
    .map((p) => ({ id: Number(p.get("ID")), code: Number(p.get("Return") ?? "0"), cmd: p.get("CMD") ?? "" }))
    .filter((r) => Number.isInteger(r.id) && r.id > 0);
}

// One queued command as a protocol line ("C:<id>:<command>"), or null if this
// kind isn't something a ZKTeco terminal does.
export function commandLine(cmd: ZkCommand): string | null {
  const p = cmd.payload;
  const pin = clean(p.pin, 9);
  switch (cmd.kind) {
    case "upsert_user": {
      const card = /^\d{1,20}$/.test(String(p.card ?? "")) ? String(p.card) : "";
      return `C:${cmd.id}:DATA UPDATE USERINFO PIN=${pin}\tName=${clean(p.name, 24)}\tPri=0\tPasswd=\tCard=${card}\tGrp=1\tTZ=0000000100000000\tVerify=0`;
    }
    case "revoke_user":
      // Removed from the device; Gymix keeps the templates and restores them on renewal.
      return `C:${cmd.id}:DATA DELETE USERINFO PIN=${pin}`;
    case "push_biometric": {
      const kind = String(p.kind);
      const f = (p.fields ?? {}) as Record<string, string>;
      const rest = Object.entries(f)
        .filter(([k]) => !["PIN", "Pin", "pin"].includes(k))
        .map(([k, v]) => `${k}=${clean(v, 20000)}`)
        .join("\t");
      if (kind === "FP") return `C:${cmd.id}:DATA UPDATE FINGERTMP PIN=${pin}\t${rest}`;
      if (kind === "FACE") return `C:${cmd.id}:DATA UPDATE FACE PIN=${pin}\t${rest}`;
      if (kind === "BIODATA") return `C:${cmd.id}:DATA UPDATE BIODATA Pin=${pin}\t${rest}`;
      return null;
    }
    case "sync_time":
      return `C:${cmd.id}:SET OPTION DateTime=${Math.floor(Date.now() / 1000)}`;
    case "reboot":
      return `C:${cmd.id}:REBOOT`;
    case "clear_users":
      return `C:${cmd.id}:CLEAR DATA`;
    default:
      return null;
  }
}

// How the person was identified (ZKTeco verify codes).
export function verifyMethod(code: number): "face" | "fingerprint" | "card" | "pin" | "palm" | "unknown" {
  if (code === 15) return "face";
  if (code === 1) return "fingerprint";
  if (code === 2 || code === 4) return "card";
  if (code === 0 || code === 3) return "pin";
  if (code === 25) return "palm";
  return "unknown";
}

// In or out: an exit reader is always "out"; a reader used both ways uses the
// punch state (1 check-out, 2 break-out, 5 overtime-out).
export function direction(deviceDirection: string, status: number): "in" | "out" {
  if (deviceDirection === "out") return "out";
  if (deviceDirection === "both" && [1, 2, 5].includes(status)) return "out";
  return "in";
}

// "Ver 8.0.4.2,2,0,1,192.168.1.201,10,7,12,11,111" (the INFO query value).
export function deviceInfo(info: string | null) {
  if (!info) return null;
  const [firmware, users, fingerprints, records, ip, , , faces] = info.split(",");
  return {
    firmware: firmware?.trim() || null,
    users: Number(users) || 0,
    fingerprints: Number(fingerprints) || 0,
    records: Number(records) || 0,
    ip: ip?.trim() || null,
    faces: Number(faces) || 0,
  };
}
