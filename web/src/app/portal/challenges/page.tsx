import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { hasFeature } from "@/lib/features";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { MemberChallenge } from "@/lib/challenges";
import { ChallengesView } from "./challenges-view";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
        <p className="text-sm text-muted">Swipe right to join. Your visits and workouts count automatically.</p>
      </div>
      <Suspense fallback={<Skeleton className="mx-auto h-[25rem] max-w-sm rounded-[1.75rem]" />}>
        <Challenges />
      </Suspense>
    </div>
  );
}

async function Challenges() {
  const { membership } = await requireMember();
  if (!(await hasFeature(membership.gymId, "challenges"))) redirect("/portal");
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_challenges", { p_gym_id: membership.gymId });
  return <ChallengesView challenges={(data ?? []) as unknown as MemberChallenge[]} />;
}
