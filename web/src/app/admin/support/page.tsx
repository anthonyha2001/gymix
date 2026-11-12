import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Inbox, type InboxTicket, type ThreadData } from "./inbox";

export const metadata: Metadata = { title: "Support" };

// Gymix's customer service: every request from gym staff, a conversation
// each, with the gym's whole picture beside it.
export default function SupportPage({ searchParams }: PageProps<"/admin/support">) {
  return (
    <Suspense fallback={<Skeleton className="h-[44rem] bg-white/5" />}>
      <Support searchParams={searchParams} />
    </Suspense>
  );
}

async function Support({ searchParams }: { searchParams: PageProps<"/admin/support">["searchParams"] }) {
  const q = await searchParams;
  const view = (["open", "pending", "solved", "all"] as const).find((v) => v === q.view) ?? "open";
  const selected = typeof q.t === "string" ? q.t : null;
  const admin = createAdminClient();
  const supabase = await createClient();

  let list = admin
    .from("support_tickets")
    .select("id, number, subject, status, priority, category, gym_id, user_id, assigned_to, created_at, last_message_at, admin_unread, first_reply_at")
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (view !== "all") list = list.eq("status", view);
  const [{ data: tickets }, { data: counts }] = await Promise.all([list, admin.from("support_tickets").select("status")]);

  const ids = (k: "gym_id" | "user_id" | "assigned_to") => [...new Set((tickets ?? []).map((t) => t[k]).filter(Boolean) as string[])];
  const [{ data: gyms }, { data: people }] = await Promise.all([
    admin.from("gyms").select("id, name").in("id", ids("gym_id").length ? ids("gym_id") : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("profiles").select("id, full_name, email, phone").in("id", [...ids("user_id"), ...ids("assigned_to")].length ? [...ids("user_id"), ...ids("assigned_to")] : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const gymName = new Map((gyms ?? []).map((g) => [g.id, g.name]));
  const person = new Map((people ?? []).map((p) => [p.id, p]));

  const rows: InboxTicket[] = (tickets ?? []).map((t) => ({
    ...t,
    gym: t.gym_id ? (gymName.get(t.gym_id) ?? null) : null,
    from: t.user_id ? (person.get(t.user_id)?.full_name || person.get(t.user_id)?.email || "Someone") : "Deleted account",
    assignee: t.assigned_to ? (person.get(t.assigned_to)?.full_name ?? null) : null,
  }));

  let thread: ThreadData | null = null;
  const current = selected ? (rows.find((r) => r.id === selected) ?? null) : null;
  if (selected) {
    const { data: t } = await admin.from("support_tickets").select("*").eq("id", selected).maybeSingle();
    if (t) {
      const [{ data: messages }, { data: health }, { data: other }] = await Promise.all([
        admin.from("support_messages").select("id, body, from_gymix, internal, created_at, author_id").eq("ticket_id", t.id).order("created_at"),
        supabase.rpc("admin_gym_health"),
        t.user_id ? admin.from("support_tickets").select("id, number, subject, status, created_at").eq("user_id", t.user_id).neq("id", t.id).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
      ]);
      const { data: who } = t.user_id ? await admin.from("profiles").select("full_name, email, phone").eq("id", t.user_id).maybeSingle() : { data: null };
      if (t.admin_unread) await admin.from("support_tickets").update({ admin_unread: false }).eq("id", t.id);
      thread = {
        ticket: { ...t, gym: t.gym_id ? (gymName.get(t.gym_id) ?? null) : null, from: who?.full_name || who?.email || "Deleted account", assignee: current?.assignee ?? null },
        messages: messages ?? [],
        person: who ?? null,
        gym: t.gym_id ? ((health ?? []).find((g) => g.gym_id === t.gym_id) ?? null) : null,
        other: (other ?? []) as ThreadData["other"],
      };
    }
  }

  const tally = { open: 0, pending: 0, solved: 0, all: counts?.length ?? 0 };
  for (const c of counts ?? []) tally[c.status as "open" | "pending" | "solved"] += 1;

  return <Inbox view={view} tickets={rows} tally={tally} thread={thread} />;
}
