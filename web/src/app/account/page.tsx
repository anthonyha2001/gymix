import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ChevronRight, Download, FileText, ShieldCheck } from "lucide-react";
import { Logo, Skeleton } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/roles";
import { getViewer, homePathFor } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccount } from "./delete-account";
import { PushCard } from "@/components/push-card";

export const metadata: Metadata = { title: "Your account" };

// Everyone's account page (members and staff): the legal pages, a copy of
// your data, and deleting the account. Linked from the member profile and
// from the staff sidebar.
export default function AccountPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-5 px-4 py-6">
        <Suspense fallback={<Skeleton className="h-[32rem]" />}>
          <Account />
        </Suspense>
      </main>
    </div>
  );
}

async function Account() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  const supabase = await createClient();
  const [{ data: blocker }, { data: profile }] = await Promise.all([
    supabase.rpc("account_deletion_blocker"),
    supabase.from("profiles").select("full_name, email, phone").eq("id", viewer.id).maybeSingle(),
  ]);
  const name = profile?.full_name || viewer.fullName || "You";
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const back = homePathFor(viewer);
  const isMember = viewer.memberships.some((m) => m.role === "member");

  return (
    <>
      <Link href={back === "/portal" ? "/portal/profile" : back} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <section className="page-enter relative overflow-hidden rounded-3xl bg-ink p-6 text-white">
        <span aria-hidden className="challenge-glow" />
        <div className="relative flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand text-lg font-black text-ink">{initials}</span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold">{name}</span>
            <span className="block truncate text-sm text-white/60">{profile?.email || viewer.email}</span>
          </span>
        </div>
        {viewer.memberships.length > 0 && (
          <ul className="relative mt-5 flex flex-wrap gap-2">
            {viewer.memberships.map((m) => (
              <li key={`${m.gymId}-${m.role}`} className="rounded-full bg-white/[0.07] px-3 py-1 text-xs ring-1 ring-white/10">
                {m.gymName} · <span className="text-brand">{ROLE_LABELS[m.role]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Your data" className="stagger overflow-hidden rounded-3xl border border-line bg-surface">
        <Row href="/privacy" icon={<ShieldCheck className="size-5" />} title="Privacy policy" text="What Gymix collects, why, and your rights." />
        <Row href="/terms" icon={<FileText className="size-5" />} title="Terms of use" text="The rules for using Gymix." />
        <Row href="/account/export" download icon={<Download className="size-5" />} title="Download my data" text={isMember ? "Your profile, visits, workouts and measurements, as a file." : "Your profile and gyms, as a file."} />
      </nav>

      <section className="rounded-3xl border border-line bg-surface p-2">
        <PushCard />
      </section>

      <DeleteAccount blocker={blocker} isMember={isMember} />
    </>
  );
}

function Row({ href, icon, title, text, download = false }: { href: string; icon: React.ReactNode; title: string; text: string; download?: boolean }) {
  const inner = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-1" />
    </>
  );
  const cls = "group flex items-center gap-4 border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-canvas/60";
  return download ? (
    <a href={href} download className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
