import { NextResponse } from "next/server";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// "Download my data": everything Gymix holds about the signed-in person, as a
// JSON file. Read with their own session, so the database's row rules decide
// what's included; nothing about other people leaks in.
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, language, notify_prefs, created_at")
    .eq("id", viewer.id)
    .maybeSingle();
  const { data: members } = await supabase.from("members").select("id, gym_id, full_name, phone, email, created_at, gyms(name)").eq("user_id", viewer.id);
  const ids = (members ?? []).map((m) => m.id);

  const pick = async <T,>(q: PromiseLike<{ data: T | null }>) => (await q).data ?? [];
  const byMember = ids.length
    ? {
        memberships: await pick(supabase.from("memberships").select("plan_name, starts_on, ends_on, frozen_on, cancelled_at, visit_limit, visits_used").in("member_id", ids)),
        payments: await pick(supabase.from("payments").select("amount_usd, amount_lbp, method, paid_at").in("member_id", ids)),
        visits: await pick(supabase.from("checkins").select("checked_in_at, left_at, source").in("member_id", ids).order("checked_in_at", { ascending: false }).limit(5000)),
        workouts: await pick(
          supabase
            .from("workout_sessions")
            .select("started_at, finished_at, set_logs(exercise_id, set_number, weight_kg, reps)")
            .in("member_id", ids)
            .order("started_at", { ascending: false })
            .limit(2000),
        ),
        measurements: await pick(supabase.from("body_measurements").select("*").in("member_id", ids)),
        challenges: await pick(supabase.from("challenge_entries").select("status, updated_at, challenges(title, metric, starts_on, ends_on)").in("member_id", ids)),
      }
    : {};

  const body = {
    exported_at: new Date().toISOString(),
    account: { id: viewer.id, ...profile },
    gyms: viewer.memberships.map((m) => ({ gym: m.gymName, role: m.role })),
    member_records: members ?? [],
    ...byMember,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="gymix-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
