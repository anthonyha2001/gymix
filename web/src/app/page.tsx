import Link from "next/link";
import { Logo, buttonClass } from "@/components/ui";

const FEATURES = [
  { title: "Run your gym", body: "Members, memberships, billing, check-in and staff — in one place." },
  { title: "Machines that teach", body: "Every machine in your gym with a how-to GIF members can pull up on the floor." },
  { title: "Trainer programs", body: "Members request a program, your PTs build it on your actual equipment." },
  { title: "Progress members see", body: "Workout logs, personal records and body measurements over time." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Logo className="text-lg" />
        <nav className="flex items-center gap-2">
          <Link href="/login" className={buttonClass("ghost")}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClass("primary")}>
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="py-16 md:py-24 max-w-3xl">
          <p className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-semibold">Built for gyms in Lebanon</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">The operating system for your gym.</h1>
          <p className="mt-5 text-lg text-muted">
            Gymix runs the business side of your gym and gives every member a portal for their programs, progress and
            invoices.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClass("primary", "h-12 px-6 text-base")}>
              Set up your gym
            </Link>
            <Link href="/login" className={buttonClass("secondary", "h-12 px-6 text-base")}>
              I&apos;m a member
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
