import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Payment providers (or the small adapter written for one, e.g. a card gateway
// or Whish business account) confirm kiosk payments here, which activates the
// membership straight away.
//
//   POST /api/payments/webhook
//   X-Gymix-Signature: hex(HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw body))
//   {"gym_id": "...", "reference": "GX-4821", "amount_usd": 45, "provider_ref": "tx_123", "method": "card"}
//
// method is a Gymix payment method: card, whish, omt, bank_transfer or other.
// Answers {"result": "activated" | "already_paid" | "amount_too_low" | "unknown_reference" | ...}.

const METHODS = ["card", "whish", "omt", "bank_transfer", "other"] as const;

export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Payments webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  const given = (request.headers.get("x-gymix-signature") ?? "").trim().toLowerCase();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }

  let body: { gym_id?: string; reference?: string; amount_usd?: number; provider_ref?: string; method?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }
  const method = METHODS.find((m) => m === body.method);
  if (!body.gym_id || !/^[0-9a-f-]{36}$/.test(body.gym_id) || !body.reference || typeof body.amount_usd !== "number" || !method) {
    return Response.json({ error: "Send gym_id, reference, amount_usd and method." }, { status: 400 });
  }
  const { data, error } = await createAdminClient().rpc("provider_payment", {
    p_gym_id: body.gym_id,
    p_reference: body.reference,
    p_amount_usd: body.amount_usd,
    p_provider_ref: String(body.provider_ref ?? "").slice(0, 120),
    p_method: method,
  });
  if (error) return Response.json({ error: "Couldn't record the payment." }, { status: 500 });
  return Response.json({ result: data }, { status: data === "activated" || data === "already_paid" ? 200 : 422 });
}
