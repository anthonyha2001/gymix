import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Clock, Globe, Monitor, MousePointerClick, Navigation, ScrollText, Smartphone } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { duration } from "../../room-ui";

export const metadata: Metadata = { title: "Visit" };

type Journey = {
  session: Record<string, string | number | boolean | null>;
  who: string | null;
  visits_before: number;
  pages: { id: string; path: string; title: string | null; entered_at: string; active_ms: number; max_scroll: number; clicks: number }[];
  events: { kind: string; label: string | null; path: string | null; at: string }[];
};

const PLATFORM: Record<string, string> = { web: "Browser", pwa: "Installed web app", "ios-app": "iPhone app", "android-app": "Android app" };

// One visit, start to finish: every page, how long, how far they scrolled,
// what they clicked.
export default function VisitPage({ params }: PageProps<"/admin/visitors/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[36rem] bg-white/5" />}>
      <Visit params={params} />
    </Suspense>
  );
}

async function Visit({ params }: { params: PageProps<"/admin/visitors/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_session", { p_id: id });
  if (!data) notFound();
  const j = data as unknown as Journey;
  const s = j.session;
  const place = [s.city, s.region, s.country].filter(Boolean).join(", ") || "Unknown place";
  const facts = [
    { icon: Globe, k: "Where", v: place },
    { icon: s.device === "desktop" ? Monitor : Smartphone, k: "Device", v: [s.device, s.os, s.browser].filter(Boolean).join(" · ") },
    { icon: Smartphone, k: "Opened in", v: PLATFORM[String(s.platform ?? "web")] + (s.app_version ? ` ${s.app_version}` : "") },
    { icon: Navigation, k: "Came from", v: String(s.utm_source ?? s.referrer_host ?? "Direct") + (s.utm_campaign ? ` · ${s.utm_campaign}` : "") },
    { icon: Clock, k: "Time looking", v: duration(Number(s.active_ms) / 1000) },
    { icon: MousePointerClick, k: "Clicks", v: String(s.clicks) },
  ];

  // Pages and clicks on one timeline.
  const timeline = [
    ...j.pages.map((p) => ({ at: p.entered_at, page: p })),
    ...j.events.map((e) => ({ at: e.at, event: e })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-6">
      <Link href="/admin/visitors" className="inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="size-4" /> Visitors
      </Link>
      <header>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">{j.visits_before ? `Visit number ${j.visits_before + 1}` : "First visit"}</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{j.who ?? place}</h1>
        <p className="mt-1 text-sm text-white/50">
          {formatDateTime(String(s.started_at), "Asia/Beirut")} · {j.pages.length} {j.pages.length === 1 ? "page" : "pages"}
        </p>
      </header>

      <div className="room-grid grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {facts.map((f) => (
          <div key={f.k} className="room-stat rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.07]">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase">
              <f.icon className="size-3.5" /> {f.k}
            </p>
            <p className="mt-1.5 truncate text-sm font-semibold text-white">{f.v || "–"}</p>
          </div>
        ))}
      </div>

      <section className="room-panel rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
        <h2 className="mb-4 text-[13px] font-semibold text-white/80">The journey</h2>
        <ol className="room-feed relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-white/10">
          {timeline.map((t, i) =>
            "page" in t && t.page ? (
              <li key={`p${i}`} className="relative flex gap-4" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-brand text-xs font-black text-ink">{j.pages.indexOf(t.page) + 1}</span>
                <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <code className="font-semibold text-white">{t.page.path}</code>
                    <span className="text-xs text-white/40">{new Date(t.page.entered_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Beirut" })}</span>
                  </div>
                  {t.page.title && <p className="truncate text-xs text-white/45">{t.page.title}</p>}
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-white/70">
                      <Clock className="size-3.5 text-white/40" /> {duration(t.page.active_ms / 1000)}
                    </span>
                    <span className="flex items-center gap-2 text-white/70">
                      <ScrollText className="size-3.5 text-white/40" />
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                        <span className="room-bar-fill block h-full rounded-full bg-brand" style={{ width: `${t.page.max_scroll}%` }} />
                      </span>
                      {t.page.max_scroll}%
                    </span>
                    <span className="flex items-center gap-1.5 text-white/70">
                      <MousePointerClick className="size-3.5 text-white/40" /> {t.page.clicks}
                    </span>
                  </div>
                </div>
              </li>
            ) : "event" in t && t.event ? (
              <li key={`e${i}`} className="relative flex items-center gap-4 pl-1" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full bg-[#11161f] ring-1 ring-white/15">
                  <MousePointerClick className={`size-3 ${t.event.kind === "cta" || t.event.kind === "form" ? "text-brand" : "text-white/50"}`} />
                </span>
                <span className="text-sm text-white/70">
                  {t.event.kind === "outbound" ? "Left to" : t.event.kind === "form" ? "Sent" : "Clicked"} <b className="text-white">{t.event.label}</b>
                </span>
              </li>
            ) : null,
          )}
        </ol>
      </section>
    </div>
  );
}
