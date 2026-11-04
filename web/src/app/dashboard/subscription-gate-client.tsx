"use client";

import { usePathname, useSearchParams } from "next/navigation";

// While the subscription has ended, the owner can open only the Subscription tab.
export function OwnerSubscriptionOnly({ lock, children }: { lock: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  return pathname === "/dashboard/settings" && tab === "subscription" ? <>{children}</> : <>{lock}</>;
}
