import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Dumbbell, Lock } from "lucide-react";
import { Logo, Skeleton } from "@/components/ui";
import { exerciseImageUrl, musclesLabel } from "@/lib/exercises";
import { createClient } from "@/lib/supabase/server";
import { AddSharedProgram } from "./add-button";

export const metadata: Metadata = { title: "Shared program" };

type Shared = {
  name: string;
  notes: string | null;
  gym: string;
  by: string | null;
  from_trainer: boolean;
  can_add: boolean;
  signed_in: boolean;
  days: { name: string; exercises: { name: string; sets: number; reps: string; muscles: string[]; image: string | null }[] }[];
};

// A program a member shared (QR code, AirDrop or link). Members of the same
// gym add a copy; anyone else sees it with the gym's name.
export default function SharedProgramPage({ params }: PageProps<"/p/[token]">) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Logo />
        </div>
      </header>
      <Suspense fallback={<Skeleton className="mx-auto mt-6 h-[36rem] max-w-2xl" />}>
        <Program params={params} />
      </Suspense>
    </div>
  );
}

async function Program({ params }: { params: PageProps<"/p/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[0-9a-f]{16}$/.test(token)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("shared_program", { p_token: token });
  if (!data) notFound();
  const p = data as unknown as Shared;
  const total = p.days.reduce((n, d) => n + d.exercises.length, 0);

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-32">
      <section className="page-enter relative overflow-hidden rounded-[1.75rem] bg-ink p-6 text-white">
        <span aria-hidden className="challenge-glow" />
        <span aria-hidden className="challenge-grid" />
        <Dumbbell aria-hidden className="challenge-mark" strokeWidth={1.1} />
        <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
          {p.by ? `${p.by} shared a program` : "A shared program"}
        </p>
        <h1 className="relative mt-3 text-3xl font-black tracking-tight text-balance">{p.name}</h1>
        <p className="relative mt-2 text-sm text-white/60">
          {p.days.length} training day{p.days.length === 1 ? "" : "s"} · {total} exercises · {p.gym}
        </p>
        {p.notes && <p className="relative mt-4 rounded-2xl bg-white/[0.06] p-3 text-sm text-white/80 ring-1 ring-white/10">{p.notes}</p>}
      </section>

      <ol className="stagger space-y-3">
        {p.days.map((d, i) => (
          <li key={i} className="overflow-hidden rounded-3xl border border-line bg-surface">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
              <span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-bold text-brand">{i + 1}</span>
              <h2 className="font-semibold">{d.name}</h2>
              <span className="ml-auto text-xs text-muted">{d.exercises.length} exercises</span>
            </div>
            <ul className="divide-y divide-line">
              {d.exercises.map((e, j) => (
                <li key={j} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-canvas">
                    {e.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={exerciseImageUrl(e.image)} alt="" className="size-full object-cover" />
                    ) : (
                      <Dumbbell className="size-5 text-muted" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="block truncate text-xs text-muted">{musclesLabel(e.muscles)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold tabular-nums">
                    {e.sets} × {e.reps}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 p-4 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {p.can_add ? (
            <AddSharedProgram token={token} />
          ) : p.signed_in ? (
            <p className="flex items-center gap-3 rounded-2xl bg-canvas p-4 text-sm">
              <Lock className="size-5 shrink-0 text-muted" />
              <span>
                This program is for members of <b>{p.gym}</b>. Ask at their front desk to join, then open this link again.
              </span>
            </p>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/p/${token}`)}`}
              className="flex h-14 items-center justify-center rounded-2xl bg-ink text-base font-semibold text-white transition active:scale-[0.98]"
            >
              Log in to add it to your programs
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
