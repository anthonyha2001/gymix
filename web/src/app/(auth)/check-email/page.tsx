import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MailCheck } from "lucide-react";
import { Card, Skeleton, buttonClass } from "@/components/ui";
import { ResendButton } from "./resend-button";

export const metadata: Metadata = { title: "Check your email" };

// Big mail providers' inboxes, so people can jump straight there.
function inboxFor(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (["gmail.com", "googlemail.com"].includes(domain)) return { name: "Gmail", url: "https://mail.google.com/mail/u/0/#search/from%3Agymix" };
  if (["outlook.com", "hotmail.com", "live.com", "msn.com"].includes(domain)) return { name: "Outlook", url: "https://outlook.live.com/mail/0/" };
  if (["yahoo.com", "ymail.com"].includes(domain)) return { name: "Yahoo Mail", url: "https://mail.yahoo.com/" };
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) return { name: "iCloud Mail", url: "https://www.icloud.com/mail" };
  return null;
}

export default function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  return (
    <Card className="overflow-hidden">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <CheckEmail searchParams={searchParams} />
      </Suspense>
    </Card>
  );
}

async function CheckEmail({ searchParams }: { searchParams: PageProps<"/check-email">["searchParams"] }) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const kind = params.kind === "recovery" ? "recovery" : "signup";
  const inbox = inboxFor(email);

  return (
    <>
      <div className="bg-ink px-6 pt-8 pb-7 text-center text-white">
        <span className="relative mx-auto grid size-16 place-items-center rounded-2xl bg-brand text-ink">
          <MailCheck className="size-8" />
          <span className="absolute -top-1 -right-1 size-4 animate-ping rounded-full bg-brand/70 motion-reduce:hidden" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-white/70">
          {kind === "signup" ? "We sent you a link to confirm your email." : "We sent you a link to reset your password."}
        </p>
        {email && <p className="mt-3 inline-block max-w-full truncate rounded-full bg-white/10 px-3 py-1 text-sm font-medium">{email}</p>}
      </div>

      <div className="space-y-5 p-6">
        <ol className="space-y-3 text-sm">
          {[
            kind === "signup" ? "Open the email from Gymix." : "Open the email from Gymix.",
            kind === "signup" ? "Click “Confirm my email”." : "Click “Choose a new password”.",
            kind === "signup" ? "You land in Gymix, ready to set up your gym." : "Pick your new password and you're back in.",
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-brand">{i + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {inbox && (
          <a href={inbox.url} target="_blank" rel="noopener" className={buttonClass("primary", "h-11 w-full")}>
            Open {inbox.name}
          </a>
        )}

        <div className="rounded-xl bg-canvas p-4 text-sm">
          <p className="font-medium">Didn&apos;t get it?</p>
          <p className="mt-1 text-muted">It can take a minute. Check your spam or promotions folder too.</p>
          {email && <ResendButton email={email} kind={kind} />}
        </div>

        <p className="text-center text-sm text-muted">
          {kind === "signup" ? (
            <>
              Wrong email?{" "}
              <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
                Sign up again
              </Link>
            </>
          ) : (
            <>
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-ink underline underline-offset-4">
                Back to log in
              </Link>
            </>
          )}
        </p>
      </div>
    </>
  );
}
