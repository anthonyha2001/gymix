"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/session";
import { errorMessage, text, type ActionState } from "@/lib/action-result";
import { checkNumber, ensureTemplates } from "@/lib/whatsapp";

// Settings → WhatsApp (owner only). The account row is server-only: it is
// written with the service role after the owner check.

const ID_RE = /^\d{6,25}$/;

export async function connectWhatsApp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const phoneNumberId = text(formData, "phone_number_id").replace(/\s/g, "");
  const wabaId = text(formData, "waba_id").replace(/\s/g, "");
  const token = text(formData, "token").replace(/\s/g, "");
  if (!ID_RE.test(phoneNumberId)) return { error: "The phone number ID is the long number under your number in WhatsApp Manager → API setup." };
  if (!ID_RE.test(wabaId)) return { error: "The WhatsApp Business account ID is the long number at the top of WhatsApp Manager." };
  if (token.length < 50) return { error: "Paste the full access token (it starts with EAA)." };

  const number = await checkNumber(phoneNumberId, token);
  if (number.error) return { error: `Meta didn't accept these keys: ${number.error}` };
  const { templates, error: templateError } = await ensureTemplates(wabaId, token);

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("gym_whatsapp_accounts").upsert({
    gym_id: membership.gymId,
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    token,
    display_phone: number.data?.display_phone_number ?? null,
    verified_name: number.data?.verified_name ?? null,
    templates,
    last_error: templateError ?? null,
    checked_at: now,
    updated_at: now,
  });
  if (error) return { error: errorMessage(error, "Couldn't save the connection.") };
  await admin.from("gyms").update({ whatsapp_sender: "own" }).eq("id", membership.gymId);
  await (await createClient()).rpc("log_activity", {
    p_gym_id: membership.gymId,
    p_action: "whatsapp.connected",
    p_summary: `Connected WhatsApp number ${number.data?.display_phone_number ?? phoneNumberId}`,
  });
  refresh();
  if (templateError) return { error: `Connected, but a template couldn't be created: ${templateError}. Messages keep going from the Gymix number meanwhile.` };
  return { success: "Connected. Each message switches to your number as soon as Meta approves its template, usually within minutes." };
}

// Re-reads the number and the templates' review status from Meta.
export async function checkWhatsApp(): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const admin = createAdminClient();
  const { data: account } = await admin.from("gym_whatsapp_accounts").select("phone_number_id, waba_id, token").eq("gym_id", membership.gymId).maybeSingle();
  if (!account) return { error: "Connect your number first." };
  const number = await checkNumber(account.phone_number_id, account.token);
  const { templates, error: templateError } = number.error ? { templates: null, error: undefined } : await ensureTemplates(account.waba_id, account.token);
  const lastError = number.error ? `Meta: ${number.error}` : (templateError ?? null);
  await admin
    .from("gym_whatsapp_accounts")
    .update({
      ...(number.data ? { display_phone: number.data.display_phone_number ?? null, verified_name: number.data.verified_name ?? null } : {}),
      ...(templates ? { templates } : {}),
      last_error: lastError,
      checked_at: new Date().toISOString(),
    })
    .eq("gym_id", membership.gymId);
  refresh();
  return lastError ? { error: lastError } : { success: "Up to date." };
}

export async function setWhatsAppSender(sender: "gymix" | "own"): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const { error } = await (await createClient()).rpc("set_whatsapp_sender", { p_gym_id: membership.gymId, p_sender: sender });
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: sender === "own" ? "Messages now go out from your number." : "Messages now go out from the Gymix number." };
}

export async function disconnectWhatsApp(): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const admin = createAdminClient();
  await admin.from("gyms").update({ whatsapp_sender: "gymix" }).eq("id", membership.gymId);
  const { error } = await admin.from("gym_whatsapp_accounts").delete().eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error) };
  await (await createClient()).rpc("log_activity", { p_gym_id: membership.gymId, p_action: "whatsapp.disconnected", p_summary: "Disconnected the gym's WhatsApp number" });
  refresh();
  return { success: "Disconnected. Messages go out from the Gymix number again." };
}

// The Meta app secret lets Gymix accept delivered/read updates for this number.
export async function saveWhatsAppAppSecret(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { membership } = await requireStaff(["owner"]);
  const secret = text(formData, "app_secret").replace(/\s/g, "");
  if (secret && !/^[0-9a-f]{32}$/i.test(secret)) return { error: "The app secret is 32 letters and numbers, from your Meta app → App settings → Basic." };
  const { error } = await createAdminClient().from("gym_whatsapp_accounts").update({ app_secret: secret || null }).eq("gym_id", membership.gymId);
  if (error) return { error: errorMessage(error) };
  refresh();
  return { success: secret ? "Saved. Delivered and read ticks will show in the log." : "Removed." };
}
