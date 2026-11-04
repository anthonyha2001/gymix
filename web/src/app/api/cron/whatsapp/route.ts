import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { firstName, sendWhatsApp, whatsappConfigured } from "@/lib/whatsapp";

// Daily (vercel.json): renewal reminders for memberships ending in each gym's
// "remind N days before" setting. Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!whatsappConfigured()) return Response.json({ sent: 0, skipped: "WhatsApp is not configured" });

  const { data, error } = await createAdminClient().rpc("renewal_reminders_due");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  for (const r of data ?? []) {
    await sendWhatsApp({
      kind: "renewal",
      ref: `${r.membership_id}:${r.ends_on}`,
      gymId: r.gym_id,
      memberId: r.member_id,
      phone: r.phone,
      params: [firstName(r.full_name), r.gym_name, formatDate(r.ends_on)],
    });
  }
  return Response.json({ due: data?.length ?? 0 });
}
