import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The home-screen widget's data. The widget sends its token (from the app)
// as "Authorization: Bearer gw_…"; the answer is a small summary of that
// person's day. Read-only.
export async function GET(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^gw_[0-9a-f]{64}$/.test(token)) return NextResponse.json({ error: "No widget token" }, { status: 401 });
  try {
    const { data, error } = await createAdminClient().rpc("widget_data", { p_token: token });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Open Gymix to connect the widget again" }, { status: 401 });
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Try again soon" }, { status: 503 });
  }
}
