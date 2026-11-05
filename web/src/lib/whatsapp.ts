import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { waNumber } from "@/lib/invite-link";
import { hasFeature } from "@/lib/features";

// Automatic WhatsApp messages from the one Gymix number, through Meta's
// WhatsApp Cloud API. Each kind is a template approved in WhatsApp Manager
// (English), with its {{1}}, {{2}}… filled from `params` in order:
//   gymix_renewal_reminder  Hi {{1}}, your {{2}} membership ends on {{3}}. Renew at the front desk to keep training.
//   gymix_payment_received  Hi {{1}}, {{2}} received your payment of {{3}}. Thank you!
//   gymix_member_welcome    Hi {{1}}, {{2}} has set up your Gymix account. Open your portal: {{3}}
// The keys come from the super admin console (or WHATSAPP_TOKEN /
// WHATSAPP_PHONE_NUMBER_ID); without them nothing is sent.
const TEMPLATES = {
  renewal: "gymix_renewal_reminder",
  payment: "gymix_payment_received",
  welcome: "gymix_member_welcome",
} as const;

export type WhatsAppKind = keyof typeof TEMPLATES;

// The approved template text, filled in: what the member reads (kept in the log).
const BODIES: Record<WhatsAppKind, (p: string[]) => string> = {
  renewal: (p) => `Hi ${p[0]}, your ${p[1]} membership ends on ${p[2]}. Renew at the front desk to keep training.`,
  payment: (p) => `Hi ${p[0]}, ${p[1]} received your payment of ${p[2]}. Thank you!`,
  welcome: (p) => `Hi ${p[0]}, ${p[1]} has set up your Gymix account. Open your portal: ${p[2]}`,
};

export const whatsappKeys = cache(async (): Promise<{ token: string; phoneNumberId: string } | null> => {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { token: process.env.WHATSAPP_TOKEN, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient().from("platform_secrets").select("whatsapp_token, whatsapp_phone_number_id").maybeSingle();
  return data?.whatsapp_token && data.whatsapp_phone_number_id ? { token: data.whatsapp_token, phoneNumberId: data.whatsapp_phone_number_id } : null;
});

export async function whatsappConfigured() {
  return (await whatsappKeys()) !== null;
}

// Sends one message, at most once per (kind, ref). Never throws: a failure is
// kept in whatsapp_log so staff can see it.
export async function sendWhatsApp(msg: {
  kind: WhatsAppKind;
  ref: string;
  gymId: string;
  memberId: string;
  phone: string | null;
  params: string[];
}) {
  const to = waNumber(msg.phone);
  const keys = await whatsappKeys();
  if (!to || !keys || !(await hasFeature(msg.gymId, "whatsapp"))) return;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("whatsapp_log")
    .upsert({ gym_id: msg.gymId, member_id: msg.memberId, kind: msg.kind, ref: msg.ref, body: BODIES[msg.kind](msg.params) }, { onConflict: "kind,ref", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (!row) return; // already sent

  let error: string | null = null;
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${keys.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${keys.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: TEMPLATES[msg.kind],
          language: { code: "en" },
          components: [{ type: "body", parameters: msg.params.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (!res.ok) error = ((await res.json().catch(() => null))?.error?.message as string | undefined) ?? `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : "Network error";
  }
  await admin.from("whatsapp_log").update({ status: error ? "failed" : "sent", error }).eq("id", row.id);
}

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;
