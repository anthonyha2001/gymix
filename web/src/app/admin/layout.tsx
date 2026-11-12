import type { Metadata } from "next";
import { Suspense } from "react";
import { PendingMigrations } from "@/components/pending-migrations";
import { requirePlatformAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { signOut } from "../(auth)/actions";
import { RoomShell } from "./room-shell";

export const metadata: Metadata = { title: { default: "Control room", template: "%s · Control room" } };

// Gymix's control room: one dark shell around every super-admin screen. The
// rail carries live counts (new requests, open tickets); ⌘K jumps anywhere.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="room flex min-h-dvh bg-[#07090d] text-white">
      <Suspense fallback={<div className="hidden w-64 shrink-0 border-r border-white/[0.06] lg:block" />}>
        <Shell>{children}</Shell>
      </Suspense>
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const viewer = await requirePlatformAdmin();
  const admin = createAdminClient();
  const [{ count: requests }, { count: tickets }, { data: gyms }] = await Promise.all([
    admin.from("access_requests").select("id", { count: "exact", head: true }).in("status", ["new", "contacted"]),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("admin_unread", true).neq("status", "solved"),
    admin.from("gyms").select("id, name, is_lab").order("name").limit(500),
  ]);
  return (
    <RoomShell
      me={{ name: viewer.fullName || viewer.email, hasGym: viewer.memberships.length > 0 }}
      counts={{ requests: requests ?? 0, tickets: tickets ?? 0 }}
      gyms={(gyms ?? []).map((g) => ({ id: g.id, name: g.name, lab: g.is_lab }))}
      signOut={signOut}
      banner={
        <Suspense fallback={null}>
          <PendingMigrations />
        </Suspense>
      }
    >
      {children}
    </RoomShell>
  );
}
