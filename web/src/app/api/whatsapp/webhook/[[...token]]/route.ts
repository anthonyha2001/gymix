import { createAdminClient } from "@/lib/supabase/admin";
import { gymixKeys } from "@/lib/whatsapp";
import { gymixVerifyToken, validSignature } from "@/lib/whatsapp-webhook";

// Delivery updates from Meta (sent, delivered, read, failed) for the messages
// in whatsapp_log. /api/whatsapp/webhook is the Gymix number's app;
// /api/whatsapp/webhook/<token> is a gym's own app (Settings → WhatsApp).
// Every update must be signed with that app's secret.

type Ctx = { params: Promise<{ token?: string[] }> };

async function appFor(token: string | undefined) {
  if (!token) {
    const keys = await gymixKeys();
    return keys?.appSecret ? { secret: keys.appSecret, verify: gymixVerifyToken(keys.appSecret) } : null;
  }
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await createAdminClient().from("gym_whatsapp_accounts").select("app_secret, webhook_token").eq("webhook_token", token).maybeSingle();
  return data?.app_secret ? { secret: data.app_secret, verify: data.webhook_token } : null;
}

// The handshake when the webhook is added in the Meta app.
export async function GET(request: Request, { params }: Ctx) {
  const url = new URL(request.url);
  const app = await appFor((await params).token?.[0]);
  if (app && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === app.verify) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type Status = { id?: string; status?: string; errors?: { title?: string; message?: string; error_data?: { details?: string } }[] };

export async function POST(request: Request, { params }: Ctx) {
  const app = await appFor((await params).token?.[0]);
  const raw = await request.text();
  if (!app || !validSignature(raw, request.headers.get("x-hub-signature-256"), app.secret)) {
    return new Response("Invalid signature", { status: 401 });
  }
  let body: { entry?: { changes?: { value?: { statuses?: Status[] } }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const admin = createAdminClient();
  let updated = 0;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        if (!s.id || !s.status) continue;
        const e = s.errors?.[0];
        const { data } = await admin.rpc("whatsapp_status_update", {
          p_wa_message_id: s.id,
          p_status: s.status,
          p_error: e ? (e.error_data?.details || e.message || e.title || "Failed") : undefined,
        });
        if (data) updated++;
      }
    }
  }
  // Always 200 once verified, so Meta doesn't retry messages Gymix didn't send.
  return Response.json({ updated });
}
