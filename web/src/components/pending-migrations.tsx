import { DatabaseZap } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/session";

// TEMPORARY (safe to delete this file and its two uses: app/admin/page.tsx and
// app/dashboard/layout.tsx). Super admins only: lists Supabase migrations
// that haven't been run yet, by probing the live database for what each one
// adds. Each line disappears by itself once its migration is run.
const PROBES: { file: string; probe: (db: ReturnType<typeof createAdminClient>) => PromiseLike<{ error: { code?: string; message?: string } | null }> }[] = [
  { file: "20261108120000_open_door.sql", probe: (db) => db.from("access_devices").select("tap_token").limit(0) },
  { file: "20261108130000_door_security_and_polling.sql", probe: (db) => db.from("gyms").select("door_radius_m").limit(0) },
  { file: "20261112090000_challenges.sql", probe: (db) => db.from("challenges").select("id").limit(0) },
  { file: "20261112100000_presence.sql", probe: (db) => db.from("checkins").select("left_at").limit(0) },
  { file: "20261112110000_machine_stickers.sql", probe: (db) => db.from("gym_machines").select("sticker_at").limit(0) },
  { file: "20261113090000_account_deletion.sql", probe: (db) => db.rpc("account_deletion_blocker") },
  { file: "20261113100000_push.sql", probe: (db) => db.from("notifications").select("push_sent_at").limit(0) },
  { file: "20261113110000_crash_platforms.sql", probe: (db) => db.rpc("admin_crash_platforms", { p_days: 1 }) },
  { file: "20261113120000_widget.sql", probe: (db) => db.rpc("widget_data", { p_token: "probe" }) },
  { file: "20261113130000_program_sharing.sql", probe: (db) => db.from("gyms").select("program_sharing").limit(0) },
  { file: "20261113140000_retention.sql", probe: (db) => db.from("gyms").select("winback_days").limit(0) },
  { file: "20261114090000_control_room.sql", probe: (db) => db.from("support_tickets").select("id").limit(0) },
  { file: "20261114100000_clients.sql", probe: (db) => db.from("access_requests").select("id").limit(0) },
];

// "Doesn't exist" answers from Postgres / PostgREST; anything else (like "Not
// allowed") means the thing is there.
const MISSING = /^(42703|42P01|42883|PGRST202|PGRST204|PGRST205)$/;

export async function PendingMigrations() {
  const viewer = await getViewer();
  if (!viewer?.isPlatformAdmin) return null;
  let missing: string[] = [];
  try {
    const db = createAdminClient();
    const results = await Promise.all(PROBES.map(async (p) => ({ file: p.file, error: (await p.probe(db)).error })));
    missing = results.filter((r) => r.error && MISSING.test(r.error.code ?? "")).map((r) => r.file);
  } catch {
    return null;
  }
  if (!missing.length) return null;
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="mx-auto flex max-w-6xl items-start gap-3">
        <DatabaseZap className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">Run {missing.length === 1 ? "this migration" : `these ${missing.length} migrations`} in Supabase (SQL Editor), in this order:</p>
          <ol className="mt-1 list-decimal pl-5 font-mono text-xs">
            {missing.map((f) => (
              <li key={f}>
                <a className="underline underline-offset-2" href={`https://github.com/anthonyha2001/gymix/blob/main/supabase/migrations/${f}`} target="_blank" rel="noopener">
                  {f}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-1 text-xs text-amber-900/70">Only super admins see this. It disappears once they&apos;re all run.</p>
        </div>
      </div>
    </div>
  );
}
