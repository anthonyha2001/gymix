import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// TEMPORARY: helps find a deployment misconfiguration. Super admins only.
// Reports what kind of keys are set (never the keys) and whether the server's
// database calls carry the signed-in user.
function kind(value: string | undefined) {
  if (!value) return "missing";
  if (value.startsWith("sb_publishable_")) return "publishable key";
  if (value.startsWith("sb_secret_")) return "secret key";
  if (value.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
      return `legacy JWT (role: ${payload.role}, ref: ${payload.ref})`;
    } catch {
      return "JWT (unreadable)";
    }
  }
  return `other (${value.length} chars)`;
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isPlatformAdmin) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const [{ data: isAdmin, error: adminError }, { data: uid, error: uidError }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase.from("profiles").select("id").eq("id", viewer.id).maybeSingle(),
  ]);
  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "missing",
    anonKey: kind(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceKey: kind(process.env.SUPABASE_SERVICE_ROLE_KEY),
    otherSupabaseVars: Object.keys(process.env).filter((k) => /SUPABASE/i.test(k)).sort(),
    viewerId: viewer.id,
    rpcIsPlatformAdmin: adminError ? `error ${adminError.code}: ${adminError.message}` : isAdmin,
    ownProfileVisible: uidError ? `error ${uidError.code}: ${uidError.message}` : Boolean(uid),
  });
}
