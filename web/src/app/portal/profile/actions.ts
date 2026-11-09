"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/session";
import { isDemoEmail } from "@/lib/demo";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireMember();
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  if (fullName.length < 2) return { error: "Enter your name." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", viewer.id);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Saved." };
}

// Profile photo: checked here, then stored with the service key (members
// can't write to the gym's storage themselves).
export async function savePhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireMember();
  const file = formData.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Choose a photo." };
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return { error: "Photo must be a JPG, PNG or WebP image." };
  if (file.size > 5 * 1024 * 1024) return { error: "Photo must be under 5 MB." };
  const admin = createAdminClient();
  const path = `avatars/${viewer.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from("gym-media").upload(path, file, { contentType: file.type });
  if (error) return { error: "Couldn't upload the photo." };
  const supabase = await createClient();
  const { data: old } = await supabase.from("profiles").select("avatar_path").eq("id", viewer.id).single();
  const { error: saveError } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", viewer.id);
  if (saveError) return { error: errorMessage(saveError, "Couldn't save the photo.") };
  if (old?.avatar_path) await admin.storage.from("gym-media").remove([old.avatar_path]);
  refresh();
  return { success: "Photo updated." };
}

// Training days: weekday -> program day (or none).
export async function saveTrainingDays(days: { weekday: number; programDayId: string | null }[]): Promise<ActionState> {
  const { viewer, membership } = await requireMember();
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) return { error: "Your account isn't linked to a membership." };
  const clean = days.filter((d) => Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6);
  const { error: delError } = await supabase.from("member_training_days").delete().eq("member_id", me.id);
  if (delError) return { error: errorMessage(delError, "Couldn't save your training days.") };
  if (clean.length) {
    const { error } = await supabase
      .from("member_training_days")
      .insert(clean.map((d) => ({ member_id: me.id, weekday: d.weekday, program_day_id: d.programDayId })));
    if (error) return { error: errorMessage(error, "Couldn't save your training days.") };
  }
  refresh();
  return { success: clean.length ? `Saved: ${clean.length} training day${clean.length === 1 ? "" : "s"} a week.` : "Training days cleared." };
}

export async function saveNotificationPrefs(prefs: Record<string, boolean>): Promise<ActionState> {
  const { viewer } = await requireMember();
  const allowed = ["classes", "payments", "messages", "training"];
  const clean = Object.fromEntries(allowed.map((k) => [k, prefs[k] !== false]));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ notify_prefs: clean }).eq("id", viewer.id);
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Notification settings saved." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer } = await requireMember();
  if (isDemoEmail(viewer.email)) return { error: "The demo account's password can't be changed." };
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof password !== "string" || password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password different from your current one." };
    return { error: errorMessage(error, "Couldn't change your password.") };
  }
  return { success: "Password changed." };
}

// Whether the member's first name may appear on the gym's TV screens.
export async function saveShowOnScreens(show: boolean): Promise<ActionState> {
  const { membership } = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_show_on_screens", { p_gym_id: membership.gymId, p_show: show });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: show ? "You may appear on the gym's screens." : "You won't appear on the gym's screens." };
}
