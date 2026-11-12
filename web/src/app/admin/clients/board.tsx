"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Check, CheckCircle2, Clock3, Copy, CreditCard, KeyRound, Loader2, MapPin, MessageCircle, Plus, RefreshCcw, Search, Send, Users, X } from "lucide-react";
import { showToast } from "@/components/toaster";
import { formatDate } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { Panel, Stat, ago, fmt } from "../room-ui";
import { confirmRequestPayment, createClientGym, declineRequest, markLoginSent, markRequestContacted, normalizePhone, resendLogin, type Credentials } from "./actions";

export type RequestRow = {
  id: string;
  owner_name: string;
  phone: string;
  email: string;
  gym_name: string;
  city: string | null;
  members: string | null;
  message: string | null;
  source: string | null;
  status: "new" | "contacted" | "paid" | "declined";
  notes: string | null;
  gym_id: string | null;
  created_at: string;
  contacted_at: string | null;
  paid_at: string | null;
  welcome_sent_at: string | null;
};

export type ClientRow = {
  id: string;
  name: string;
  owner: string;
  email: string;
  phone: string | null;
  createdAt: string;
  paidUntil: string | null;
  trialEndsAt: string | null;
  status: "paid" | "trial" | "expired" | "suspended";
  members: number;
  welcomeSentAt: string | null;
};

const METHODS = ["Whish", "OMT", "Cash", "Bank transfer"];
const MONTHS = [1, 3, 6, 12];

const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function paymentMessage(r: RequestRow, priceUsd: number, instructions: string) {
  const first = r.owner_name.split(" ")[0];
  return [
    `Hi ${first}, thanks for asking for Gymix for *${r.gym_name}*!`,
    "",
    `Gymix is ${usd(priceUsd)} a month for the whole gym: unlimited members and staff, the member app, payments in dollars and lira, door access and more.`,
    "",
    "*How to pay*",
    instructions.trim() || "Whish, OMT, bank transfer or cash. Tell us which suits you and we'll send the details.",
    "",
    "Once you've paid, send us the receipt here and we'll send your login right away.",
    "",
    "The Gymix team",
  ].join("\n");
}

async function waLink(phone: string, text: string) {
  const p = await normalizePhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : null;
}

