"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/dialog";
import { LoginDetails, loginMessage } from "@/components/login-details";
import { Button } from "@/components/ui";
import type { NewLogin } from "@/lib/member-login";
import { dismissNewLogin } from "@/app/member-login-actions";
import { sendMyLoginOnWhatsApp } from "@/app/whatsapp-actions";

// Shown once after joining by link: the generated login, to save for later.
export function NewLoginDialog({ login, firstName, gymName, loginUrl, phone, whatsapp }: { login: NewLogin; firstName: string; gymName: string; loginUrl: string; phone: string | null; whatsapp: boolean }) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  // Close only once the details are forgotten, so a reload can't bring them back.
  const close = () =>
    startTransition(async () => {
      await dismissNewLogin();
      setOpen(false);
    });

  return (
    <Modal open={open} onClose={close} title="Your login" description="You're signed in on this phone. Save these to log in on another device.">
      <div className="space-y-5">
        <LoginDetails
          {...login}
          phone={phone}
          message={loginMessage({ firstName, gymName, loginUrl, ...login })}
          send={whatsapp ? sendMyLoginOnWhatsApp : undefined}
          sendLabel="Send to my WhatsApp"
        />
        <p className="text-xs text-muted">Lost it later? The front desk can give you a new password.</p>
        <Button onClick={close} disabled={pending} className="w-full">
          I&apos;ve saved it
        </Button>
      </div>
    </Modal>
  );
}
