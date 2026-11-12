import { createClient } from "@/lib/supabase/server";
import { deleteSet, finishSession, saveSet } from "@/lib/workout-sets";
import type { QueuedOp } from "@/lib/outbox";

// The offline outbox arrives here when the phone is back online: sets logged,
// sets removed and workouts finished without a connection, oldest first.
// Runs as the signed-in member (row-level security applies), one op at a time
// so a set always lands before its workout's finish.
// Answers per op: ok, or failed with `permanent` when retrying can't help.

const MAX_OPS = 300;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Signed out" }, 401);

  let ops: QueuedOp[];
  try {
    const body = (await request.json()) as { ops?: unknown };
    if (!Array.isArray(body.ops)) return json({ error: "Expected ops" }, 400);
    ops = body.ops.slice(0, MAX_OPS) as QueuedOp[];
  } catch {
    return json({ error: "Expected JSON" }, 400);
  }

  const results: { id: string; ok: boolean; permanent?: boolean; error?: string; pr?: string }[] = [];
  for (const op of ops) {
    const id = typeof op?.id === "string" ? op.id.slice(0, 80) : "";
    if (!id) continue;
    try {
      if (op.kind === "set") {
        const r = await saveSet(supabase, {
          sessionId: String(op.sessionId),
          exerciseId: String(op.exerciseId),
          setNumber: Number(op.setNumber),
          weightKg: Number(op.weightKg),
          reps: Number(op.reps),
        });
        let pr: string | undefined;
        if (r.pr) {
          const { data: ex } = await supabase.from("exercises").select("name").eq("id", String(op.exerciseId)).maybeSingle();
          pr = `${ex?.name ?? "Exercise"} ${Number(op.weightKg)} kg`;
        }
        results.push({ id, ok: r.ok, permanent: r.permanent, error: r.error, pr });
      } else if (op.kind === "remove_set") {
        const r = await deleteSet(supabase, String(op.sessionId), String(op.exerciseId), Number(op.setNumber));
        results.push({ id, ok: r.ok, error: r.error });
      } else if (op.kind === "finish") {
        const r = await finishSession(supabase, String(op.sessionId), typeof op.notes === "string" ? op.notes : null, String(op.finishedAt));
        results.push({ id, ok: r.ok, permanent: r.permanent, error: r.error });
      } else {
        results.push({ id, ok: false, permanent: true, error: "Unknown change" });
      }
    } catch {
      // A hiccup on our side: keep it queued and stop, so order is kept.
      results.push({ id, ok: false });
      break;
    }
  }
  return json({ results });
}
