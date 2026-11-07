import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { gymFeatures } from "@/lib/features";
import { SupportBanner } from "@/components/support-banner";
import { unreadCount } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { navFor } from "./nav-items";
import { InstallPrompt } from "@/components/install-prompt";
import { NotificationBell } from "@/components/notification-bell";
import { loadNotifications } from "@/lib/notifications";
import { NavLinks, NavSkeleton, Sidebar } from "./sidebar";
import { SubscriptionGate } from "./subscription-gate";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        gym={
          <Suspense fallback={<Skeleton className="h-14" />}>
            <GymCard />
          </Suspense>
        }
        nav={
          <Suspense fallback={<NavSkeleton />}>
            <RoleNav />
          </Suspense>
        }
        account={
          <Suspense fallback={<Skeleton className="h-12" />}>
            <AccountCard />
          </Suspense>
        }
        bell={
          <Suspense fallback={<div className="size-9" />}>
            <Bell />
          </Suspense>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={null}>
          <SupportBanner />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SubscriptionGate>{children}</SubscriptionGate>
        </Suspense>
      </main>
      <InstallPrompt />
    </div>
  );
}

async function GymCard() {
  const { membership } = await requireStaff();
  return (
    <div className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-ink text-sm font-semibold text-brand">
        {initials(membership.gymName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{membership.gymName}</span>
        <span className="block text-xs text-muted">Your gym</span>
      </span>
    </div>
  );
}

async function RoleNav() {
  const { viewer, membership } = await requireStaff();
  const supabase = await createClient();
  const [unread, { data: counts }, features] = await Promise.all([
    unreadCount(supabase, viewer.id),
    supabase.rpc("staff_counts", { p_gym_id: membership.gymId }).maybeSingle(),
    gymFeatures(membership.gymId),
  ]);
  return (
    <NavLinks
      items={navFor(membership.role, {
        messages: unread,
        programs: counts?.program_requests ?? 0,
        schedule: counts?.pt_requests ?? 0,
      }, features)}
    />
  );
}

async function Bell() {
  const { membership } = await requireStaff();
  const { items, unread } = await loadNotifications(membership.gymId, false);
  return <NotificationBell items={items} unread={unread} />;
}

async function AccountCard() {
  const { viewer, membership } = await requireStaff();
  const name = viewer.fullName || viewer.email;
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block text-xs text-muted">{ROLE_LABELS[membership.role]}</span>
      </span>
      <form action={signOut}>
        <button
          aria-label="Log out"
          title="Log out"
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-danger"
        >
          <LogOut className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}

function initials(text: string) {
  const parts = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "G";
}

