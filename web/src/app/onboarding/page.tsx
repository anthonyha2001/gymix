import { formatPrice } from "@/lib/pricing";
import { getPricing } from "@/lib/pricing-server";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, Logo, Skeleton } from "@/components/ui";
import { homePathFor, requireViewer } from "@/lib/session";
import { promoteConfiguredSuperAdmin } from "@/lib/super-admin";
import { signOut } from "../(auth)/actions";
import { CreateGymForm } from "./create-gym-form";

export const metadata: Metadata = { title: "Set up your gym" };

export default async function OnboardingPage() {
  const pricing = await getPricing();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8 text-xl" />
      <div className="w-full max-w-md space-y-4">
        <Card className="p-6 space-y-5">
          <div>
            <h1 className="text-xl font-semibold">Set up your gym</h1>
            <p className="text-sm text-muted">You&apos;ll be the owner. You can invite your team and members next.</p>
            <p className="mt-3 inline-flex rounded-full bg-brand px-3 py-1 text-xs font-semibold">{pricing.trialDays} days free, then {formatPrice(pricing.priceUsd)}/month. No card needed.</p>
          </div>
          <Suspense fallback={<Skeleton className="h-24" />}>
            <OnboardingGate />
          </Suspense>
        </Card>
        <Card className="p-4 text-sm text-muted">
          <strong className="text-ink">Joining as a member or staff?</strong> Ask your gym to invite your email address,
          then log in again. You&apos;ll be taken straight in.
        </Card>
        <form action={signOut} className="text-center">
          <button className="text-sm text-muted underline underline-offset-4 hover:text-ink">Log out</button>
        </form>
      </div>
    </main>
  );
}

async function OnboardingGate() {
  const viewer = await requireViewer();
  if (viewer.memberships.length > 0) redirect(homePathFor(viewer));
  // Super admins don't need a gym, but may create one (their own, or a demo).
  const superAdmin = viewer.isPlatformAdmin || (await promoteConfiguredSuperAdmin(viewer.id, viewer.email));
  return (
    <>
      <CreateGymForm />
      {superAdmin && (
        <p className="text-sm text-muted">
          You&apos;re a Gymix super admin.{" "}
          <Link href="/admin" className="font-medium text-ink underline underline-offset-4">
            Back to the console
          </Link>
        </p>
      )}
    </>
  );
}