export function ClientsBoard({ requests, clients, priceUsd, instructions, revenue30d }: { requests: RequestRow[]; clients: ClientRow[]; priceUsd: number; instructions: string; revenue30d: number }) {
  const [confirming, setConfirming] = useState<RequestRow | "manual" | null>(null);
  const [creds, setCreds] = useState<{ c: Credentials; requestId: string | null } | null>(null);
  const [q, setQ] = useState("");

  const cols = useMemo(
    () => ({
      new: requests.filter((r) => r.status === "new"),
      contacted: requests.filter((r) => r.status === "contacted"),
      paid: requests.filter((r) => r.status === "paid").slice(0, 12),
    }),
    [requests],
  );
  const shownClients = clients.filter((c) => !q || `${c.name} ${c.owner} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  const paying = clients.filter((c) => c.status === "paid").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-brand uppercase">Clients</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">From request to live gym</h1>
          <p className="mt-1 text-sm text-white/50">Requests come from the website. Send payment details, confirm the payment, send the login.</p>
        </div>
        <button type="button" onClick={() => setConfirming("manual")} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-brand px-5 text-sm font-semibold text-ink shadow-[0_10px_30px_-10px_rgb(200_241_53/0.7)] transition active:scale-[0.97]">
          <Plus className="size-4" /> Add a client
        </button>
      </header>

      <div className="room-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="New requests" value={cols.new.length} hint="Waiting for payment details" live={cols.new.length > 0} />
        <Stat label="Waiting for payment" value={cols.contacted.length} hint="Payment details sent" />
        <Stat label="Paying gyms" value={paying} hint={`of ${clients.length} gyms`} />
        <Stat label="Collected, 30 days" value={revenue30d} format={(n) => usd(Math.round(n))} hint="Gymix subscriptions" />
      </div>

      {/* The pipeline */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Column title="New" tone="lime" icon={Clock3} count={cols.new.length} empty="No new requests. They appear here the moment a gym asks.">
          {cols.new.map((r) => (
            <RequestCard key={r.id} r={r}>
              <PaymentButton r={r} priceUsd={priceUsd} instructions={instructions} />
              <DeclineButton id={r.id} />
            </RequestCard>
          ))}
        </Column>
        <Column title="Waiting for payment" tone="amber" icon={CreditCard} count={cols.contacted.length} empty="Requests you've sent payment details to wait here.">
          {cols.contacted.map((r) => (
            <RequestCard key={r.id} r={r} note={r.contacted_at ? `Payment details sent ${ago(r.contacted_at)}` : undefined}>
              <button type="button" onClick={() => setConfirming(r)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-ink transition active:scale-[0.97]">
                <CheckCircle2 className="size-4" /> Confirm payment
              </button>
              <PaymentButton r={r} priceUsd={priceUsd} instructions={instructions} again />
            </RequestCard>
          ))}
        </Column>
        <Column title="Live" tone="green" icon={Building2} count={cols.paid.length} empty="Gyms you've confirmed show here.">
          {cols.paid.map((r) => (
            <RequestCard key={r.id} r={r} note={r.welcome_sent_at ? `Login sent ${ago(r.welcome_sent_at)}` : "Login not sent yet"} done>
              {r.gym_id && <ResendButton gymId={r.gym_id} requestId={r.id} onCreds={(c) => setCreds({ c, requestId: r.id })} label={r.welcome_sent_at ? "Send login again" : "Send login"} />}
            </RequestCard>
          ))}
        </Column>
      </div>

      {/* Every gym */}
      <Panel
        title={`All clients · ${clients.length}`}
        action={
          <label className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.04] px-3 ring-1 ring-white/[0.07]">
            <Search className="size-4 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-40 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
          </label>
        }
        pad={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-[11px] tracking-[0.12em] text-white/40 uppercase">
              <tr>
                <th className="px-5 py-3 font-semibold">Gym</th>
                <th className="px-3 py-3 font-semibold">Owner</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 text-right font-semibold">Members</th>
                <th className="px-3 py-3 font-semibold">Login</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {shownClients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="text-xs text-white/40">Since {formatDate(c.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-white/85">{c.owner}</p>
                    <p className="text-xs text-white/40">{c.phone ?? c.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusChip status={c.status} paidUntil={c.paidUntil} trialEndsAt={c.trialEndsAt} />
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{fmt(c.members)}</td>
                  <td className="px-3 py-3 text-xs">{c.welcomeSentAt ? <span className="text-emerald-300">Sent {ago(c.welcomeSentAt)}</span> : <span className="text-white/40">Not sent</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <ResendButton gymId={c.id} onCreds={(cr) => setCreds({ c: cr, requestId: null })} label="Send login" compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shownClients.length && <p className="py-10 text-center text-sm text-white/40">No gyms match.</p>}
        </div>
      </Panel>

      {confirming && (
        <ConfirmDialog
          request={confirming === "manual" ? null : confirming}
          priceUsd={priceUsd}
          onClose={() => setConfirming(null)}
          onDone={(c, requestId) => {
            setConfirming(null);
            setCreds({ c, requestId });
          }}
        />
      )}
      {creds && <CredentialsDialog creds={creds.c} requestId={creds.requestId} onClose={() => setCreds(null)} />}
    </div>
  );
}

function Column({ title, tone, icon: Icon, count, empty, children }: { title: string; tone: "lime" | "amber" | "green"; icon: typeof Clock3; count: number; empty: string; children: React.ReactNode }) {
  const dot = { lime: "bg-brand", amber: "bg-amber-400", green: "bg-emerald-400" }[tone];
  return (
    <section className="room-panel flex min-h-[18rem] flex-col rounded-3xl bg-white/[0.02] p-3 ring-1 ring-white/[0.06]">
      <header className="flex items-center gap-2 px-2 pt-1 pb-3">
        <span className={`size-2 rounded-full ${dot}`} />
        <Icon className="size-4 text-white/50" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold tabular-nums text-white/70">{count}</span>
      </header>
      <div className="flex-1 space-y-2.5">{count ? children : <p className="px-3 py-10 text-center text-sm text-white/35">{empty}</p>}</div>
    </section>
  );
}

function RequestCard({ r, note, done = false, children }: { r: RequestRow; note?: string; done?: boolean; children: React.ReactNode }) {
  return (
    <article className="room-card rounded-2xl bg-[#11161f] p-4 ring-1 ring-white/[0.07] transition hover:ring-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{r.gym_name}</p>
          <p className="truncate text-sm text-white/60">{r.owner_name}</p>
        </div>
        <span className="shrink-0 text-xs text-white/40">{ago(r.created_at)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {r.city && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/65">
            <MapPin className="size-3" /> {r.city}
          </span>
        )}
        {r.members && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-white/65">
            <Users className="size-3" /> {r.members}
          </span>
        )}
        {r.source && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-brand">via {r.source}</span>}
      </div>
      <p className="mt-2 truncate text-xs text-white/45">
        {r.phone} · {r.email}
      </p>
      {r.message && <p className="mt-2 line-clamp-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-white/70">“{r.message}”</p>}
      {note && <p className={`mt-2 text-xs ${done ? "text-emerald-300/80" : "text-amber-200/80"}`}>{note}</p>}
      <div className="mt-3 flex gap-2">{children}</div>
    </article>
  );
}

function PaymentButton({ r, priceUsd, instructions, again = false }: { r: RequestRow; priceUsd: number; instructions: string; again?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        // Open WhatsApp first (in the click, so the browser allows it).
        const win = window.open("about:blank", "_blank");
        start(async () => {
          const url = await waLink(r.phone, paymentMessage(r, priceUsd, instructions));
          if (!url) {
            win?.close();
            return showToast("That phone number doesn't look right.", "error");
          }
          if (win) win.location.href = url;
          else window.location.href = url;
          if (!again) await markRequestContacted(r.id);
          haptics.success();
        });
      }}
      className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition active:scale-[0.97] ${again ? "px-3 text-white/70 ring-1 ring-white/10 hover:text-white" : "flex-1 bg-[#25D366] text-[#062b15]"}`}
      title="Opens WhatsApp with the payment details written for you"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
      {again ? "Again" : "Send payment details"}
    </button>
  );
}

function DeclineButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label="Decline"
      title="Decline (hide this request)"
      disabled={pending}
      onClick={() => start(() => declineRequest(id))}
      className="grid size-10 place-items-center rounded-xl text-white/40 ring-1 ring-white/10 transition hover:text-rose-300"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
    </button>
  );
}

function ResendButton({ gymId, requestId, onCreds, label, compact = false }: { gymId: string; requestId?: string; onCreds: (c: Credentials) => void; label: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resendLogin(gymId);
          if (r.error || !r.credentials) return showToast(r.error ?? "Couldn't make a new login.", "error");
          onCreds(r.credentials);
          void requestId;
        })
      }
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-1 ring-white/10 transition hover:bg-white/[0.06] active:scale-[0.97] ${compact ? "h-9 px-3 text-white/75" : "h-10 flex-1 text-white"}`}
      title="Makes a new temporary password and prepares the WhatsApp message"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
      {label}
    </button>
  );
}

function StatusChip({ status, paidUntil, trialEndsAt }: { status: ClientRow["status"]; paidUntil: string | null; trialEndsAt: string | null }) {
  const s = {
    paid: { c: "bg-emerald-400/10 text-emerald-300", t: `Paid until ${paidUntil ? formatDate(paidUntil) : ""}` },
    trial: { c: "bg-sky-400/10 text-sky-300", t: `Trial until ${trialEndsAt ? formatDate(trialEndsAt) : ""}` },
    expired: { c: "bg-rose-400/10 text-rose-300", t: "Expired" },
    suspended: { c: "bg-white/10 text-white/60", t: "Suspended" },
  }[status];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${s.c}`}>{s.t}</span>;
}

