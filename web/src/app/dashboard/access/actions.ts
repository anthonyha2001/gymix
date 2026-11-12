"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { hasFeature } from "@/lib/features";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { kickAccess, runDirectDevices } from "@/lib/access/server";

async function requireAccess() {
  const ctx = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(ctx.membership.gymId, "access_control"))) redirect("/dashboard");
  return ctx;
}

const DIRECTIONS = ["in", "out", "both"] as const;

function readDevice(formData: FormData) {
  const vendor = text(formData, "vendor");
  const name = text(formData, "name");
  const direction = text(formData, "direction") || "in";
  const zone = text(formData, "zone_id") || null;
  if (vendor !== "zkteco" && vendor !== "hikvision") return { error: "Choose ZKTeco or Hikvision." };
  if (!name) return { error: "Give the device a name, like “Main entrance”." };
  if (!DIRECTIONS.includes(direction as (typeof DIRECTIONS)[number])) return { error: "Choose entrance, exit or both." };

  if (vendor === "zkteco") {
    const serial = text(formData, "serial_number").toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z0-9_-]{4,40}$/.test(serial)) {
      return { error: "Enter the serial number exactly as the device shows it (Menu → System Info → Device Info)." };
    }
    return { device: { vendor, name, direction, zone_id: zone, serial_number: serial, connection: "push" as const, host: null, username: "admin", door_no: 1 } };
  }

  const connection = text(formData, "connection");
  if (connection !== "direct" && connection !== "bridge") return { error: "Choose how Gymix reaches the device." };
  let host = text(formData, "host").replace(/\/+$/, "");
  if (host && !/^https?:\/\//i.test(host)) host = `http://${host}`;
  if (!/^https?:\/\/[^\s/]+$/.test(host)) {
    return { error: connection === "bridge" ? "Enter the device's address on the gym network, like 192.168.1.64." : "Enter the address Gymix can reach, like 41.23.10.5:8080." };
  }
  const username = text(formData, "username") || "admin";
  const doorNo = Number(text(formData, "door_no") || "1");
  if (!Number.isInteger(doorNo) || doorNo < 1 || doorNo > 8) return { error: "Door number is 1 to 8." };
  return { device: { vendor, name, direction, zone_id: zone, serial_number: null, connection: connection as "direct" | "bridge", host, username, door_no: doorNo } };
}

export async function createDevice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireAccess();
  const parsed = readDevice(formData);
  if (!parsed.device) return { error: parsed.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("access_devices")
    .insert({ ...parsed.device, gym_id: membership.gymId, direction: parsed.device.direction as "in" | "out" | "both" })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "A device with this serial number is already registered." };
    return { error: errorMessage(error, "Couldn't add the device.") };
  }
  const password = text(formData, "password");
  if (parsed.device.vendor === "hikvision" && password) {
    await supabase.rpc("set_access_device_password", { p_device_id: data.id, p_password: password });
  }
  kickAccess(membership.gymId);
  redirect(`/dashboard/access/${data.id}?new=1`);
}

export async function updateDevice(deviceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireAccess();
  const parsed = readDevice(formData);
  if (!parsed.device) return { error: parsed.error };
  const supabase = await createClient();
  // Brand and connection type are fixed once a device exists.
  const { name, direction, zone_id, serial_number, host, username, door_no } = parsed.device;
  const changes = { name, direction, zone_id, serial_number, host, username, door_no };
  const { error } = await supabase
    .from("access_devices")
    .update({ ...changes, direction: changes.direction as "in" | "out" | "both" })
    .eq("id", deviceId)
    .eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save the device.") };
  const password = text(formData, "password");
  if (parsed.device.vendor === "hikvision" && password) {
    await supabase.rpc("set_access_device_password", { p_device_id: deviceId, p_password: password });
  }
  kickAccess(membership.gymId);
  refresh();
  return { success: "Saved." };
}

