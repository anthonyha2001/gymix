import { createAdminClient } from "@/lib/supabase/admin";
import { hasFeature } from "@/lib/features";

// The kiosk's only door into Gymix: POST {action, ...} with the kiosk's token
// in the URL. Every action goes through a database function that checks the
// kiosk is on, what it may do, and how often it is asked.

type Body =
  | { action: "info" }
  | { action: "find"; query: string }
  | { action: "checkin"; memberId: string }
  | { action: "join"; fullName: string; phone: string; email?: string }
  | { action: "buy"; memberId: string; planId: string; channel: string }
  | { action: "status"; intentId: string };

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) return reply({ error: "This kiosk link isn't valid." }, 404);
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return reply({ error: "Bad request" }, 400);
  }
  const db = createAdminClient();
  const { data: kiosk } = await db.from("kiosks").select("gym_id").eq("token", token).maybeSingle();
  if (!kiosk || !(await hasFeature(kiosk.gym_id, "self_service"))) return reply({ error: "This kiosk is switched off or was removed." }, 404);

  const call = async (fn: PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>) => {
    const { data, error } = await fn;
    if (error) {
      const friendly = error.code === "22023" || error.code === "P0002";
      return reply({ error: friendly ? error.message : "Something went wrong. Please ask at the front desk." }, friendly ? 400 : 503);
    }
    return reply({ data });
  };

  switch (body.action) {
    case "info":
      return call(db.rpc("kiosk_info", { p_token: token }));
    case "find":
      return call(db.rpc("kiosk_find_member", { p_token: token, p_query: String(body.query ?? "").slice(0, 40) }));
    case "checkin":
      if (!uuid(body.memberId)) return reply({ error: "Bad request" }, 400);
      return call(db.rpc("kiosk_check_in", { p_token: token, p_member_id: body.memberId }));
    case "join":
      return call(
        db.rpc("kiosk_join", {
          p_token: token,
          p_full_name: String(body.fullName ?? "").slice(0, 140),
          p_phone: String(body.phone ?? "").slice(0, 30),
          p_email: body.email ? String(body.email).slice(0, 120) : undefined,
        }),
      );
    case "buy":
      if (!uuid(body.memberId) || !uuid(body.planId)) return reply({ error: "Bad request" }, 400);
      return call(db.rpc("kiosk_start_purchase", { p_token: token, p_member_id: body.memberId, p_plan_id: body.planId, p_channel: String(body.channel) }));
    case "status":
      if (!uuid(body.intentId)) return reply({ error: "Bad request" }, 400);
      return call(db.rpc("kiosk_intent_status", { p_token: token, p_intent_id: body.intentId }));
    default:
      return reply({ error: "Bad request" }, 400);
  }
}
