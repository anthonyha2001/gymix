import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberHome } from "@/components/member-home";
import { Card, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { readNewLogin } from "@/lib/member-login";
import { requestOrigin } from "@/lib/origin";
import { NewLoginDialog } from "./new-login-dialog";
import { MachineSheet } from "@/components/machine-sheet";
import { accountStatus } from "@/lib/portal";
import { formatUSD } from "@/lib/format";
import { Lock, Nfc } from "lucide-react";

export const metadata: Metadata = { title: "My gym" };

export default function PortalPage({ searchParams }: PageProps<"/portal">) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-80" />}>
        <PortalContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PortalContent({ searchParams }: { searchParams: PageProps<"/portal">["searchParams"] }) {
  const { machine } = await searchParams;
  const { viewer, membership } = await requireMember();
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) {
    return <Card className="p-5 text-sm text-muted">Your account isn&apos;t linked to a membership yet. Ask the front desk.</Card>;
  }
  const [newLogin, account] = await Promise.all([
    readNewLogin(),
    accountStatus(membership.gymId),
  ]);
  return (
    <>
      {newLogin && (
        <NewLoginDialog
          login={newLogin}
          firstName={viewer.fullName.split(" ")[0] || "there"}
          gymName={membership.gymName}
          loginUrl={`${await requestOrigin()}/login`}
        />
      )}
      {typeof machine === "string" && !account.locked && <MachineSheet machineId={machine} viewer={viewer} />}
      {account.frozen && <FrozenNotice owed={account.overdueUsd || account.balanceUsd} />}
      {!account.frozen && account.locked && <InactiveNotice status={account.membership} />}
      <MemberHome supabase={supabase} memberId={me.id} gymName={membership.gymName} timeZone={membership.timezone} />

    </>
  );
}

// Shown while the account is frozen for an unpaid balance.
function FrozenNotice({ owed }: { owed: number }) {
  return (
    <section role="alert" className="mb-6 overflow-hidden rounded-2xl border border-danger/25 bg-danger-soft">
      <div className="flex gap-4 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-danger text-white">
          <Lock className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-danger">Your account is frozen</h2>
          <p className="text-sm text-ink">
            {owed > 0 ? <>You have an unpaid balance of <strong>{formatUSD(owed)}</strong>. </> : null}
            Until it is paid, only this page is open.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-danger/15 bg-surface/60 px-5 py-3 text-sm">
        <Nfc className="size-5 shrink-0 text-muted" />
        <span>Pay at the front desk, then tap the check-in sticker at the entrance to unfreeze it.</span>
      </div>
    </section>
  );
}

// No active membership: only this page is open until they renew.
function InactiveNotice({ status }: { status: string }) {
  const text: Record<string, string> = {
    none: "You don't have a membership yet.",
    expired: "Your membership has ended.",
    frozen: "Your membership is paused.",
    upcoming: "Your membership hasn't started yet.",
    used_up: "You've used all the visits on your membership.",
  };
  return (
    <section role="alert" className="mb-6 flex gap-4 rounded-2xl border border-line bg-surface p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas">
        <Lock className="size-5" />
      </span>
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-semibold">{text[status] ?? "Your membership isn't active."}</h2>
        <p className="text-sm text-muted">Until it&apos;s active, only this page is open. Renew at the front desk and everything opens again.</p>
      </div>
    </section>
  );
}
