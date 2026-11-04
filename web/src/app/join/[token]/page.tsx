import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Logo, Skeleton, buttonClass } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../../dashboard/members/action-button";
import { signOut } from "../../(auth)/actions";
import { acceptInvite, joinWithLink } from "./actions";

export const metadata: Metadata = { title: "You're invited" };

// Opened from an invite link (WhatsApp, SMS…). Public: the token is the secret.
export default function JoinPage({ params }: PageProps<"/join/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-sm">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Invite params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Invite({ params }: { params: PageProps<"/join/[token]">["params"] }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: invite }, viewer] = await Promise.all([
    supabase.rpc("invite_preview", { p_token: token }).maybeSingle(),
    getViewer(),
  ]);

  if (!invite) {
    return (
      <Card className="space-y-2 p-6 text-center">
        <h1 className="text-lg font-semibold">This link isn&apos;t valid</h1>
        <p className="text-sm text-muted">Ask your gym to send you a new invite.</p>
      </Card>
    );
  }
  if (invite.expired && !invite.accepted) {
    return (
      <Card className="space-y-2 p-6 text-center">
        <h1 className="text-lg font-semibold">This invite has expired</h1>
        <p className="text-sm text-muted">Ask {invite.gym_name} to send you a new link.</p>
      </Card>
    );
  }

  const here = `/join/${token}`;
  const firstName = invite.member_name?.split(" ")[0];
  const email = invite.email ? `&email=${encodeURIComponent(invite.email)}` : "";

  return (
    <Card className="space-y-5 p-6">
      <div className="space-y-1 text-center">
        <p className="text-sm text-muted">{firstName ? `Hi ${firstName}! You're invited to` : "You're invited to"}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{invite.gym_name}</h1>
        <p className="text-sm text-muted">
          {invite.role === "member"
            ? "See your membership, program and invoices, book classes and check in with a tap."
            : `Join the team as ${ROLE_LABELS[invite.role]}.`}
        </p>
      </div>

      {viewer ? (
        <div className="space-y-3">
          <ActionButton action={acceptInvite.bind(null, token)} label={`Join ${invite.gym_name}`} variant="primary" className="h-11 w-full" />
          <div className="text-center text-xs text-muted">
            Signed in as {viewer.email}.{" "}
            <form action={signOut} className="inline">
              <button className="underline underline-offset-2">Use another account</button>
            </form>
          </div>
        </div>
      ) : invite.role === "member" && invite.accepted ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted">This link was already used. Log in, or ask the gym for a new link.</p>
          <Link href={`/login?next=${encodeURIComponent("/portal")}`} className={buttonClass("primary", "h-11 w-full")}>
            Log in
          </Link>
        </div>
      ) : invite.role === "member" ? (
        // The link is the credential: one tap opens the portal, nothing to type.
        <div className="space-y-3">
          <ActionButton action={joinWithLink.bind(null, token)} label="Open my portal" variant="primary" className="h-11 w-full" />
          <p className="text-center text-xs text-muted">
            Already have a Gymix account?{" "}
            <Link href={`/login?next=${encodeURIComponent(here)}${email}`} className="underline underline-offset-2">
              Log in
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Link href={`/signup?next=${encodeURIComponent(here)}${email}`} className={buttonClass("primary", "h-11 w-full")}>
            Create my account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(here)}${email}`} className={buttonClass("secondary", "h-11 w-full")}>
            I already have an account
          </Link>
        </div>
      )}
    </Card>
  );
}
