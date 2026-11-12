"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, Building2, CheckCircle2, Loader2, Lock, Mail, MessageSquare, Phone, Send, StickyNote, UserCheck } from "lucide-react";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { ScoreRing, ago, fmt } from "../room-ui";
import { openGymAsSupport } from "../actions";
import { adminReply, adminSetTicket } from "./actions";

export type InboxTicket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  gym_id: string | null;
  user_id: string | null;
  created_at: string;
  last_message_at: string;
  admin_unread: boolean;
  first_reply_at: string | null;
  gym: string | null;
  from: string;
  assignee: string | null;
};

export type ThreadData = {
  ticket: InboxTicket & { path: string | null; device: string | null };
  messages: { id: string; body: string; from_gymix: boolean; internal: boolean; created_at: string }[];
  person: { full_name: string; email: string; phone: string | null } | null;
  gym: { gym_id: string; name: string; score: number; members: number; active_members: number; checkins_7d: number; paid_until: string | null; trial_ends_at: string | null; last_staff_seen: string | null; errors_7d: number } | null;
  other: { id: string; number: number; subject: string; status: string; created_at: string }[];
};

const VIEWS = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Waiting on them" },
  { id: "solved", label: "Solved" },
  { id: "all", label: "All" },
] as const;

const PRIORITY: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-rose-400/15 text-rose-300" },
  high: { label: "High", cls: "bg-amber-400/15 text-amber-300" },
  normal: { label: "Normal", cls: "bg-white/[0.06] text-white/60" },
  low: { label: "Low", cls: "bg-white/[0.04] text-white/40" },
};

const QUICK = [
  "Thanks for reaching out! Looking into it now.",
  "Could you send a screenshot of what you see?",
  "Fixed on our side. Could you try again and tell us?",
  "Restart the Gymix Bridge on the reception computer, then tap again.",
];

export function Inbox({ view, tickets, tally, thread }: { view: string; tickets: InboxTicket[]; tally: Record<string, number>; thread: ThreadData | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  // New messages arrive without reloading.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);

  const shown = tickets.filter((t) => !q || `${t.subject} ${t.from} ${t.gym} #${t.number}`.toLowerCase().includes(q.toLowerCase()));
  const href = (p: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const merged = { view, t: thread?.ticket.id ?? null, ...p };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, v);
    return `/admin/support?${u}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">Support</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Help your gyms</h1>
        </div>
        <nav className="inline-flex rounded-xl bg-white/[0.04] p-1 ring-1 ring-white/[0.07]">
          {VIEWS.map((v) => (
            <Link key={v.id} href={href({ view: v.id, t: null })} scroll={false} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === v.id ? "bg-white text-ink shadow" : "text-white/55 hover:text-white"}`}>
              {v.label}
              <span className={`tabular-nums ${view === v.id ? "text-ink/50" : "text-white/35"}`}>{tally[v.id] ?? 0}</span>
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid gap-4 xl:grid-cols-[22rem_1fr_20rem]">
        {/* The list */}
        <section className="room-panel flex max-h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.07]">
          <div className="border-b border-white/[0.06] p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets" className="h-10 w-full rounded-xl bg-white/[0.05] px-3.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-white/30 focus:ring-brand" />
          </div>
          <ul className="room-feed flex-1 divide-y divide-white/[0.05] overflow-auto">
            {shown.map((t) => (
              <li key={t.id}>
                <Link href={href({ t: t.id })} scroll={false} className={`relative block px-4 py-3.5 transition ${thread?.ticket.id === t.id ? "bg-white/[0.07]" : "hover:bg-white/[0.03]"}`}>
                  {t.admin_unread && <span className="room-live absolute top-5 left-1.5 size-1.5 rounded-full bg-brand" />}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-sm ${t.admin_unread ? "font-bold text-white" : "font-medium text-white/80"}`}>{t.subject}</span>
                    <span className="shrink-0 text-[11px] text-white/35">{ago(t.last_message_at)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
                    <span className="truncate">
                      #{t.number} · {t.from}
                      {t.gym ? ` · ${t.gym}` : ""}
                    </span>
                    {t.priority !== "normal" && <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY[t.priority].cls}`}>{PRIORITY[t.priority].label}</span>}
                  </div>
                </Link>
              </li>
            ))}
            {!shown.length && <li className="px-4 py-14 text-center text-sm text-white/35">{view === "open" ? "Inbox zero. Nicely done." : "Nothing here."}</li>}
          </ul>
        </section>

        {/* The conversation */}
        {thread ? <Thread key={thread.ticket.id} data={thread} /> : (
          <section className="room-panel grid min-h-[24rem] place-items-center rounded-3xl bg-white/[0.02] ring-1 ring-white/[0.06]">
            <div className="text-center">
              <MessageSquare className="mx-auto size-8 text-white/20" />
              <p className="mt-3 text-sm text-white/40">Pick a ticket to read and reply.</p>
            </div>
          </section>
        )}

        {/* Who and which gym */}
        {thread ? <Context data={thread} /> : <div className="hidden xl:block" />}
      </div>
    </div>
  );
}

