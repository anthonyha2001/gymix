import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

// The latest notifications for the signed-in user. For members, due reminders
// (class tomorrow, course payment, membership ending) are created first.
export async function loadNotifications(gymId: string, asMember: boolean) {
  const supabase = await createClient();
  if (asMember) {
    await Promise.all([
      supabase.rpc("make_my_reminders", { p_gym_id: gymId }),
      supabase.rpc("make_training_reminder", { p_gym_id: gymId }),
    ]);
  }
  const [{ data: items }, { count }] = await Promise.all([
    supabase.from("notifications").select("id, kind, title, body, link, created_at, read_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { items: (items ?? []) as NotificationItem[], unread: count ?? 0 };
}
