"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES, MANAGER_ROLES } from "@/lib/roles";
import { PAYMENT_METHODS, formatUSD, type PaymentMethod } from "@/lib/format";
import { errorMessage, money, text, type ActionState } from "@/lib/action-result";
import { requestOrigin } from "@/lib/origin";
import { kickAccess } from "@/lib/access/server";
import { firstName, sendWhatsApp, whatsappConfigured } from "@/lib/whatsapp";

// A payment receipt on WhatsApp, after the response is sent.
async function sendReceipt(gymId: string, gymName: string, memberId: string, amountUsd: number, ref: string) {
  if (!(await whatsappConfigured())) return;
  const supabase = await createClient();
  const { data: m } = await supabase.from("members").select("full_name, phone").eq("id", memberId).maybeSingle();
  if (!m?.phone) return;
  after(() =>
    sendWhatsApp({ kind: "payment", ref, gymId, memberId, phone: m.phone, params: [firstName(m.full_name), gymName, formatUSD(amountUsd)] }),
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function readDetails(formData: FormData) {
  const fullName = text(formData, "full_name");
  const phone = text(formData, "phone");
  const email = text(formData, "email").toLowerCase();
  const notes = text(formData, "notes");
  if (fullName.length < 2) return { error: "Enter the member's full name." };
  if (email && !EMAIL_RE.test(email)) return { error: "That email doesn't look right." };
  if (phone.length > 30) return { error: "Phone number is too long." };
  return { details: { full_name: fullName, phone: phone || null, email: email || null, notes: notes || null } };
}

function readPayment(formData: FormData, prefix = "") {
  const amountUsd = money(formData, `${prefix}amount_usd`);
  const method = text(formData, `${prefix}method`) as PaymentMethod;
  const lbpRaw = text(formData, `${prefix}amount_lbp`).replace(/[,\s]/g, "");
  const amountLbp = method === "cash_lbp" && lbpRaw ? Number(lbpRaw) : null;
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return { error: "Enter a valid amount." };
  if (amountUsd > 0 && !PAYMENT_METHODS.some((m) => m.value === method)) return { error: "Choose how they paid." };
  if (amountLbp !== null && (!Number.isFinite(amountLbp) || amountLbp <= 0)) return { error: "Enter a valid LBP amount." };
  return { payment: { amountUsd, method, amountLbp } };
}

// Gets (or creates) the member's personal invite link. Email isn't required:
// the link itself is the invite, shared by WhatsApp or copied.
async function memberInvite(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("member_invite_token", { p_member_id: memberId });
  return error ? errorMessage(error, "Couldn't create the invite link.") : null;
}

export async function createMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, membership } = await requireStaff(BILLING_ROLES);
  const parsed = readDetails(formData);
  if (!parsed.details) return { error: parsed.error };
  const wantsInvite = formData.get("invite") === "on";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .insert({ ...parsed.details, gym_id: membership.gymId, created_by: viewer.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "A member with this email already exists." };
    return { error: errorMessage(error, "Couldn't add the member.") };
  }

  if (wantsInvite) {
    const inviteError = await memberInvite(data.id);
    if (inviteError) return { error: inviteError };
  }
  // New member with a phone: their login link goes out on WhatsApp.
  if (parsed.details.phone && (await whatsappConfigured())) {
    const { data: token } = await supabase.rpc("member_invite_token", { p_member_id: data.id });
    if (token) {
      const url = `${await requestOrigin()}/join/${token}`;
      const phone = parsed.details.phone;
      after(() =>
        sendWhatsApp({ kind: "welcome", ref: data.id, gymId: membership.gymId, memberId: data.id, phone, params: [firstName(parsed.details.full_name), membership.gymName, url] }),
      );
    }
  }
  // Stay on the list: a "Member added" dialog offers the invite and the profile.
  redirect(`/dashboard/members?added=${data.id}`);
}

