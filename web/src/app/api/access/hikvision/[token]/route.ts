import { createAdminClient } from "@/lib/supabase/admin";
import { deviceByToken, runDirectDevice, text } from "@/lib/access/server";
import { parseEvent } from "@/lib/access/hikvision";
import { after } from "next/server";
import type { Json } from "@/lib/supabase/database.types";

// Hikvision devices post their events here (the device's "HTTP Listening"
// setting, or the Gymix Bridge relaying them). The token in the URL is the
// device's secret.

type Ctx = { params: Promise<{ token: string }> };

// The device's "Test" button.
export async function GET(_request: Request, { params }: Ctx) {
  const device = await deviceByToken((await params).token);
  return device ? text("OK") : text("Unknown device", 404);
}

export async function POST(request: Request, { params }: Ctx) {
  const device = await deviceByToken((await params).token);
  if (!device) return text("Unknown device", 404);
  const db = createAdminClient();
  if (!device.is_active) return text("OK");

  const body = await request.text();
  const event = parseEvent(body, request.headers.get("content-type") ?? "");
  if (!event) {
    // Heartbeats and other events: the device is alive.
    await db.rpc("access_device_seen", { p_device_id: device.id });
    return text("OK");
  }

  let pin = event.pin;
  // A card the device doesn't know a person for: match it to a member's card.
  if (!pin && event.card) {
    const { data } = await db.from("members").select("access_pin").eq("gym_id", device.gym_id).eq("access_card", event.card).maybeSingle();
    pin = data?.access_pin ? String(data.access_pin) : null;
  }
  const out = device.direction === "out" || (device.direction === "both" && event.out === true);
  await db.rpc("access_ingest_event", {
    p_device_id: device.id,
    p_pin: pin ?? "",
    p_at: event.at.toISOString(),
    p_direction: out ? "out" : "in",
    p_granted: event.granted,
    p_method: event.method,
    p_raw: event.raw as Json,
  });

  // A reachable device that just spoke: send it anything waiting.
  if (device.connection === "direct") after(() => runDirectDevice(device).catch(() => {}));
  return text("OK");
}
