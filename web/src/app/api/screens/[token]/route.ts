import { createAdminClient } from "@/lib/supabase/admin";
import { mediaUrl } from "@/lib/exercises";

// What one screen shows right now (polled by /screen/<token> every minute).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!/^[0-9a-f]{64}$/.test(token)) return Response.json({ error: "Unknown screen" }, { status: 404, headers });
  const { data, error } = await createAdminClient().rpc("screen_feed", { p_token: token });
  if (error) return Response.json({ error: "Unavailable" }, { status: 503, headers });
  if (!data) return Response.json({ error: "This screen is switched off or was removed." }, { status: 404, headers });
  const feed = data as { slides: { image_path: string | null }[] };
  return Response.json(
    { ...feed, slides: feed.slides.map((s) => ({ ...s, image_url: s.image_path ? mediaUrl(s.image_path) : null })) },
    { headers },
  );
}
