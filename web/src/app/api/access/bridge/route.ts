import { createAdminClient } from "@/lib/supabase/admin";
import { planFor } from "@/lib/access/hikvision";
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
  const { data } = await db
    .from("access_bridges")
    .update({ last_seen_at: new Date().toISOString(), version: request.headers.get("x-bridge-version")?.slice(0, 40) ?? null })
    .eq("token", token)
    .select("gym_id")
    .maybeSingle();
  return data?.gym_id ?? null;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const gymId = await bridgeGym(request);
  if (!gymId) return json({ error: "This bridge token is not valid." }, 401);
  const db = createAdminClient();
  const { data: devices } = await db
    .from("access_devices")
    .select("id, name, host, username, door_no, event_token, access_device_secrets(password)")
    .eq("gym_id", gymId)
    .eq("vendor", "hikvision")
    .eq("connection", "bridge")
    .eq("is_active", true);

  const origin = await requestOrigin();
  const commands: { id: number; device_id: string; steps: ReturnType<typeof planFor> }[] = [];
  for (const d of devices ?? []) {
    if (!d.host) continue;
    const { data: taken } = await db.rpc("access_take_commands", { p_device_id: d.id, p_limit: 25 });
    for (const c of taken ?? []) {
      const steps = planFor(c.kind, c.payload as Record<string, unknown>, d.door_no);
      if (!steps.length) {
        await db.rpc("access_command_done", { p_device_id: d.id, p_command_id: c.id, p_ok: false, p_result: "Not something this device does" });
        continue;
      }
      commands.push({ id: c.id, device_id: d.id, steps });
    }
  }

  return json({
    poll_seconds: commands.length ? 1 : 5,
    devices: (devices ?? [])
      .filter((d) => d.host)
      .map((d) => ({
        id: d.id,
        name: d.name,
        host: d.host,
        username: d.username,
        password: (Array.isArray(d.access_device_secrets) ? d.access_device_secrets[0]?.password : d.access_device_secrets?.password) ?? "",
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
