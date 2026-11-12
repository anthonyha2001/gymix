import { createAdminClient } from "@/lib/supabase/admin";
import { deviceBySerial, openFirst, text } from "@/lib/access/server";
import { localToDate, utcOffsetHours } from "@/lib/access/time";
import {
  commandLine,
  deviceInfo,
  direction,
  handshake,
  parseAttLog,
  parseCommandResults,
  parseOperLog,
  verifyMethod,
} from "@/lib/access/zkteco";

// ZKTeco push protocol endpoint (the device's "cloud server" setting points
// here): /iclock/cdata, /iclock/getrequest, /iclock/devicecmd, with or
// without ".aspx". See lib/access/zkteco.ts.

type Ctx = { params: Promise<{ path: string[] }> };

const endpoint = (path: string[]) => (path[0] ?? "").toLowerCase().replace(/\.aspx$/, "");

export async function GET(request: Request, { params }: Ctx) {
  const url = new URL(request.url);
  const serial = url.searchParams.get("SN") ?? "";
  const kind = endpoint((await params).path);
  const db = createAdminClient();

  // Asked every 2 seconds by every terminal, so it costs one database call:
  // note the device and take its commands (nothing if unknown or paused).
  if (kind === "getrequest") {
    if (!serial) return text("OK");
    const info = deviceInfo(url.searchParams.get("INFO"));
    const { data: commands } = await db.rpc("access_zk_poll", { p_serial: serial, p_info: info ?? undefined });
    if (!commands?.length) return text("OK");
    const lines: string[] = [];
    // A door opening goes first, before any member updates.
    for (const cmd of [...commands].sort(openFirst)) {
      const line = commandLine({ id: cmd.id, kind: cmd.kind, payload: cmd.payload as Record<string, unknown> });
      if (line) lines.push(line);
      else await db.rpc("access_command_done", { p_device_id: cmd.device_id, p_command_id: cmd.id, p_ok: false, p_result: "Not something a ZKTeco terminal does" });
    }
    return text(lines.length ? lines.join("\n") + "\n" : "OK");
  }

  const device = serial ? await deviceBySerial(serial) : null;
  // Unknown or switched-off devices get a plain answer and nothing else.
  if (!device || !device.is_active) return text("OK");
  const tz = device.gyms?.timezone ?? "Asia/Beirut";

  switch (kind) {
    case "cdata":
      await db.rpc("access_device_seen", { p_device_id: device.id, p_info: { pushver: url.searchParams.get("pushver"), protocol: "push" } });
      return text(handshake(serial, utcOffsetHours(tz)));
    case "ping":
      await db.rpc("access_device_seen", { p_device_id: device.id });
      return text("OK");
    default:
      return text("OK");
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const url = new URL(request.url);
  const serial = url.searchParams.get("SN") ?? "";
  const device = serial ? await deviceBySerial(serial) : null;
  const body = await request.text();
  if (!device || !device.is_active) return text("OK");
  const db = createAdminClient();
  const tz = device.gyms?.timezone ?? "Asia/Beirut";

  switch (endpoint((await params).path)) {
    case "cdata": {
      const table = (url.searchParams.get("table") ?? "").toUpperCase();
      if (table === "ATTLOG") {
        const logs = parseAttLog(body);
        for (const log of logs) {
          const at = localToDate(log.time, tz);
          if (!at) continue;
          await db.rpc("access_ingest_event", {
            p_device_id: device.id,
            p_pin: log.pin,
            p_at: at.toISOString(),
            p_direction: direction(device.direction, log.status),
            // Terminals only log people they let through.
            p_granted: true,
            p_method: verifyMethod(log.verify),
            p_raw: { status: log.status, verify: log.verify, time: log.time },
          });
        }
        return text(`OK: ${logs.length}`);
      }
      if (table === "OPERLOG" || table === "BIODATA") {
        const records = parseOperLog(body);
        for (const r of records) {
          if (r.type === "user" && r.card) {
            await db.rpc("access_save_card", { p_device_id: device.id, p_pin: r.pin, p_card: r.card });
          } else if (r.type === "biometric") {
            await db.rpc("access_save_biometric", { p_device_id: device.id, p_pin: r.pin, p_kind: r.kind, p_slot: r.slot, p_fields: r.fields });
          }
        }
        return text(`OK: ${records.length}`);
      }
      // Photos and anything else: accepted, not kept.
      return text(`OK: ${body.split(/\r?\n/).filter(Boolean).length}`);
    }
    case "devicecmd": {
      for (const r of parseCommandResults(body)) {
        await db.rpc("access_command_done", {
          p_device_id: device.id,
          p_command_id: r.id,
          p_ok: r.code >= 0,
          p_result: r.code >= 0 ? undefined : `The device answered error ${r.code} to ${r.cmd || "a command"}`,
        });
      }
      return text("OK");
    }
    default:
      return text("OK");
  }
}