export async function setDeviceActive(deviceId: string, active: boolean): Promise<ActionState> {
  const { membership } = await requireAccess();
  const supabase = await createClient();
  const { error } = await supabase.from("access_devices").update({ is_active: active }).eq("id", deviceId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't update the device.") };
  kickAccess(membership.gymId);
  refresh();
  return { success: active ? "Device switched back on. Gymix is bringing it up to date." : "Device paused. Gymix stops sending it changes." };
}

export async function deleteDevice(deviceId: string): Promise<ActionState> {
  const { membership } = await requireAccess();
  const supabase = await createClient();
  const { error } = await supabase.from("access_devices").delete().eq("id", deviceId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't remove the device.") };
  redirect("/dashboard/access");
}

export async function resyncDevice(deviceId: string): Promise<ActionState> {
  const { membership } = await requireAccess();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resync_access_device", { p_device_id: deviceId });
  if (error) return { error: errorMessage(error, "Couldn't resend the members.") };
  await runDirectDevices(membership.gymId);
  refresh();
  return { success: data ? `Sending ${data} member${data === 1 ? "" : "s"} to the device.` : "Nobody to send: no member has an active membership for this door." };
}

export async function syncNow(): Promise<ActionState> {
  const { membership } = await requireAccess();
  const results = await runDirectDevices(membership.gymId);
  refresh();
  const sent = results.reduce((n, r) => n + r.sent, 0);
  const unreachable = results.filter((r) => r.error === "unreachable").length;
  if (unreachable) return { error: `Gymix couldn't reach ${unreachable} device${unreachable === 1 ? "" : "s"}. See the device for details.` };
  return { success: sent ? `Sent ${sent} change${sent === 1 ? "" : "s"}.` : "Everything is up to date." };
}

// ---------------------------------------------------------------- zones
export async function createZone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireAccess();
  const name = text(formData, "name");
  if (!name || name.length > 60) return { error: "Give the zone a name (up to 60 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.from("access_zones").insert({ gym_id: membership.gymId, name });
  if (error) return { error: error.code === "23505" ? "There's already a zone with that name." : errorMessage(error, "Couldn't add the zone.") };
  refresh();
  return { success: `Zone “${name}” added.` };
}

export async function renameZone(zoneId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireAccess();
  const name = text(formData, "name");
  if (!name || name.length > 60) return { error: "Give the zone a name (up to 60 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.from("access_zones").update({ name }).eq("id", zoneId).eq("gym_id", membership.gymId);
  if (error) return { error: error.code === "23505" ? "There's already a zone with that name." : errorMessage(error, "Couldn't rename the zone.") };
  refresh();
  return { success: "Saved." };
}

export async function deleteZone(zoneId: string): Promise<ActionState> {
  const { membership } = await requireAccess();
  const supabase = await createClient();
  const { error } = await supabase.from("access_zones").delete().eq("id", zoneId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't delete the zone.") };
  kickAccess(membership.gymId);
  refresh();
  return { success: "Zone deleted. Its doors are now open to every plan." };
}

// Which zones a plan opens (none ticked = every door).
export async function setPlanZones(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireAccess();
  const wanted = new Set(formData.getAll("zone").map(String));
  const supabase = await createClient();
  const { data: zones } = await supabase.from("access_zones").select("id").eq("gym_id", membership.gymId);
  const valid = new Set((zones ?? []).map((z) => z.id));
  const { data: current } = await supabase.from("plan_access_zones").select("zone_id").eq("plan_id", planId);
  const have = new Set((current ?? []).map((r) => r.zone_id));
  const add = [...wanted].filter((z) => valid.has(z) && !have.has(z));
  const remove = [...have].filter((z) => !wanted.has(z));
  if (add.length) {
    const { error } = await supabase.from("plan_access_zones").insert(add.map((zone_id) => ({ plan_id: planId, zone_id })));
    if (error) return { error: errorMessage(error, "Couldn't save the zones.") };
  }
  if (remove.length) {
    const { error } = await supabase.from("plan_access_zones").delete().eq("plan_id", planId).in("zone_id", remove);
    if (error) return { error: errorMessage(error, "Couldn't save the zones.") };
  }
  kickAccess(membership.gymId);
  refresh();
  return { success: "Saved. Doors are being updated." };
}

// ---------------------------------------------------------------- member credentials
export async function setMemberCard(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_access_card", { p_member_id: memberId, p_card: text(formData, "card") });
  if (error) return { error: errorMessage(error, "Couldn't save the card.") };
  kickAccess(membership.gymId);
  refresh();
  return { success: "Card saved. Doors are being updated." };
}

// ---------------------------------------------------------------- phone taps
// "Phone must be at the gym": the gym's location and how far from it a door
// sticker tap may come. No location: the sticker works wherever the phone is.
export async function setDoorLocation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireAccess();
  const off = text(formData, "off") === "1";
  const lat = Number(text(formData, "lat"));
  const lng = Number(text(formData, "lng"));
  const radius = Number(text(formData, "radius") || "150");
  if (!off && (!text(formData, "lat") || !Number.isFinite(lat) || !Number.isFinite(lng))) {
    return { error: "Press “Use this phone's location” while you're at the gym first." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_door_location", {
    p_gym_id: membership.gymId,
    p_lat: off ? null : lat,
    p_lng: off ? null : lng,
    p_radius_m: radius,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the location.") };
  refresh();
  return { success: off ? "Door stickers now work wherever the phone is." : "Door stickers now only open at the gym." };
}
