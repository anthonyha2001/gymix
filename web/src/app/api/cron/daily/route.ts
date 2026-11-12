import { createAdminClient } from "@/lib/supabase/admin";

// Every evening (vercel.json, 18:00 UTC = 20:00 or 21:00 in Beirut):
//   * win-back nudges to members who stopped coming
//   * the owners' and managers' summary of the day
// Each becomes a notification, and a push on phones that allow it.
// Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const admin = createAdminClient();
  const [winbacks, summaries] = await Promise.all([admin.rpc("send_winbacks"), admin.rpc("send_daily_summaries")]);
  return Response.json({
    winbacks: winbacks.error ? winbacks.error.message : winbacks.data,
    summaries: summaries.error ? summaries.error.message : summaries.data,
  });
}
