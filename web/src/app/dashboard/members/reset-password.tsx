"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { LoginDetails, loginMessage } from "@/components/login-details";
import { Alert, Button } from "@/components/ui";
import { resetMemberPassword, type ResetResult } from "@/app/member-login-actions";
import { sendLoginOnWhatsApp } from "@/app/whatsapp-actions";

// Generates a new app password for the member and shows it to hand over.
export function ResetPassword({ memberId, firstName, phone, whatsapp, gymName, loginUrl }: { memberId: string; firstName: string; phone: string | null; whatsapp: boolean; gymName: string; loginUrl: string }) {
  const [result, setResult] = useState<ResetResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.password && result.loginId && result.code) {
    const login = { loginId: result.loginId, code: result.code, password: result.password };
    return (
      <div className="space-y-3">
        <Alert tone="success">New password set. The old one no longer works.</Alert>
        <LoginDetails
          {...login}
          phone={phone}
          message={loginMessage({ firstName, gymName, loginUrl, ...login })}
          send={whatsapp ? () => sendLoginOnWhatsApp(memberId, login.password) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result?.error && <Alert tone="error">{result.error}</Alert>}
      <p className="text-sm text-muted">
        Gymix makes a new password and shows it here once, ready to send to them on WhatsApp. The member&apos;s old password stops working.
      </p>
      <Button onClick={() => startTransition(async () => setResult(await resetMemberPassword(memberId)))} disabled={pending} className="w-full">
        <KeyRound className="size-4" /> {pending ? "Generating…" : "Generate a new password"}
      </Button>
    </div>
  );
}
