import { syncAllSocial } from "@/lib/social";

// Daily (vercel.json): refreshes posts, followers and audience for every
// connected social account. Vercel sends CRON_SECRET as a bearer token.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ synced: await syncAllSocial() });
}
