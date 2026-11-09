import { cleanupDemos } from "@/lib/demo";

// Daily (vercel.json): deletes sample gyms past their 24 hours. Each new demo
// also cleans up a few, so this only catches what's left over.
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  let removed = 0;
  for (let i = 0; i < 8; i++) {
    const n = await cleanupDemos(25);
    removed += n;
    if (n < 25) break;
  }
  return Response.json({ removed });
}
