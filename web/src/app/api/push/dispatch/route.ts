import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchNotification } from "@/lib/push/server";

// Called by the database (pg_net) right after a notification is created:
// sends it to the person's phones. Guarded by a secret only the database and
// the server know.
export async function POST(request: NextRequest) {
  const given = request.headers.get("x-push-secret") ?? "";
  let expected = "";
  try {
    const { data } = await createAdminClient().from("platform_secrets").select("push_dispatch_secret").single();
    expected = data?.push_dispatch_secret ?? "";
  } catch {
    return NextResponse.json({ error: "Push isn't set up" }, { status: 503 });
  }
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  return NextResponse.json(await dispatchNotification(id));
}
