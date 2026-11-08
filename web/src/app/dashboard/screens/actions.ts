"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { hasFeature } from "@/lib/features";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

async function requireScreens() {
  const ctx = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(ctx.membership.gymId, "screens"))) redirect("/dashboard");
  return ctx;
}

const KINDS = ["announcement", "promo", "schedule", "leaderboard", "achievements", "occupancy"] as const;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function createScreen(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireScreens();
  const name = text(formData, "name");
  const orientation = text(formData, "orientation") === "portrait" ? "portrait" : "landscape";
  if (!name || name.length > 60) return { error: "Give the screen a name, like “Lobby TV”." };
  const supabase = await createClient();
  const { error } = await supabase.from("screens").insert({ gym_id: membership.gymId, name, orientation });
  if (error) return { error: errorMessage(error, "Couldn't add the screen.") };
  refresh();
  return { success: `${name} added. Open its link on the TV.` };
}

export async function updateScreen(screenId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireScreens();
  const name = text(formData, "name");
  const orientation = text(formData, "orientation") === "portrait" ? "portrait" : "landscape";
  if (!name || name.length > 60) return { error: "Give the screen a name." };
  const supabase = await createClient();
  const { error } = await supabase.from("screens").update({ name, orientation }).eq("id", screenId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved." };
}

export async function setScreenActive(screenId: string, active: boolean): Promise<ActionState> {
  const { membership } = await requireScreens();
  const supabase = await createClient();
  const { error } = await supabase.from("screens").update({ is_active: active }).eq("id", screenId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't update the screen.") };
  refresh();
  return { success: active ? "Screen switched on." : "Screen switched off. Its link shows nothing until you switch it back on." };
}

export async function deleteScreen(screenId: string): Promise<ActionState> {
  const { membership } = await requireScreens();
  const supabase = await createClient();
  const { error } = await supabase.from("screens").delete().eq("id", screenId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't remove the screen.") };
  refresh();
  return { success: "Screen removed." };
}

async function readSlide(formData: FormData, gymId: string) {
  const kind = text(formData, "kind") as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return { error: "Choose what the slide shows." };
  const title = text(formData, "title") || null;
  const body = text(formData, "body") || null;
  if ((kind === "announcement" || kind === "promo") && !title) return { error: "Give the slide a headline." };
  if (title && title.length > 80) return { error: "Keep the headline under 80 characters." };
  if (body && body.length > 300) return { error: "Keep the text under 300 characters." };
  const duration = Number(text(formData, "duration_seconds") || "12");
  if (!Number.isInteger(duration) || duration < 5 || duration > 60) return { error: "Show it for 5 to 60 seconds." };
  const theme = (["dark", "lime", "light"] as const).find((t) => t === text(formData, "theme")) ?? "dark";
  const startsOn = text(formData, "starts_on") || null;
  const endsOn = text(formData, "ends_on") || null;
  if (startsOn && endsOn && endsOn < startsOn) return { error: "The end date is before the start date." };
  const weekdays = formData.getAll("weekday").map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const timeFrom = text(formData, "time_from") || null;
  const timeTo = text(formData, "time_to") || null;
  if ((timeFrom && !timeTo) || (!timeFrom && timeTo)) return { error: "Set both times of day, or neither." };
  if (timeFrom && timeTo && timeTo <= timeFrom) return { error: "The end time must be after the start time." };
  const allScreens = formData.get("all_screens") !== "off";
  const screenIds = allScreens ? null : formData.getAll("screen").map(String);
  if (screenIds && !screenIds.length) return { error: "Choose at least one screen, or show it on all screens." };

  let imagePath: string | null | undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { error: "The image must be a JPG, PNG or WebP." };
    if (file.size > 5 * 1024 * 1024) return { error: "The image must be under 5 MB." };
    const supabase = await createClient();
    const path = `${gymId}/screens/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("gym-media").upload(path, file, { contentType: file.type });
    if (error) return { error: "Couldn't upload the image." };
    imagePath = path;
  } else if (formData.get("remove_image") === "on") imagePath = null;

  return {
    slide: {
      kind,
      title,
      body,
      theme,
      duration_seconds: duration,
      starts_on: startsOn,
      ends_on: endsOn,
      weekdays: weekdays.length && weekdays.length < 7 ? weekdays : null,
      time_from: timeFrom,
      time_to: timeTo,
      screen_ids: screenIds,
      ...(imagePath !== undefined ? { image_path: imagePath } : {}),
    },
  };
}

export async function createSlide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireScreens();
  const parsed = await readSlide(formData, membership.gymId);
  if (!parsed.slide) return { error: parsed.error };
  const supabase = await createClient();
  const { data: last } = await supabase.from("screen_slides").select("position").eq("gym_id", membership.gymId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("screen_slides").insert({ ...parsed.slide, gym_id: membership.gymId, position: (last?.position ?? 0) + 1 });
  if (error) return { error: errorMessage(error, "Couldn't add the slide.") };
  refresh();
  return { success: "Slide added. Screens show it within a minute." };
}

export async function updateSlide(slideId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireScreens();
  const parsed = await readSlide(formData, membership.gymId);
  if (!parsed.slide) return { error: parsed.error };
  const supabase = await createClient();
  const { data: before } = await supabase.from("screen_slides").select("image_path").eq("id", slideId).eq("gym_id", membership.gymId).maybeSingle();
  const { error } = await supabase.from("screen_slides").update(parsed.slide).eq("id", slideId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't save the slide.") };
  if ("image_path" in parsed.slide && before?.image_path && before.image_path !== parsed.slide.image_path) {
    await supabase.storage.from("gym-media").remove([before.image_path]);
  }
  refresh();
  return { success: "Saved." };
}

export async function setSlideActive(slideId: string, active: boolean): Promise<ActionState> {
  const { membership } = await requireScreens();
  const supabase = await createClient();
  const { error } = await supabase.from("screen_slides").update({ is_active: active }).eq("id", slideId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't update the slide.") };
  refresh();
  return { success: active ? "Slide showing again." : "Slide hidden." };
}

export async function deleteSlide(slideId: string): Promise<ActionState> {
  const { membership } = await requireScreens();
  const supabase = await createClient();
  const { data } = await supabase.from("screen_slides").delete().eq("id", slideId).eq("gym_id", membership.gymId).select("image_path").maybeSingle();
  if (data?.image_path) await supabase.storage.from("gym-media").remove([data.image_path]);
  refresh();
  return { success: "Slide deleted." };
}

// Swap a slide with its neighbour.
export async function moveSlide(slideId: string, direction: "up" | "down"): Promise<ActionState> {
  const { membership } = await requireScreens();
  const supabase = await createClient();
  const { data: slides } = await supabase.from("screen_slides").select("id, position").eq("gym_id", membership.gymId).order("position").order("created_at");
  const list = slides ?? [];
  const i = list.findIndex((s) => s.id === slideId);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return {};
  // Renumber everything so positions stay distinct, then swap the two.
  const order = list.map((s) => s.id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(order.map((id, n) => supabase.from("screen_slides").update({ position: n + 1 }).eq("id", id).eq("gym_id", membership.gymId)));
  refresh();
  return {};
}
