import Link from "next/link";
import { Suspense } from "react";
import { TapSimulator } from "@/components/tap-simulator";
import { Logo } from "@/components/ui";
import { unreadCount } from "@/lib/chat";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { accountStatus, hiddenPortalPages } from "@/lib/portal";
import { PortalNav } from "./portal-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { ShakeQuickStart } from "@/components/shake-quick-start";
import { DropCatch } from "@/components/drop-catch";
import { loadTrainingPlan } from "@/lib/training-plan";
import { QrScanButton } from "@/components/qr-scanner";
import { NotificationBell } from "@/components/notification-bell";
import { loadNotifications } from "@/lib/notifications";

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/portal">
            <Logo />
          </Link>
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Suspense>
              <Simulator />
            </Suspense>
            <QrScanButton />
            <Suspense fallback={<div className="size-9" />}>
              <MemberBell />
            </Suspense>
            <form action={signOut}>
              <button className="h-9 rounded-lg px-3 text-sm whitespace-nowrap text-muted hover:bg-canvas hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="press mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(var(--bottom-bar)+1.5rem)]">{children}</main>
      {/* Bottom tab bar. Reads the URL and the unread count, neither known ahead of time. */}
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 h-16 border-t border-line bg-surface" />}>
        <NavWithUnread />
      </Suspense>
      <Suspense>
        <QuickStart />
      </Suspense>
      <InstallPrompt />
      <DropCatch />
    </div>
  );
}

async function NavWithUnread() {
  const { viewer, membership } = await requireMember();
  const [unread, hidden, account] = await Promise.all([
    unreadCount(await createClient(), viewer.id),
    hiddenPortalPages(membership.gymId),
    accountStatus(membership.gymId),
  ]);
  return <PortalNav unread={unread} hidden={hidden} frozen={account.locked} />;
}

// Double-space NFC tap simulator, while the gym has it switched on.
async function Simulator() {
  const { membership } = await requireMember();
  const supabase = await createClient();
  const { data: gym } = await supabase.from("gyms").select("tap_simulator").eq("id", membership.gymId).single();
  if (!gym?.tap_simulator) return null;
  return <TapSimulator />;
}

async function MemberBell() {
  const { membership } = await requireMember();
  const { items, unread } = await loadNotifications(membership.gymId, true);
  return <NotificationBell items={items} unread={unread} />;
}

// Shake the phone to open today's program (not while frozen for an unpaid balance).
async function QuickStart() {
  const { viewer, membership } = await requireMember();
  const supabase = await createClient();
  const [{ data: me }, account] = await Promise.all([
    supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("user_id", viewer.id).maybeSingle(),
    accountStatus(membership.gymId),
  ]);
  if (!me || account.locked) return null;
  const plan = await loadTrainingPlan(supabase, me.id, membership.timezone);
  const programId = plan.today?.programId ?? plan.programDays[0]?.programId;
  return (
    <ShakeQuickStart href={`/portal/programs${programId ? `?program=${programId}` : ""}`} />
  );
}
