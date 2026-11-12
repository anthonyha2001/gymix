"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui";

export type LegalSection = { id: string; title: string; body: ReactNode };

// A calm reading page for the privacy policy and terms: a lime reading-
// progress line, a contents list that follows you down the page (on wide
// screens), and sections that rise in as they come into view.
export function LegalPage({ eyebrow, title, intro, updated, sections }: { eyebrow: string; title: string; intro: ReactNode; updated: string; sections: LegalSection[] }) {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const spy = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            reveal.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll("[data-legal]").forEach((el) => {
      spy.observe(el);
      reveal.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      spy.disconnect();
      reveal.disconnect();
    };
  }, []);

  return (
    <div className="min-h-dvh bg-canvas">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-0.5 origin-left bg-brand" style={{ transform: `scaleX(${progress})` }} />
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
            <ArrowLeft className="size-4" /> Gymix
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink text-white">
        <span aria-hidden className="challenge-glow" />
        <span aria-hidden className="challenge-grid" />
        <div className="page-enter relative mx-auto max-w-5xl px-4 py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <div className="mt-4 max-w-2xl text-white/70">{intro}</div>
          <p className="mt-6 text-xs text-white/40">Last updated {updated}</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Contents" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1 border-l border-line text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={`-ml-px block border-l-2 py-1.5 pl-4 transition-all duration-300 ${active === s.id ? "border-brand font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
                >
                  <span className="mr-2 tabular-nums text-muted/60">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0 space-y-4">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} data-legal className="legal-section scroll-mt-24 rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <p className="text-xs font-bold tabular-nums text-muted/60">{String(i + 1).padStart(2, "0")}</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">{s.title}</h2>
              <div className="legal-body mt-3 space-y-3 text-[15px] leading-relaxed text-ink/80">{s.body}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
