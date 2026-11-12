import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { hasFeature } from "@/lib/features";
import { formatDate, todayIn } from "@/lib/format";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { METRICS, MEDALS, formatScore, isMetric, type Metric } from "@/lib/challenges";
import { createChallenge, deleteChallenge, updateChallenge } from "./actions";
import { ChallengeForm } from "./challenge-form";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <div className="max-w-5xl space-y-6">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(membership.gymId, "challenges"))) redirect("/dashboard");
  const today = todayIn(membership.timezone);
  const supabase = await createClient();
  const [{ data: challenges }, { data: entries }] = await Promise.all([
    supabase.from("challenges").select("*").eq("gym_id", membership.gymId).order("ends_on", { ascending: false }).limit(30),
    supabase.from("challenge_entries").select("challenge_id").eq("gym_id", membership.gymId).eq("status", "joined"),
  ]);
  const joined = new Map<string, number>();
  for (const e of entries ?? []) joined.set(e.challenge_id, (joined.get(e.challenge_id) ?? 0) + 1);
  const state = (c: { starts_on: string; ends_on: string }) => (c.starts_on > today ? "upcoming" : c.ends_on < today ? "ended" : "active");
  const list = (challenges ?? []).sort((a, b) => ["active", "upcoming", "ended"].indexOf(state(a)) - ["active", "upcoming", "ended"].indexOf(state(b)));

  return (
    <>
      <PageHeader
        title="Challenges"
        description="Post a monthly challenge. Members get a notification, swipe to join, and climb a live leaderboard. Scores count themselves from check-ins, workouts and classes."
        action={
          <Dialog label="New challenge" icon={<Plus className="size-4" />} title="New challenge" description="Members are notified as soon as you post it." size="xl">
            <ChallengeForm action={createChallenge} today={today} submitLabel="Post challenge" />
          </Dialog>
        }
      />

      {!list.length ? (
        <Card className="page-enter px-6 py-14 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-brand">
            <Trophy className="size-6" />
          </span>
          <p className="mt-4 font-semibold">No challenges yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Try &quot;Most visits this month&quot; with a free shake for everyone who comes 12 times. Gyms see members come back more often during a challenge.
          </p>
        </Card>
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {list.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              state={state(c)}
              joined={joined.get(c.id) ?? 0}
              today={today}
              timeZone={membership.timezone}
            />
          ))}
        </div>
      )}
    </>
  );
}

type Row = { id: string; title: string; metric: string; target: number | null; prize: string | null; description: string | null; starts_on: string; ends_on: string };

async function ChallengeCard({ challenge: c, state, joined, today }: { challenge: Row; state: string; joined: number; today: string; timeZone: string }) {
  const supabase = await createClient();
  const { data: board } = await supabase.rpc("challenge_board", { p_challenge_id: c.id, p_limit: 5 });
  const m = isMetric(c.metric) ? METRICS[c.metric] : null;
  const completed = (board ?? []).filter((r) => r.completed).length;
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start gap-3 p-5">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-2xl">{m?.emoji ?? "🏆"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{c.title}</h2>
            <Badge tone={state === "active" ? "green" : state === "upcoming" ? "amber" : "gray"}>
              {state === "active" ? "Live" : state === "upcoming" ? "Starts soon" : "Ended"}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            {m?.label} · {formatDate(c.starts_on)} – {formatDate(c.ends_on)}
          </p>
          {(c.target || c.prize) && (
            <p className="mt-1 text-sm">
              {c.target ? <>Goal {formatScore(c.metric, c.target)}</> : null}
              {c.target && c.prize ? " · " : null}
              {c.prize ? <>🎁 {c.prize}</> : null}
            </p>
          )}
        </div>
        <RowMenu
          label={`Actions for ${c.title}`}
          items={[
            {
              kind: "dialog",
              label: "Edit",
              title: `Edit ${c.title}`,
              size: "xl",
              content: (
                <ChallengeForm
                  action={updateChallenge.bind(null, c.id)}
                  today={today}
                  submitLabel="Save"
                  initial={{ title: c.title, metric: (isMetric(c.metric) ? c.metric : "visits") as Metric, starts_on: c.starts_on, ends_on: c.ends_on, target: c.target, prize: c.prize, description: c.description }}
                />
              ),
            },
            { kind: "action", label: "Delete", danger: true, action: deleteChallenge.bind(null, c.id), confirm: `Delete “${c.title}”? Its leaderboard goes too.` },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 border-y border-line bg-canvas/50 text-center">
        <div className="p-3">
          <p className="text-xl font-semibold tabular-nums">
            <CountUp value={String(joined)} />
          </p>
          <p className="text-xs text-muted">joined</p>
        </div>
        <div className="border-l border-line p-3">
          <p className="text-xl font-semibold tabular-nums">{c.target ? <CountUp value={String(completed)} /> : "–"}</p>
          <p className="text-xs text-muted">{c.target ? "reached the goal" : "no goal set"}</p>
        </div>
      </div>

      {board?.length ? (
        <ol className="flex-1 divide-y divide-line">
          {board.map((r, i) => (
            <li key={`${r.member_id}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="w-6 text-center">{r.rank <= 3 ? <span className="medal-pop" style={{ animationDelay: `${i * 80}ms` }}>{MEDALS[r.rank - 1]}</span> : r.rank}</span>
              {r.member_id ? (
                <Link href={`/dashboard/members/${r.member_id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {r.name}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              )}
              {r.completed && <span className="text-xs font-semibold text-success">✓</span>}
              <span className="font-semibold tabular-nums">{formatScore(c.metric, Number(r.score))}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="flex-1 px-5 py-6 text-center text-sm text-muted">{state === "upcoming" ? "Members can join now; scores start counting on the first day." : "Nobody has joined yet."}</p>
      )}
    </Card>
  );
}
