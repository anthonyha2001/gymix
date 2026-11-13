import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { BILLING_ROLES, ROLE_LABELS } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { gymFeatures, hasFeature } from "@/lib/features";
import { hoursAgoIso } from "@/lib/format";
import { DoorsMenu, type Door } from "@/components/doors-menu";
import { SupportBanner } from "@/components/support-banner";
import { DemoChrome } from "@/components/demo-chrome";
import { unreadCount } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { signOut } from "../(auth)/actions";
import { PendingMigrations } from "@/components/pending-migrations";
import { navFor } from "./nav-items";
import { InstallPrompt } from "@/components/install-prompt";
import { PushKeeper } from "@/components/push-keeper";
import { NotificationBell } from "@/components/notification-bell";
import { SupportWidget } from "@/components/support-widget";
import { loadNotifications } from "@/lib/notifications";
import { NavLinks, NavSkeleton, Sidebar } from "./sidebar";
import { SubscriptionGate } from "./subscription-gate";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="owner flex flex-1 flex-col md:flex-row">
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
          <div className="flex items-center gap-0.5">
            <Suspense fallback={null}>
              <Help />
            </Suspense>
            <Suspense fallback={null}>
              <Doors />
            </Suspense>
            <Suspense fallback={<div className="size-9" />}>
              <Bell />
            </Suspense>
          </div>
        }
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <Suspense fallback={null}>
          <DemoChrome area="owner" />
          <Suspense fallback={null}>
            <PendingMigrations />
          </Suspense>
        </Suspense>
        <Suspense fallback={null}>
          <SupportBanner />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SubscriptionGate>{children}</SubscriptionGate>
        </Suspense>
      </main>
      <InstallPrompt />
      <PushKeeper />
    </div>
  );
}

async function GymCard() {
  const { membership } = await requireStaff();
  return (
    <div className="owner-gym group flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5">
      <span className="owner-gym-mark relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-ink text-sm font-semibold text-brand">
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

// Gym staff's line to Gymix support.
async function Help() {
  const { membership } = await requireStaff();
  return <SupportWidget gymId={membership.gymId} />;
}

async function Bell() {
  const { membership } = await requireStaff();
  const { items, unread } = await loadNotifications(membership.gymId, false);
  return <NotificationBell items={items} unread={unread} />;
}

// The "Open a door" shortcut, for staff who handle the desk, when the gym has doors.
async function Doors() {
  const { membership } = await requireStaff();
  if (!BILLING_ROLES.includes(membership.role) || !(await hasFeature(membership.gymId, "access_control"))) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("access_doors", { p_gym_id: membership.gymId });
  if (!data?.length) return null;
  // Devices call every few seconds: 3 minutes of silence is offline.
  const recent = new Date(hoursAgoIso(0.05)).getTime();
  const doors: Door[] = data.map((d) => ({
    id: d.id,
    name: d.name,
    zone: d.zone_name,
    active: d.is_active,
    online: d.connection === "direct" || (d.last_seen_at !== null && new Date(d.last_seen_at).getTime() > recent),
  }));
  return <DoorsMenu doors={doors} />;
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
        <Link href="/account" className="block truncate text-sm font-medium hover:underline">{name}</Link>
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

