"use server";

// Class bookings and PT sessions, for both staff and members. The database
// functions decide who may do what.

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGymUser, requireStaff } from "@/lib/session";
import { MANAGER_ROLES } from "@/lib/roles";
import { gymTimeToIso } from "@/lib/schedule";
import { errorMessage, text, type ActionState } from "@/lib/action-result";

export async function bookClass(classId: string, date: string, memberId?: string): Promise<ActionState> {
  await requireGymUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("book_class", {
    p_class_id: classId,
    p_date: date,
    p_member_id: memberId,
  });
  if (error) return { error: errorMessage(error, "Couldn't book.") };
  refresh();
  return { success: data === "waitlist" ? "Class is full — you're on the waitlist." : "Booked!" };
}

export async function cancelBooking(bookingId: string): Promise<ActionState> {
  await requireGymUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  if (error) return { error: errorMessage(error, "Couldn't cancel.") };
  refresh();
  return { success: "Cancelled." };
}

export async function markAttendance(bookingId: string, attended: boolean): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_attendance", { p_booking_id: bookingId, p_attended: attended });
  if (error) return { error: errorMessage(error) };
  refresh();
  return {};
}

function readSessionForm(formData: FormData, timeZone: string) {
  const date = text(formData, "date");
  const time = text(formData, "time");
  const duration = Number(text(formData, "duration_min") || "60");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: "Pick a date and time." };
  if (!Number.isInteger(duration) || duration < 15 || duration > 180) return { error: "Length: 15 to 180 minutes." };
  return { startsAt: gymTimeToIso(date, time, timeZone), duration, note: text(formData, "note") || undefined };
}

export async function requestPtSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireGymUser();
  const parsed = readSessionForm(formData, membership.timezone);
  if (!parsed.startsAt) return { error: parsed.error };
  const trainerId = text(formData, "trainer_id");
  if (!trainerId) return { error: "Choose a trainer." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_pt_session", {
    p_gym_id: membership.gymId,
    p_trainer_id: trainerId,
    p_starts_at: parsed.startsAt,
    p_duration: parsed.duration,
    p_note: parsed.note,
  });
  if (error) return { error: errorMessage(error, "Couldn't send the request.") };
  refresh();
  return { success: "Request sent. You'll see it here once the trainer confirms." };
}

export async function schedulePtSession(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff();
  const parsed = readSessionForm(formData, membership.timezone);
  if (!parsed.startsAt) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_pt_session", {
    p_member_id: memberId,
    p_trainer_id: text(formData, "trainer_id"),
    p_starts_at: parsed.startsAt,
    p_duration: parsed.duration,
    p_note: parsed.note,
  });
  if (error) return { error: errorMessage(error, "Couldn't book the session.") };
  refresh();
  return { success: "Session booked." };
}

export async function updatePtSession(sessionId: string, action: "confirm" | "decline" | "cancel" | "done"): Promise<ActionState> {
  await requireGymUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_pt_session", { p_session_id: sessionId, p_action: action });
  if (error) return { error: errorMessage(error) };
  refresh();
  return {};
}

export async function saveClass(classId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const name = text(formData, "name");
  const weekday = Number(text(formData, "weekday"));
  const startTime = text(formData, "start_time");
  const duration = Number(text(formData, "duration_min"));
  const capacity = Number(text(formData, "capacity"));
  if (!name) return { error: "Name the class." };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: "Choose a day." };
  if (!/^\d{2}:\d{2}$/.test(startTime)) return { error: "Choose a start time." };
  if (!Number.isInteger(duration) || duration < 10 || duration > 240) return { error: "Length: 10 to 240 minutes." };
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return { error: "Spots: 1 to 500." };
  const priceRaw = text(formData, "monthly_price_usd").replace(",", ".");
  const monthlyPrice = priceRaw ? Number(priceRaw) : null;
  if (monthlyPrice !== null && (!Number.isFinite(monthlyPrice) || monthlyPrice < 0)) return { error: "Enter a monthly price, or leave it empty." };

  const row = {
    monthly_price_usd: monthlyPrice,
    name,
    weekday,
    start_time: startTime,
    duration_min: duration,
    capacity,
    trainer_id: text(formData, "trainer_id") || null,
    location: text(formData, "location") || null,
    description: text(formData, "description") || null,
  };
  const supabase = await createClient();
  const { error } = classId
    ? await supabase.from("classes").update(row).eq("id", classId).eq("gym_id", membership.gymId)
    : await supabase.from("classes").insert({ ...row, gym_id: membership.gymId });
  if (error) return { error: errorMessage(error, "Couldn't save the class.") };
  refresh();
  return { success: classId ? "Saved." : `“${name}” added to the timetable.` };
}

export async function setClassActive(classId: string, isActive: boolean) {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  await supabase.from("classes").update({ is_active: isActive }).eq("id", classId).eq("gym_id", membership.gymId);
  refresh();
}

export async function deleteClass(classId: string): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error, "Couldn't delete the class.") };
  refresh();
  return { success: "Class deleted from the timetable." };
}

// --- Monthly courses ---------------------------------------------------------

// A member subscribes themselves (memberId null) or staff subscribe a member,
// for one month from startsOn: an invoice, and a booking in every session.
export async function subscribeToCourse(classId: string, memberId: string | null, startsOn: string | null): Promise<ActionState> {
  await requireGymUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("subscribe_to_course", {
    p_class_id: classId,
    p_member_id: memberId ?? undefined,
    p_starts_on: startsOn ?? undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't subscribe.") };
  refresh();
  return { success: memberId ? "Subscribed. The month's invoice is on their account." : "Subscribed. Pay at the front desk before your first class." };
}

// Staff subscribe a member from their profile (form: class + start date).
export async function subscribeMemberForm(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const classId = text(formData, "class_id");
  if (!classId) return { error: "Choose the course." };
  return subscribeToCourse(classId, memberId, text(formData, "starts_on") || null);
}

export async function cancelCourseSubscription(subscriptionId: string): Promise<ActionState> {
  await requireGymUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_course_subscription", { p_subscription_id: subscriptionId });
  if (error) return { error: errorMessage(error, "Couldn't cancel.") };
  refresh();
  return { success: "Subscription cancelled. Its coming sessions are free again." };
}
