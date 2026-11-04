import Link from "next/link";
import { Suspense } from "react";
import { TapSimulator } from "@/components/tap-simulator";
import { Logo } from "@/components/ui";
import { unreadCount } from "@/lib/chat";
import { requireMember } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { hiddenPortalPages } from "@/lib/portal";
import { PortalNav } from "./portal-nav";
import { InstallPrompt } from "@/components/install-prompt";
import { NotificationBell } from "@/components/notification-bell";
import { loadNotifications } from "@/lib/notifications";

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/portal">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <Suspense>
              <Simulator />
            </Suspense>
            <Suspense fallback={<div className="size-9" />}>
              <MemberBell />
            </Suspense>
            <form action={signOut}>
              <button className="rounded-lg px-3 h-9 text-sm text-muted hover:bg-canvas hover:text-ink">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-[calc(var(--bottom-bar)+1.5rem)]">{children}</main>
      {/* Bottom tab bar. Reads the URL and the unread count, neither known ahead of time. */}
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 h-16 border-t border-line bg-surface" />}>
        <NavWithUnread />
      </Suspense>
      <InstallPrompt />
    </div>
  );
}

async function NavWithUnread() {
  const { viewer, membership } = await requireMember();
  const [unread, hidden] = await Promise.all([unreadCount(await createClient(), viewer.id), hiddenPortalPages(membership.gymId)]);
  return <PortalNav unread={unread} hidden={hidden} />;
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
