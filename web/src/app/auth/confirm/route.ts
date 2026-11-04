import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { logAuthEvent } from "@/lib/telemetry-server";

// Target of the email confirmation link.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await logAuthEvent({ kind: "login", path: "/auth/confirm", user_id: data.user?.id ?? null, message: "email link", detail: { type } });
      redirect("/start");
    }
    await logAuthEvent({ kind: "login_failed", path: "/auth/confirm", message: "email link", detail: { reason: error.code ?? "invalid or expired link", type } });
  }

  redirect("/login?error=link");
}
