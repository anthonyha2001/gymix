import type { Metadata } from "next";
import { Suspense } from "react";
import { MemberHome } from "@/components/member-home";
import { Card, Skeleton } from "@/components/ui";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { readNewLogin } from "@/lib/member-login";
import { requestOrigin } from "@/lib/origin";
import { NewLoginDialog } from "./new-login-dialog";
import { WeeklyChart } from "@/components/weekly-chart";
import { loadWeeklyBars } from "@/lib/weekly";

export const metadata: Metadata = { title: "My gym" };

export default function PortalPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-80" />}>
        <PortalContent />
      </Suspense>
    </div>
  );
}

async function PortalContent() {
  const { viewer, membership } = await requireMember();
  const supabase = await createClient();
  const { data: me } = await supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle();
  if (!me) {
    return <Card className="p-5 text-sm text-muted">Your account isn&apos;t linked to a membership yet. Ask the front desk.</Card>;
  }
  const [newLogin, weeks] = await Promise.all([readNewLogin(), loadWeeklyBars(supabase, me.id, membership.timezone)]);
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
      <MemberHome supabase={supabase} memberId={me.id} gymName={membership.gymName} timeZone={membership.timezone} />
      <Card className="mt-6 p-5">
        <WeeklyChart weeks={weeks} />
      </Card>
    </>
  );
}