function Thread({ data }: { data: ThreadData }) {
  const t = data.ticket;
  const [body, setBody] = useState("");
  const [note, setNote] = useState(false);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [data.messages.length]);

  const set = (patch: Parameters<typeof adminSetTicket>[1]) =>
    start(async () => {
      const r = await adminSetTicket(t.id, patch);
      if (r.error) showToast(r.error, "error");
      else haptics.tap();
    });

  const send = () =>
    start(async () => {
      const r = await adminReply(t.id, body, note);
      if (r.error) return showToast(r.error, "error");
      haptics.success();
      setBody("");
    });

  return (
    <section className="room-panel flex max-h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden rounded-3xl bg-white/[0.03] ring-1 ring-white/[0.07]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-[14rem] flex-1">
          <p className="text-xs text-white/40">
            #{t.number} · {t.category ?? "question"} · opened {ago(t.created_at)}
          </p>
          <h2 className="line-clamp-2 text-lg leading-snug font-bold">{t.subject}</h2>
        </div>
        <select value={t.priority} onChange={(e) => set({ priority: e.target.value })} className="h-9 rounded-xl bg-white/[0.06] px-2.5 text-xs font-semibold text-white ring-1 ring-white/10 outline-none" aria-label="Priority">
          {Object.entries(PRIORITY).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        {t.status !== "solved" ? (
          <button type="button" onClick={() => set({ status: "solved" })} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-400/15 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/25">
            <CheckCircle2 className="size-4" /> Solved
          </button>
        ) : (
          <button type="button" onClick={() => set({ status: "open" })} className="h-9 rounded-xl px-3 text-xs font-semibold text-white/70 ring-1 ring-white/10 hover:text-white">
            Reopen
          </button>
        )}
        {!t.assignee ? (
          <button type="button" onClick={() => set({ assignMe: true })} title="Take this ticket" className="grid size-9 place-items-center rounded-xl text-white/60 ring-1 ring-white/10 hover:text-white">
            <UserCheck className="size-4" />
          </button>
        ) : (
          <span className="text-xs text-white/45">With {t.assignee}</span>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-auto px-5 py-5">
        {data.messages.map((m, i) => (
          <div key={m.id} className={`room-msg flex ${m.from_gymix || m.internal ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <div
              className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.internal
                  ? "rounded-br-md border border-dashed border-amber-400/40 bg-amber-400/[0.07] text-amber-100"
                  : m.from_gymix
                    ? "rounded-br-md bg-brand text-ink"
                    : "rounded-bl-md bg-white/[0.07] text-white/90"
              }`}
            >
              {m.internal && (
                <p className="mb-1 flex items-center gap-1 text-[10px] font-bold tracking-[0.14em] text-amber-300 uppercase">
                  <Lock className="size-3" /> Note, only Gymix sees this
                </p>
              )}
              {m.body}
              <p className={`mt-1 text-[10px] ${m.from_gymix && !m.internal ? "text-ink/50" : "text-white/35"}`}>{ago(m.created_at)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>

      <footer className="border-t border-white/[0.06] p-3">
        {!body && (
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {QUICK.map((qr) => (
              <button key={qr} type="button" onClick={() => setBody(qr)} className="shrink-0 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs text-white/60 ring-1 ring-white/[0.07] transition hover:text-white">
                {qr.length > 42 ? `${qr.slice(0, 42)}…` : qr}
              </button>
            ))}
          </div>
        )}
        <div className={`rounded-2xl ring-1 transition ${note ? "bg-amber-400/[0.06] ring-amber-400/30" : "bg-white/[0.04] ring-white/10 focus-within:ring-brand"}`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) send();
            }}
            rows={3}
            placeholder={note ? "A note for the Gymix team (they won't see it)" : `Reply to ${t.from}…`}
            className="w-full resize-none bg-transparent px-4 pt-3 text-sm text-white outline-none placeholder:text-white/30"
          />
          <div className="flex items-center justify-between gap-2 px-3 pb-3">
            <button type="button" onClick={() => setNote((n) => !n)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${note ? "bg-amber-400/20 text-amber-200" : "text-white/50 hover:text-white"}`}>
              <StickyNote className="size-3.5" /> {note ? "Internal note" : "Add a note instead"}
            </button>
            <button type="button" disabled={pending || !body.trim()} onClick={send} className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-95 disabled:opacity-40 ${note ? "bg-amber-300 text-ink" : "bg-brand text-ink"}`}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {note ? "Save note" : "Send"}
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}

function Context({ data }: { data: ThreadData }) {
  const [pending, start] = useTransition();
  const g = data.gym;
  const p = data.person;
  const phone = p?.phone?.replace(/[^\d]/g, "");
  return (
    <aside className="space-y-4">
      <section className="room-panel rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">Who</p>
        <p className="mt-2 font-semibold">{data.ticket.from}</p>
        {p && (
          <div className="mt-3 space-y-1.5 text-sm">
            <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-white/65 hover:text-white">
              <Mail className="size-4 text-white/35" /> {p.email}
            </a>
            {phone && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-white/65 hover:text-white">
                <Phone className="size-4 text-white/35" /> WhatsApp {p.phone}
              </a>
            )}
          </div>
        )}
        {data.ticket.path && <p className="mt-3 truncate text-xs text-white/40">Wrote from <code>{data.ticket.path}</code></p>}
      </section>

      {g && (
        <section className="room-panel rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">Gym</p>
              <p className="mt-2 truncate font-semibold">{g.name}</p>
            </div>
            <ScoreRing score={g.score} size={40} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {[
              ["Members", fmt(g.active_members)],
              ["Check-ins, 7 d", fmt(g.checkins_7d)],
              ["Staff seen", ago(g.last_staff_seen)],
              ["Errors, 7 d", String(g.errors_7d)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white/[0.04] px-3 py-2">
                <dt className="text-[10px] text-white/40">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-white/45">{g.paid_until ? `Paid until ${g.paid_until}` : g.trial_ends_at ? `Trial until ${g.trial_ends_at}` : "Not paying"}</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => openGymAsSupport(g.gym_id, "owner"))}
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-ink transition active:scale-[0.98]"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />} Open their gym as owner
          </button>
        </section>
      )}

      {data.other.length > 0 && (
        <section className="room-panel rounded-3xl bg-white/[0.03] p-5 ring-1 ring-white/[0.07]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/40 uppercase">Their other tickets</p>
          <ul className="mt-2 space-y-1">
            {data.other.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/support?view=all&t=${o.id}`} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/[0.04]">
                  <span className="truncate text-white/70">
                    #{o.number} {o.subject}
                  </span>
                  <ArrowRight className="ml-auto size-3.5 shrink-0 text-white/25 group-hover:text-white" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
