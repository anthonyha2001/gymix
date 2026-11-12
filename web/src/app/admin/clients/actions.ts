"use server";

import crypto from "node:crypto";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/session";
import { requestOrigin } from "@/lib/origin";
import { formatDate } from "@/lib/format";

// Clients, by hand: when a gym pays, the super admin creates the owner's
// login and their gym here, then sends the login on WhatsApp Business.

export type Credentials = {
  gymId: string;
  gymName: string;
  ownerName: string;
  email: string;
  phone: string | null;
  password: string | null; // null: they already had an account (their own password still works)
  loginUrl: string;
  paidUntil: string | null;
  message: string;
  whatsappUrl: string | null;
};

// Easy to read out and type: no 0/O, 1/l/I.
function tempPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `gx-${pick(4)}-${pick(4)}`;
}

// Lebanese numbers: "03 123 456", "+961 3 123456", "70123456" → 9613123456.
export async function normalizePhone(raw: string) {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 7 || d.length === 8) return `961${d}`;
  return d.length >= 8 ? d : null;
}

function welcomeMessage(c: { ownerName: string; gymName: string; email: string; password: string | null; loginUrl: string; paidUntil: string | null }) {
  const first = c.ownerName.split(" ")[0] || "there";
  return [
    `Hi ${first}, welcome to Gymix!`,
    "",
    `Your gym *${c.gymName}* is ready.`,
    "",
    `Log in: ${c.loginUrl}`,
    `Email: ${c.email}`,
    c.password ? `Temporary password: ${c.password}` : "Password: the one you already use for Gymix",
    "",
    c.password ? "Please change the password after your first login (tap your name, then Change password)." : "",
    c.paidUntil ? `Your plan is paid until ${formatDate(c.paidUntil)}.` : "",
    "",
    "Any question, just reply to this message.",
    "The Gymix team",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}

function waUrl(phone: string | null, message: string) {
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
}

export async function createClientGym(input: {
  ownerName: string;
  email: string;
  phone: string;
  gymName: string;
  months: number;
  amountUsd: number;
  method: string;
}): Promise<{ error?: string; credentials?: Credentials }> {
  await requirePlatformAdmin();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const gymName = input.gymName.trim();
  const phone = input.phone.trim() ? await normalizePhone(input.phone) : null;
  if (ownerName.length < 2) return { error: "Write the owner's name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Write a valid email." };
  if (gymName.length < 2) return { error: "Write the gym's name." };
  if (input.phone.trim() && !phone) return { error: "That phone number doesn't look right." };
  if (!Number.isInteger(input.months) || input.months < 0 || input.months > 36) return { error: "Months must be between 0 and 36." };

  const admin = createAdminClient();
  // Already on Gymix (e.g. tried the demo)? Use that account.
  const { data: existing } = await admin.from("profiles").select("id, full_name").ilike("email", email).maybeSingle();
  let ownerId = existing?.id ?? null;
  let password: string | null = null;
  if (!ownerId) {
    password = tempPassword();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: ownerName, phone } });
    if (error || !data.user) return { error: error?.message ?? "Couldn't create the login." };
    ownerId = data.user.id;
  }
  await admin.from("profiles").update({ full_name: ownerName, ...(phone ? { phone: `+${phone}` } : {}) }).eq("id", ownerId);

  // The gym, made by the super admin's own session (checked in the database).
  const supabase = await createClient();
  const { data: gymId, error: gymError } = await supabase.rpc("admin_provision_gym", { p_owner: ownerId, p_name: gymName });
  if (gymError || !gymId) return { error: gymError?.message ?? "Couldn't create the gym." };

  let paidUntil: string | null = null;
  if (input.months > 0) {
    const { data, error } = await supabase.rpc("admin_record_subscription_payment", {
      p_gym_id: gymId,
      p_months: input.months,
      p_amount_usd: Math.max(0, input.amountUsd || 0),
      p_method: input.method || "cash",
      p_note: "First payment (added with the client)",
    });
    if (error) return { error: `Gym created, but the payment wasn't recorded: ${error.message}` };
    paidUntil = data ?? null;
  }

  const loginUrl = `${await requestOrigin()}/login`;
  const message = welcomeMessage({ ownerName, gymName, email, password, loginUrl, paidUntil });
  refresh();
  return { credentials: { gymId, gymName, ownerName, email, phone, password, loginUrl, paidUntil, message, whatsappUrl: waUrl(phone, message) } };
}

// A fresh temporary password for a gym's owner, and the message to send.
export async function resendLogin(gymId: string): Promise<{ error?: string; credentials?: Credentials }> {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const { data: gym } = await admin.from("gyms").select("id, name, paid_until").eq("id", gymId).maybeSingle();
  if (!gym) return { error: "Gym not found." };
  const { data: owner } = await admin.from("gym_users").select("user_id, profiles(full_name, email, phone)").eq("gym_id", gymId).eq("role", "owner").limit(1).maybeSingle();
  const p = owner?.profiles as { full_name: string; email: string; phone: string | null } | null;
  if (!owner || !p) return { error: "This gym has no owner." };
  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(owner.user_id, { password });
  if (error) return { error: error.message };
  const phone = p.phone ? await normalizePhone(p.phone) : null;
  const loginUrl = `${await requestOrigin()}/login`;
  const message = welcomeMessage({ ownerName: p.full_name, gymName: gym.name, email: p.email, password, loginUrl, paidUntil: gym.paid_until });
  return {
    credentials: { gymId, gymName: gym.name, ownerName: p.full_name, email: p.email, phone, password, loginUrl, paidUntil: gym.paid_until, message, whatsappUrl: waUrl(phone, message) },
  };
}

export async function markWelcomeSent(gymId: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.rpc("admin_mark_welcome_sent", { p_gym_id: gymId });
  refresh();
}

// ------------------------------------------------------------- requests
export async function markRequestContacted(id: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.rpc("admin_update_request", { p_id: id, p_status: "contacted" });
  refresh();
}

export async function declineRequest(id: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.rpc("admin_update_request", { p_id: id, p_status: "declined" });
  refresh();
}

export async function saveRequestNote(id: string, notes: string) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.rpc("admin_update_request", { p_id: id, p_notes: notes.slice(0, 2000) });
  refresh();
}

// They paid: make their account and gym, record the payment, and hand back
// the login message for WhatsApp.
export async function confirmRequestPayment(id: string, payment: { months: number; amountUsd: number; method: string }) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data: r } = await supabase.from("access_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return { error: "Request not found." };
  if (r.gym_id) return { error: "This request already has a gym. Use \"Send login again\"." };
  const res = await createClientGym({ ownerName: r.owner_name, email: r.email, phone: r.phone, gymName: r.gym_name, ...payment });
  if (res.credentials) await supabase.rpc("admin_update_request", { p_id: id, p_status: "paid", p_gym_id: res.credentials.gymId });
  refresh();
  return res;
}

// The login message was sent (the WhatsApp button was pressed).
export async function markLoginSent(gymId: string, requestId?: string | null) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.rpc("admin_mark_welcome_sent", { p_gym_id: gymId });
  if (requestId) await supabase.rpc("admin_update_request", { p_id: requestId, p_welcome_sent: true });
  refresh();
}
