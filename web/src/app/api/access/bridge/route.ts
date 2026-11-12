import { createAdminClient } from "@/lib/supabase/admin";
import { planFor } from "@/lib/access/hikvision";
import { realtimeConfig } from "@/lib/access/server";
import { requestOrigin } from "@/lib/origin";
import type { Json } from "@/lib/supabase/database.types";

// The Gymix Bridge (bridge/gymix-bridge.mjs) runs on a computer at the gym and
// talks to Hikvision devices on the local network. Every few seconds it:
//   GET  this URL  → its devices (address, login) and the requests to make
//   POST this URL  → how each command went, and which devices answered
// Authorization: Bearer <the gym's bridge token>.

async function bridgeGym(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+([0-9a-f]{64})$/i)?.[1];
  if (!token) return null;
  const db = createAdminClient();
  const { data } = await db.from("access_bridges").select("gym_id, last_seen_at, version").eq("token", token).maybeSingle();
  if (!data) return null;
  // The bridge calls every 2 seconds: note it every 15 seconds, not every call.
  const version = request.headers.get("x-bridge-version")?.slice(0, 40) ?? null;
  if (!data.last_seen_at || Date.now() - new Date(data.last_seen_at).getTime() > 15_000 || version !== data.version) {
    await db.from("access_bridges").update({ last_seen_at: new Date().toISOString(), version }).eq("token", token);
  }
  return data.gym_id;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

type PollDevice = { id: string; name: string; host: string; username: string; door_no: number; event_token: string; password: string };
type PollCommand = { id: number; device_id: string; kind: string; payload: Record<string, unknown> };

// The bridge asks every few seconds, so this is one database call: devices,
// logins and commands (door openings first) together.
export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+([0-9a-f]{64})$/i)?.[1];
  if (!token) return json({ error: "This bridge token is not valid." }, 401);
  const db = createAdminClient();
  const { data } = await db.rpc("access_bridge_poll", { p_token: token, p_version: request.headers.get("x-bridge-version")?.slice(0, 40) ?? undefined });
  const poll = data as { devices: PollDevice[]; commands: PollCommand[] } | null;
  if (!poll) return json({ error: "This bridge token is not valid." }, 401);

  const origin = await requestOrigin();
  const doorNo = new Map(poll.devices.map((d) => [d.id, d.door_no]));
  const commands: { id: number; device_id: string; steps: ReturnType<typeof planFor> }[] = [];
  for (const c of poll.commands) {
    const steps = planFor(c.kind, c.payload, doorNo.get(c.device_id) ?? 1);
    if (!steps.length) {
      await db.rpc("access_command_done", { p_device_id: c.device_id, p_command_id: c.id, p_ok: false, p_result: "Not something this device does" });
      continue;
    }
    commands.push({ id: c.id, device_id: c.device_id, steps });
  }

  // A bridge listening for instant signals (Supabase Realtime) is told the
  // moment a door should open, so it only needs to ask every 10 seconds (in
  // case a signal is lost: still inside the 15 s an opening lasts). Without
  // it, every 2 seconds, so a door opens within ~3 s either way.
  const instant = request.headers.get("x-bridge-realtime") === "1";
  return json({
    poll_seconds: commands.length ? 1 : instant ? 10 : 2,
    realtime: realtimeConfig(token),
    devices: poll.devices.map((d) => ({
      id: d.id,
      name: d.name,
      host: d.host,
      username: d.username,
      password: d.password,
      event_url: `${origin}/api/access/hikvision/${d.event_token}`,
    })),
    commands,
  });
}

type Report = {
  results?: { id: number; device_id: string; ok: boolean; error?: string }[];
  devices?: { id: string; online: boolean; info?: Record<string, unknown>; error?: string }[];
};

export async function POST(request: Request) {
  const gymId = await bridgeGym(request);
  if (!gymId) return json({ error: "This bridge token is not valid." }, 401);
  const db = createAdminClient();
  let report: Report;
  try {
    report = (await request.json()) as Report;
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }

  // Only this gym's devices.
  const { data: own } = await db.from("access_devices").select("id").eq("gym_id", gymId);
  const mine = new Set((own ?? []).map((d) => d.id));

  for (const d of report.devices ?? []) {
    if (!mine.has(d.id)) continue;
    if (d.online) {
      await db.rpc("access_device_seen", { p_device_id: d.id, p_info: (d.info ?? undefined) as Json | undefined });
      if (!d.error) await db.from("access_devices").update({ last_error: null }).eq("id", d.id);
    }
    if (d.error) await db.from("access_devices").update({ last_error: String(d.error).slice(0, 500) }).eq("id", d.id);
  }
  for (const r of report.results ?? []) {
    if (!mine.has(r.device_id) || !Number.isInteger(r.id)) continue;
    await db.rpc("access_command_done", { p_device_id: r.device_id, p_command_id: r.id, p_ok: Boolean(r.ok), p_result: r.ok ? undefined : String(r.error ?? "Failed").slice(0, 500) });
  }
  return json({ ok: true });
}