export async function updateMember(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(BILLING_ROLES);
  const parsed = readDetails(formData);
  if (!parsed.details) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update(parsed.details)
    .eq("id", memberId)
    .eq("gym_id", membership.gymId);
  if (error) {
    if (error.code === "23505") return { error: "Another member already uses this email." };
    return { error: errorMessage(error, "Couldn't save.") };
  }
  refresh();
  return { success: "Saved." };
}

export async function inviteToPortal(memberId: string): Promise<ActionState> {
  await requireStaff(BILLING_ROLES);
  const inviteError = await memberInvite(memberId);
  if (inviteError) return { error: inviteError };
  refresh();
  return { success: "Invite link ready — send it on WhatsApp or copy it." };
}

export async function removePortalAccess(memberId: string) {
  const { membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .eq("id", memberId)
    .eq("gym_id", membership.gymId)
    .single();
  if (member?.user_id) {
    await supabase.from("gym_users").delete().eq("gym_id", membership.gymId).eq("user_id", member.user_id).eq("role", "member");
  }
  refresh();
}

export async function sellMembership(memberId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(BILLING_ROLES);
  kickAccess(membership.gymId);
  const planId = text(formData, "plan_id");
  const startsOn = text(formData, "starts_on");
  const discount = money(formData, "discount_usd");
  if (!planId) return { error: "Choose a plan." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { error: "Choose a start date." };
  if (!Number.isFinite(discount) || discount < 0) return { error: "Enter a valid discount." };
  const parsed = readPayment(formData);
  if (!parsed.payment) return { error: parsed.error };

  const supabase = await createClient();
  const { data: saleId, error } = await supabase.rpc("sell_membership", {
    p_member_id: memberId,
    p_plan_id: planId,
    p_starts_on: startsOn,
    p_discount_usd: discount,
    p_paid_usd: parsed.payment.amountUsd,
    p_method: parsed.payment.amountUsd > 0 ? parsed.payment.method : undefined,
    p_amount_lbp: parsed.payment.amountLbp ?? undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't sell the membership.") };
  if (parsed.payment.amountUsd > 0) await sendReceipt(membership.gymId, membership.gymName, memberId, parsed.payment.amountUsd, `sale:${saleId}`);

  refresh();
  return { success: "Membership sold and invoice created." };
}

export async function recordPayment(invoiceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(BILLING_ROLES);
  kickAccess(membership.gymId);
  const parsed = readPayment(formData);
  if (!parsed.payment) return { error: parsed.error };
  if (parsed.payment.amountUsd <= 0) return { error: "Enter the amount received." };

  const supabase = await createClient();
  const { data: paymentId, error } = await supabase.rpc("add_payment", {
    p_invoice_id: invoiceId,
    p_amount_usd: parsed.payment.amountUsd,
    p_method: parsed.payment.method,
    p_amount_lbp: parsed.payment.amountLbp ?? undefined,
    p_note: text(formData, "note") || undefined,
  });
  if (error) return { error: errorMessage(error, "Couldn't record the payment.") };
  const { data: inv } = await supabase.from("invoices").select("member_id").eq("id", invoiceId).maybeSingle();
  if (inv) await sendReceipt(membership.gymId, membership.gymName, inv.member_id, parsed.payment.amountUsd, `payment:${paymentId}`);

  refresh();
  return { success: "Payment recorded." };
}

export async function voidInvoice(invoiceId: string): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  kickAccess(membership.gymId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: "Voided by staff" });
  if (error) return { error: errorMessage(error, "Couldn't void the invoice.") };
  refresh();
  return { success: "Invoice voided." };
}

export async function changeMembership(
  membershipId: string,
  action: "freeze" | "unfreeze" | "cancel",
): Promise<ActionState> {
  const { membership } = await requireStaff(action === "cancel" ? MANAGER_ROLES : BILLING_ROLES);
  kickAccess(membership.gymId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_membership", { p_membership_id: membershipId, p_action: action });
  if (error) return { error: errorMessage(error, "Couldn't update the membership.") };
  refresh();
  return { success: action === "freeze" ? "Membership frozen." : action === "unfreeze" ? "Membership resumed." : "Membership cancelled." };
}

export type MemberHit = {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  planName: string | null;
  endsOn: string | null;
};

export async function searchMembers(q: string): Promise<MemberHit[]> {
  const { membership } = await requireStaff(BILLING_ROLES);
  const term = q.replace(/[%,()*\\]/g, " ").trim();
  if (term.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_overview")
    .select("id, full_name, phone, status, plan_name, ends_on")
    .eq("gym_id", membership.gymId)
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,checkin_code.eq.${term.toUpperCase()}`)
    .order("full_name")
    .limit(8);
  return (data ?? []).map((m) => ({
    id: m.id!,
    fullName: m.full_name!,
    phone: m.phone,
    status: m.status ?? "none",
    planName: m.plan_name,
    endsOn: m.ends_on,
  }));
}

export type CheckInResult = {
  allowed: boolean;
  alreadyIn: boolean;
  reason: string | null;
  memberId: string | null;
  fullName: string | null;
  planName: string | null;
  endsOn: string | null;
  visitsLeft: number | null;
  balanceUsd: number;
  error?: string;
};

export async function checkIn(input: { code?: string; memberId?: string }): Promise<CheckInResult> {
  const { membership } = await requireStaff(BILLING_ROLES);
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("check_in", {
      p_gym_id: membership.gymId,
      p_code: input.code || undefined,
      p_member_id: input.memberId || undefined,
    })
    .single();

  refresh();
  if (error || !data) {
    return {
      allowed: false,
      alreadyIn: false,
      reason: null,
      memberId: null,
      fullName: null,
      planName: null,
      endsOn: null,
      visitsLeft: null,
      balanceUsd: 0,
      error: error ? errorMessage(error, "Check-in failed.") : "Check-in failed.",
    };
  }
  return {
    allowed: data.allowed,
    alreadyIn: data.already_in,
    reason: data.reason,
    memberId: data.member_id,
    fullName: data.full_name,
    planName: data.plan_name,
    endsOn: data.ends_on,
    visitsLeft: data.visits_left,
    balanceUsd: Number(data.balance_usd ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Admin controls (the database checks roles and logs each action)
// ---------------------------------------------------------------------------

export async function setArchived(memberId: string, archived: boolean): Promise<ActionState> {
  const { membership } = await requireStaff(BILLING_ROLES);
  kickAccess(membership.gymId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_archived", { p_member_id: memberId, p_archived: archived });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: archived ? "Member archived." : "Member restored." };
}

export async function deleteMember(memberId: string): Promise<ActionState> {
  await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_member", { p_member_id: memberId });
  if (error) return { error: errorMessage(error) };
  redirect("/dashboard/members");
}

export async function refundPayment(paymentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  kickAccess(membership.gymId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_payment", { p_payment_id: paymentId, p_reason: text(formData, "reason") });
  if (error) return { error: errorMessage(error, "Couldn't refund.") };
  refresh();
  return { success: "Payment refunded — the amount is owed again." };
}

export async function adjustMembership(membershipId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(MANAGER_ROLES);
  kickAccess(membership.gymId);
  const limitRaw = text(formData, "visit_limit");
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_membership", {
    p_membership_id: membershipId,
    p_starts_on: text(formData, "starts_on"),
    p_ends_on: text(formData, "ends_on"),
    p_visit_limit: limitRaw ? Number(limitRaw) : (null as unknown as number),
    p_visits_used: Number(text(formData, "visits_used") || "0"),
  });
  if (error) return { error: errorMessage(error, "Couldn't save.") };
  refresh();
  return { success: "Membership updated." };
}

export async function deleteCheckin(checkinId: string): Promise<ActionState> {
  await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_checkin", { p_checkin_id: checkinId });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: "Check-in deleted." };
}
