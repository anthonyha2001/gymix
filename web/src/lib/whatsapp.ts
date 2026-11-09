import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { waNumber } from "@/lib/invite-link";
import { hasFeature } from "@/lib/features";
import { TEMPLATES, templateBody, type WhatsAppKind } from "@/lib/whatsapp-templates";

// Automatic WhatsApp messages through Meta's WhatsApp Cloud API, sent either
// from the Gymix number (the default; keys in the super admin console or
// WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID) or from the gym's own WhatsApp
// Business number (Settings → WhatsApp). A gym on its own number falls back to
// the Gymix number for any template its account hasn't had approved yet, so
// nothing stops going out while Meta reviews. Every message is logged.

// WHATSAPP_GRAPH_URL only points tests at a mock of the Meta API.
const GRAPH = process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com/v21.0";

export type SenderKind = "gymix" | "own";
type Keys = { token: string; phoneNumberId: string };

export const gymixKeys = cache(async (): Promise<(Keys & { wabaId: string; appSecret: string }) | null> => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createAdminClient()
    .from("platform_secrets")
    .select("whatsapp_token, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_app_secret")
    .maybeSingle();
  const token = process.env.WHATSAPP_TOKEN || data?.whatsapp_token || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || data?.whatsapp_phone_number_id || "";
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    wabaId: process.env.WHATSAPP_WABA_ID || data?.whatsapp_waba_id || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || data?.whatsapp_app_secret || "",
  };
});

const gymSetup = cache(async (gymId: string) => {
  const admin = createAdminClient();
  const [{ data: gym }, { data: account }] = await Promise.all([
    admin.from("gyms").select("whatsapp_sender").eq("id", gymId).maybeSingle(),
    admin.from("gym_whatsapp_accounts").select("token, phone_number_id, templates").eq("gym_id", gymId).maybeSingle(),
  ]);
  return { sender: (gym?.whatsapp_sender ?? "gymix") as SenderKind, account };
});

// Who sends this kind of message for this gym, or null when nobody can.
export async function senderFor(gymId: string, kind: WhatsAppKind): Promise<(Keys & { kind: SenderKind }) | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { sender, account } = await gymSetup(gymId);
  const approved = (account?.templates as Record<string, string> | null)?.[TEMPLATES[kind]] === "APPROVED";
  if (sender === "own" && account && approved) return { kind: "own", token: account.token, phoneNumberId: account.phone_number_id };
  const gymix = await gymixKeys();
  return gymix ? { kind: "gymix", token: gymix.token, phoneNumberId: gymix.phoneNumberId } : null;
}

// Whether this gym can send WhatsApp messages at all (any template).
export async function whatsappReady(gymId: string) {
  if (!(await hasFeature(gymId, "whatsapp"))) return false;
  return (await senderFor(gymId, "payment")) !== null || (await senderFor(gymId, "welcome")) !== null;
}

export type SendResult = { status: "sent" | "failed" | "skipped"; error?: string };

// Sends one message, at most once per (kind, ref). Never throws: a failure is
// kept in whatsapp_log for the owner's log and the member's chat.
export async function sendWhatsApp(msg: {
  kind: WhatsAppKind;
  ref: string;
  gymId: string;
  memberId: string;
  phone: string | null;
  params: string[];
  sentBy?: string;
}): Promise<SendResult> {
  const to = waNumber(msg.phone);
  if (!to) return { status: "skipped", error: "No valid WhatsApp number." };
  if (!(await hasFeature(msg.gymId, "whatsapp"))) return { status: "skipped", error: "WhatsApp is off for this gym." };
  const sender = await senderFor(msg.gymId, msg.kind);
  if (!sender) return { status: "skipped", error: "WhatsApp isn't set up yet." };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("whatsapp_log")
    .upsert(
      {
        gym_id: msg.gymId,
        member_id: msg.memberId,
        kind: msg.kind,
        ref: msg.ref,
        // The log never keeps a password (staff can read it): masked there only.
        body: templateBody(msg.kind, msg.kind === "login" ? msg.params.map((p, i) => (i === 3 ? "••••-••••-••••" : p)) : msg.params),
        phone: `+${to}`,
        sender: sender.kind,
        sent_by: msg.sentBy ?? null,
      },
      { onConflict: "kind,ref", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (!row) return { status: "skipped", error: "Already sent." };

  let error: string | null = null;
  let messageId: string | null = null;
  try {
    const res = await fetch(`${GRAPH}/${sender.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sender.token}`, "Content-Type": "application/json" },
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
    const json = await res.json().catch(() => null);
    if (res.ok) messageId = json?.messages?.[0]?.id ?? null;
    else error = metaError(json, res.status);
  } catch (e) {
    error = e instanceof Error ? e.message : "Network error";
  }
  await admin
    .from("whatsapp_log")
    .update({ status: error ? "failed" : "sent", error, wa_message_id: messageId, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  return error ? { status: "failed", error } : { status: "sent" };
}

function metaError(json: unknown, status: number) {
  const e = (json as { error?: { message?: string; error_user_msg?: string } } | null)?.error;
  return e?.error_user_msg || e?.message || `HTTP ${status}`;
}

async function graph<T>(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: init?.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return res.ok ? { data: json as T } : { error: metaError(json, res.status) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Network error" };
  }
}

// The number behind a phone number ID: proves the keys work.
export async function checkNumber(phoneNumberId: string, token: string) {
  return graph<{ display_phone_number?: string; verified_name?: string }>(`${phoneNumberId}?fields=display_phone_number,verified_name`, token);
}

// Reads the Gymix templates on a WhatsApp Business account and creates any that
// are missing (Meta then reviews them, usually within minutes). Returns each
// template's status: APPROVED, PENDING, REJECTED…
export async function ensureTemplates(wabaId: string, token: string): Promise<{ templates: Record<string, string>; error?: string }> {
  const list = await graph<{ data: { name: string; status: string; language: string }[] }>(
    `${wabaId}/message_templates?fields=name,status,language&limit=200`,
    token,
  );
  if (list.error) return { templates: {}, error: list.error };
  const templates: Record<string, string> = {};
  for (const t of list.data?.data ?? []) {
    if (t.language === "en" && Object.values(TEMPLATES).includes(t.name as never)) templates[t.name] = t.status;
  }
  let error: string | undefined;
  for (const kind of Object.keys(TEMPLATES) as WhatsAppKind[]) {
    const name = TEMPLATES[kind];
    if (templates[name] || kind === "invite") continue; // the invite reuses the welcome template
    const created = await graph<{ status?: string }>(`${wabaId}/message_templates`, token, {
      method: "POST",
      body: {
        name,
        category: "UTILITY",
        language: "en",
        components: [{ type: "BODY", text: templateBody(kind, null), example: { body_text: [EXAMPLES[kind]] } }],
      },
    });
    if (created.error) error ??= `${name}: ${created.error}`;
    else templates[name] = created.data?.status ?? "PENDING";
  }
  return { templates, error };
}

const EXAMPLES: Record<WhatsAppKind, string[]> = {
  renewal: ["Lea", "Iron House", "12 Dec 2026"],
  payment: ["Lea", "Iron House", "$45.00"],
  welcome: ["Lea", "Iron House", "https://gymix.app/join/abc123"],
  invite: ["Lea", "Iron House", "https://gymix.app/join/abc123"],
  login: ["Lea", "Iron House", "71 123 456", "abcd-efgh-jkmn", "https://gymix.app/login"],
};

export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] || fullName;
