import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hikRequest, parseDeviceInfo, planFor, runPlan, type HikTarget } from "./hikvision";

// Server side of door access: looking devices up for the endpoints they call,
// and sending queued commands to Hikvision devices Gymix can reach directly.

export type DeviceRow = {
  id: string;
  gym_id: string;
  vendor: "zkteco" | "hikvision";
  name: string;
  direction: "in" | "out" | "both";
  connection: "push" | "direct" | "bridge";
  host: string | null;
  username: string;
  door_no: number;
  is_active: boolean;
  serial_number: string | null;
  event_token: string;
  gyms: { timezone: string } | null;
};

const DEVICE_COLUMNS = "id, gym_id, vendor, name, direction, connection, host, username, door_no, is_active, serial_number, event_token, gyms(timezone)";

export async function deviceBySerial(serial: string) {
  const { data } = await createAdminClient()
    .from("access_devices")
    .select(DEVICE_COLUMNS)
    .eq("serial_number", serial)
    .eq("vendor", "zkteco")
    .maybeSingle();
  return (data as DeviceRow | null) ?? null;
}

export async function deviceByToken(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await createAdminClient().from("access_devices").select(DEVICE_COLUMNS).eq("event_token", token).maybeSingle();
  return (data as DeviceRow | null) ?? null;
}

async function targetFor(device: DeviceRow): Promise<HikTarget | null> {
  if (!device.host) return null;
  const { data } = await createAdminClient().from("access_device_secrets").select("password").eq("device_id", device.id).maybeSingle();
  return { host: device.host, username: device.username, password: data?.password ?? "" };
}

// Sends what's queued for one directly reachable Hikvision device.
export async function runDirectDevice(device: DeviceRow) {
  const db = createAdminClient();
  const target = await targetFor(device);
  if (!target || !device.is_active) return { sent: 0, failed: 0, error: "No address" };

  // Is it there? (Also refreshes model and firmware.)
  try {
    const info = await hikRequest(target, { method: "GET", path: "/ISAPI/System/deviceInfo" }, 6000);
    if (info.status === 401) {
      await db.from("access_devices").update({ last_error: "The device refused the username or password." }).eq("id", device.id);
      return { sent: 0, failed: 0, error: "auth" };
    }
    if (info.status >= 200 && info.status < 300) {
      await db.rpc("access_device_seen", { p_device_id: device.id, p_info: parseDeviceInfo(info.text) });
    }
  } catch {
    await db.from("access_devices").update({ last_error: `Gymix can't reach ${device.host}. Check the address and port forwarding, or use the Gymix Bridge.` }).eq("id", device.id);
    return { sent: 0, failed: 0, error: "unreachable" };
  }

  let sent = 0;
  let failed = 0;
  for (let round = 0; round < 10; round++) {
    const { data: commands } = await db.rpc("access_take_commands", { p_device_id: device.id, p_limit: 25 });
    if (!commands?.length) break;
    for (const cmd of commands) {
      const steps = planFor(cmd.kind, cmd.payload as Record<string, unknown>, device.door_no);
      let error: string | null = steps.length ? null : "Not something this device does";
      if (steps.length) {
        try {
          error = await runPlan(target, steps);
        } catch {
          // Lost the connection: leave it "sent"; it is offered again shortly.
          await db.from("access_devices").update({ last_error: `Lost the connection to ${device.host}.` }).eq("id", device.id);
          return { sent, failed, error: "unreachable" };
        }
      }
      await db.rpc("access_command_done", { p_device_id: device.id, p_command_id: cmd.id, p_ok: !error, p_result: error ?? undefined });
      if (error) failed++;
      else sent++;
    }
  }
  if (!failed) await db.from("access_devices").update({ last_error: null }).eq("id", device.id);
  return { sent, failed, error: null };
}

// Runs every directly reachable Hikvision device (of one gym, or all).
export async function runDirectDevices(gymId?: string) {
  let query = createAdminClient()
    .from("access_devices")
    .select(DEVICE_COLUMNS)
    .eq("vendor", "hikvision")
    .eq("connection", "direct")
    .eq("is_active", true);
  if (gymId) query = query.eq("gym_id", gymId);
  const { data } = await query;
  return Promise.all(((data ?? []) as DeviceRow[]).map((d) => runDirectDevice(d)));
}

// After a sale, payment or freeze: send the change to direct devices once the
// response has gone out (ZKTeco devices and the bridge collect it themselves).
export function kickAccess(gymId: string) {
  after(async () => {
    try {
      await runDirectDevices(gymId);
    } catch {
      // Picked up by the next run.
    }
  });
}

export const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
