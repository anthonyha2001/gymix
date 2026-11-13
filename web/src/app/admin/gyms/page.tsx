import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { getPricing } from "@/lib/pricing-server";
import { createClient } from "@/lib/supabase/server";
import { GymsView, type HealthRow } from "./view";

export const metadata: Metadata = { title: "Gyms" };

// Every gym's health at a glance, and one click into any of them.
export default function GymsPage({ searchParams }: PageProps<"/admin/gyms">) {
  return (
    <Suspense fallback={<Skeleton className="h-[40rem] bg-white/5" />}>
      <Gyms searchParams={searchParams} />
    </Suspense>
  );
}

async function Gyms({ searchParams }: { searchParams: PageProps<"/admin/gyms">["searchParams"] }) {
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data }, pricing] = await Promise.all([supabase.rpc("admin_gym_health"), getPricing()]);
  return <GymsView rows={(data ?? []) as HealthRow[]} selected={typeof q.gym === "string" ? q.gym : null} price={pricing.priceUsd} />;
}
