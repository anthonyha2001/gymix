"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, LifeBuoy, Loader2, MessageSquarePlus, Send, X } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { myTickets, openTicket, replyTicket, ticketThread, type MyTicket, type TicketMessage } from "@/app/support-actions";

const CATEGORIES = [
  { value: "question", label: "Question" },
  { value: "bug", label: "Something's broken" },
  { value: "billing", label: "Billing" },
  { value: "hardware", label: "Door / reader" },
  { value: "feature", label: "Idea" },
];

const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86_400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86_400)} d ago`;
};

// Gym staff's line to Gymix: a Help button in the dashboard header that opens
// a panel with their requests and a chat with the Gymix team. Opens itself on
// ?support=<ticket> (the link in the "Gymix support replied" notification).
export function SupportWidget({ gymId }: { gymId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "new" | string>("list");
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const unread = tickets?.filter((t) => t.user_unread).length ?? 0;

  const load = useCallback(() => myTickets().then(setTickets).catch(() => {}), []);
  useEffect(() => {
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const id = params.get("support");
    if (!id) return;
    const t = setTimeout(() => {
      setOpen(true);
      setView(id);
    }, 0);
    const u = new URLSearchParams(params);
    u.delete("support");
    router.replace(`${path}${u.size ? `?${u}` : ""}`, { scroll: false });
    return () => clearTimeout(t);
  }, [params, path, router]);

  return (
    <>
      <button
        type="button"
        aria-label="Help from Gymix"
        title="Help from Gymix"
        onClick={() => {
          setOpen(true);
          setView("list");
          load();
        }}
        className="relative grid size-9 place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
      >
        <LifeBuoy className="size-5" />
        {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-brand ring-2 ring-surface" />}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60]">
          <button aria-label="Close" className="room-fade absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <aside className="support-sheet absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-surface shadow-2xl">
            <header className="flex items-center gap-3 bg-ink px-5 py-4 text-white">
              {view !== "list" && (
                <button aria-label="Back" onClick={() => setView("list")} className="grid size-8 place-items-center rounded-lg hover:bg-white/10">
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <span className="grid size-9 place-items-center rounded-xl bg-brand text-ink">
                <LifeBuoy className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Gymix support</span>
                <span className="block text-xs text-white/55">We usually answer within a few hours</span>
              </span>
              <button aria-label="Close" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-white/10">
                <X className="size-4" />
              </button>
            </header>
            {view === "list" ? (
              <List tickets={tickets} onOpen={setView} onNew={() => setView("new")} />
            ) : view === "new" ? (
              <NewTicket
                gymId={gymId}
                onSent={(id) => {
                  load();
                  setView(id);
                }}
              />
            ) : (
              <Conversation id={view} onChange={load} />
            )}
          </aside>
        </div>
      )}
    </>
  );
}

function List({ tickets, onOpen, onNew }: { tickets: MyTicket[] | null; onOpen: (id: string) => void; onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="p-4">
        <button type="button" onClick={onNew} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-semibold text-white transition active:scale-[0.98]">
          <MessageSquarePlus className="size-4" /> Ask Gymix a question
        </button>
      </div>
      <ul className="stagger flex-1 divide-y divide-line overflow-auto border-t border-line">
        {tickets === null && (
          <li className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-muted" />
          </li>
        )}
        {tickets?.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-canvas">
              <span className={`size-2 shrink-0 rounded-full ${t.user_unread ? "bg-brand ring-4 ring-brand/20" : "bg-transparent"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${t.user_unread ? "font-bold" : "font-medium"}`}>{t.subject}</span>
                <span className="block text-xs text-muted">
                  {t.status === "solved" ? "Solved" : t.status === "pending" ? "Gymix replied" : "Waiting for Gymix"} · {ago(t.last_message_at)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {tickets?.length === 0 && <li className="px-6 py-12 text-center text-sm text-muted">No questions yet. Anything at all, ask us.</li>}
      </ul>
    </div>
  );
}

function NewTicket({ gymId, onSent }: { gymId: string; onSent: (id: string) => void }) {
  const [category, setCategory] = useState("question");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const path = usePathname();
  return (
    <div className="flex-1 space-y-4 overflow-auto p-5">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.value} type="button" onClick={() => setCategory(c.value)} className={`h-9 rounded-full px-3.5 text-xs font-semibold transition active:scale-95 ${category === c.value ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"}`}>
            {c.label}
          </button>
        ))}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={140} placeholder="In a few words" className="h-12 w-full rounded-2xl bg-canvas px-4 text-sm outline-none focus:ring-2 focus:ring-brand" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={6} placeholder="Tell us what happened, or what you need. Screenshots help: send them on WhatsApp after." className="w-full resize-none rounded-2xl bg-canvas px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand" />
      {error && <p className="shake-x rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await openTicket({ subject, body, category, gymId, path });
            if (r.error || !r.id) {
              haptics.error();
              return setError(r.error ?? "Couldn't send.");
            }
            haptics.success();
            onSent(r.id);
          })
        }
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to Gymix
      </button>
    </div>
  );
}

function Conversation({ id, onChange }: { id: string; onChange: () => void }) {
  const [data, setData] = useState<{ ticket: MyTicket | null; messages: TicketMessage[] } | null>(null);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => ticketThread(id).then(setData), [id]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [data?.messages.length]);

  if (!data) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-5 animate-spin text-muted" />
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <p className="truncate font-semibold">{data.ticket?.subject}</p>
        {data.ticket?.status === "solved" && (
          <p className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="size-3.5" /> Solved. Write again to reopen it.
          </p>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-auto bg-canvas px-4 py-5">
        {data.messages.map((m) => (
          <div key={m.id} className={`room-msg flex ${m.from_gymix ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-3xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.from_gymix ? "rounded-bl-md bg-ink text-white" : "rounded-br-md bg-brand text-ink"}`}>
              {m.from_gymix && <p className="mb-0.5 text-[10px] font-bold tracking-[0.14em] text-brand uppercase">Gymix</p>}
              {m.body}
              <p className={`mt-1 text-[10px] ${m.from_gymix ? "text-white/40" : "text-ink/50"}`}>{ago(m.created_at)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="flex items-end gap-2 border-t border-line p-3">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a reply" className="flex-1 resize-none rounded-2xl bg-canvas px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand" />
        <button
          type="button"
          aria-label="Send"
          disabled={pending || !body.trim()}
          onClick={() =>
            start(async () => {
              const r = await replyTicket(id, body);
              if (!r.error) {
                haptics.success();
                setBody("");
                await load();
                onChange();
              }
            })
          }
          className="grid size-11 place-items-center rounded-2xl bg-ink text-white transition active:scale-90 disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}