// ------------------------------------------------------------ confirm pay
function ConfirmDialog({ request, priceUsd, onClose, onDone }: { request: RequestRow | null; priceUsd: number; onClose: () => void; onDone: (c: Credentials, requestId: string | null) => void }) {
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(String(priceUsd));
  const [method, setMethod] = useState("Whish");
  const [form, setForm] = useState({ ownerName: "", email: "", phone: "", gymName: "" });
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const field = "h-11 w-full rounded-xl bg-white/[0.05] px-3.5 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-white/30 focus:ring-2 focus:ring-brand";

  return (
    <Dialog onClose={onClose} title={request ? `Payment from ${request.gym_name}` : "Add a client"}>
      <div className="space-y-5">
        {request ? (
          <div className="rounded-2xl bg-white/[0.04] p-4 text-sm">
            <p className="font-semibold text-white">{request.owner_name}</p>
            <p className="text-white/55">
              {request.phone} · {request.email}
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input className={field} placeholder="Gym name" value={form.gymName} onChange={(e) => setForm({ ...form, gymName: e.target.value })} />
            <input className={field} placeholder="Owner's name" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
            <input className={field} placeholder="WhatsApp number" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className={field} placeholder="Email (their login)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-white/45 uppercase">Months paid</p>
          <div className="grid grid-cols-5 gap-2">
            {[0, ...MONTHS].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMonths(m);
                  setAmount(String(priceUsd * m));
                }}
                className={`h-11 rounded-xl text-sm font-semibold transition active:scale-95 ${months === m ? "bg-brand text-ink" : "bg-white/[0.05] text-white/70 ring-1 ring-white/10"}`}
              >
                {m === 0 ? "Trial" : m}
              </button>
            ))}
          </div>
        </div>
        {months > 0 && (
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <div>
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-white/45 uppercase">Amount</p>
              <label className="flex h-11 items-center rounded-xl bg-white/[0.05] px-3.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-brand">
                <span className="text-white/40">$</span>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="w-full bg-transparent pl-1 text-sm font-semibold text-white outline-none" />
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-white/45 uppercase">Paid with</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => setMethod(m)} className={`h-11 rounded-xl text-xs font-semibold transition active:scale-95 ${method === m ? "bg-white text-ink" : "bg-white/[0.05] text-white/70 ring-1 ring-white/10"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {error && <p className="shake-x rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{error}</p>}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const payment = { months, amountUsd: Number(amount) || 0, method };
              const r = request ? await confirmRequestPayment(request.id, payment) : await createClientGym({ ...form, ...payment });
              if (r.error || !r.credentials) {
                haptics.error();
                return setError(r.error ?? "Something went wrong.");
              }
              haptics.success();
              onDone(r.credentials, request?.id ?? null);
            })
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />}
          {pending ? "Creating their gym…" : months > 0 ? `Confirm ${usd(Number(amount) || 0)} and create the gym` : "Create the gym on a trial"}
        </button>
        <p className="text-center text-xs text-white/40">Creates their login and gym, records the payment, then prepares the WhatsApp message with their login.</p>
      </div>
    </Dialog>
  );
}

// -------------------------------------------------------- credentials
function CredentialsDialog({ creds, requestId, onClose }: { creds: Credentials; requestId: string | null; onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Dialog onClose={onClose} title={`${creds.gymName} is ready`}>
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-brand/[0.08] p-4 ring-1 ring-brand/25">
          <span className="check-pop grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-ink">
            <Check className="size-6" strokeWidth={3} />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-white">Login for {creds.ownerName}</p>
            <p className="text-white/60">{creds.paidUntil ? `Paid until ${formatDate(creds.paidUntil)}` : "On the free trial"}</p>
          </div>
        </div>
        <dl className="grid gap-2 text-sm">
          <Row k="Email" v={creds.email} />
          <Row k="Password" v={creds.password ?? "Their existing password"} mono={Boolean(creds.password)} />
          <Row k="Log in at" v={creds.loginUrl} />
        </dl>
        <div className="rounded-2xl bg-[#0b141a] p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-white/85 ring-1 ring-white/[0.06]">{creds.message}</div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          {creds.whatsappUrl ? (
            <a
              href={creds.whatsappUrl}
              target="_blank"
              rel="noopener"
              onClick={() => {
                haptics.success();
                setSent(true);
                markLoginSent(creds.gymId, requestId);
              }}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-semibold text-[#062b15] transition active:scale-[0.98]"
            >
              {sent ? <CheckCircle2 className="size-5" /> : <Send className="size-5" />}
              {sent ? "Opened in WhatsApp. Press send there." : `Send on WhatsApp to ${creds.phone}`}
            </a>
          ) : (
            <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-200">No WhatsApp number on file. Copy the message and send it yourself.</p>
          )}
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(creds.message);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/[0.06]"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        {!creds.whatsappUrl && (
          <button type="button" onClick={() => markLoginSent(creds.gymId, requestId).then(onClose)} className="flex h-10 w-full items-center justify-center gap-2 text-sm text-white/60 hover:text-white">
            <RefreshCcw className="size-4" /> I sent it another way
          </button>
        )}
      </div>
    </Dialog>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-4 py-2.5">
      <dt className="text-white/45">{k}</dt>
      <dd className={`truncate font-semibold text-white ${mono ? "font-mono tracking-wide text-brand" : ""}`}>{v}</dd>
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4">
      <button aria-label="Close" className="room-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label={title} className="room-pop relative w-full max-w-lg rounded-[2rem] bg-[#11161f] p-6 shadow-2xl ring-1 ring-white/10">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
