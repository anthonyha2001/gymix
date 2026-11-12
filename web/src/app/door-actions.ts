"use server";

import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/action-result";
import { BILLING_ROLES } from "@/lib/roles";
import { requireStaff, requireViewer } from "@/lib/session";
import { deliverOpenNow } from "@/lib/access/server";

// Opening doors from Gymix: staff press "Open door"; members tap the door's
// NFC sticker (/d/<token>). The database checks who may, queues the opening
// ahead of everything else, and drops it if the door doesn't collect it
// within 15 seconds.

export type OpenState = "waiting" | "sent" | "opened" | "failed";
export type OpenResult = { ok: true; commandId: number } | { ok: false; error: string };

export async function openDoor(deviceId: string): Promise<OpenResult> {
  await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("access_open_door", { p_device_id: deviceId });
  if (error || data == null) return { ok: false, error: error ? errorMessage(error, "Couldn't open the door.") : "Couldn't open the door." };
  await deliverOpenNow(deviceId);
  return { ok: true, commandId: data };
}

// Polled by the button until the door confirms (or the opening expires).
export async function openStatus(commandId: number): Promise<OpenState> {
  await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.rpc("access_open_status", { p_command_id: commandId });
  return (["waiting", "sent", "opened", "failed"] as const).find((s) => s === data) ?? "failed";
}

export type DoorTapResult =
  | {
      ok: true;
      allowed: boolean;
      alreadyIn: boolean;
      reason: string | null;
      fullName: string | null;
      planName: string | null;
      endsOn: string | null;
      visitsLeft: number | null;
      doorName: string;
      commandId: number | null;
    }
  | { ok: false; error: string };

export type Spot = { lat: number; lng: number; accuracy: number };

// A member tapped a door's sticker: check in and, if allowed, open it. When the
// gym requires it, `spot` is the phone's location (checked in the database).
export async function doorTap(token: string, spot: Spot | null = null): Promise<DoorTapResult> {
  await requireViewer();
  const supabase = await createClient();
  const where = spot && [spot.lat, spot.lng, spot.accuracy].every(Number.isFinite) ? spot : null;
  const { data, error } = await supabase
    .rpc("door_tap", { p_token: token, p_lat: where?.lat, p_lng: where?.lng, p_accuracy_m: where?.accuracy })
    .single();
  if (error || !data) return { ok: false, error: error ? errorMessage(error, "Couldn't open the door. Ask the front desk.") : "Couldn't open the door." };
  if (data.command_id) await deliverOpenNow(data.device_id);
  return {
    ok: true,
    allowed: data.allowed,
    alreadyIn: data.already_in,
    reason: data.reason,
    fullName: data.full_name,
    planName: data.plan_name,
    endsOn: data.ends_on,
    visitsLeft: data.visits_left,
    doorName: data.door_name,
    commandId: data.command_id,
  };
}
