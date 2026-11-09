import Link from "next/link";
import { CheckCheck, Check as CheckIcon, Clock, MessageCircle, TriangleAlert } from "lucide-react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin } from "@/lib/origin";
import { formatDateTime, hoursAgoIso } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { gymixKeys } from "@/lib/whatsapp";
import { KIND_LABELS, TEMPLATE_LIST, type WhatsAppKind } from "@/lib/whatsapp-templates";
import { ActionButton } from "../members/action-button";
import { CopyField } from "../access/forms";
import { checkWhatsApp, disconnectWhatsApp } from "./whatsapp-actions";
import { AppSecretForm, ConnectForm, SenderChooser } from "./whatsapp-forms";

const PAGE = 25;

const KIND_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "renewal", label: "Renewal reminders" },
  { id: "payment", label: "Payment receipts" },
  { id: "welcome", label: "Welcome" },
  { id: "invite", label: "Invite links" },
  { id: "login", label: "Login details" },
];
const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "Any status" },
  { id: "read", label: "Read" },
  { id: "delivered", label: "Delivered" },
  { id: "sent", label: "Sent" },
  { id: "failed", label: "Failed" },
];

const STATUS: Record<string, { label: string; tone: "green" | "blue" | "red" | "gray"; icon: typeof CheckIcon }> = {
  pending: { label: "Sending", tone: "gray", icon: Clock },
  sent: { label: "Sent", tone: "blue", icon: CheckIcon },
  delivered: { label: "Delivered", tone: "green", icon: CheckCheck },
  read: { label: "Read", tone: "green", icon: CheckCheck },
  failed: { label: "Failed", tone: "red", icon: TriangleAlert },
};

function templateBadge(status: string | undefined) {
  if (status === "APPROVED") return <Badge tone="green">Approved</Badge>;
  if (status === "PENDING" || status === "IN_APPEAL") return <Badge tone="amber">In review by Meta</Badge>;
  if (status) return <Badge tone="red">{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
  return <Badge tone="gray">Not created</Badge>;
}

type Query = { kind?: string; status?: string; page?: string };

export async function WhatsAppPanel({ gymId, timeZone, query }: { gymId: string; timeZone: string; query: Query }) {
  const admin = createAdminClient();
  const kind = KIND_FILTERS.some((k) => k.id === query.kind) ? query.kind! : "";
  const status = STATUS_FILTERS.some((s) => s.id === query.status) ? query.status! : "";
  const page = Math.max(0, Math.floor(Number(query.page) || 0));

  const supabase = await createClient();
  let log = supabase
    .from("whatsapp_log")
    .select("id, created_at, kind, phone, sender, status, error, body, member_id, members(full_name)", { count: "exact" })
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (kind) log = log.eq("kind", kind);
  if (status) log = log.eq("status", status);
  const since = hoursAgoIso(30 * 24);

  const [{ data: gym }, { data: account }, gymix, enabled, { data: rows, count }, { data: recent }, origin] = await Promise.all([
    admin.from("gyms").select("whatsapp_sender, renewal_reminder_days").eq("id", gymId).single(),
    admin
      .from("gym_whatsapp_accounts")
      .select("display_phone, verified_name, templates, last_error, checked_at, app_secret, webhook_token")
      .eq("gym_id", gymId)
      .maybeSingle(),
    gymixKeys(),
    hasFeature(gymId, "whatsapp"),
    log,
    supabase.from("whatsapp_log").select("status").eq("gym_id", gymId).gte("created_at", since).limit(10000),
    requestOrigin(),
  ]);

  const sender = (gym?.whatsapp_sender ?? "gymix") as "gymix" | "own";
  const templates = (account?.templates ?? {}) as Record<string, string>;
  const approved = TEMPLATE_LIST.filter((t) => templates[t.name] === "APPROVED").length;
  const ownLabel = account
    ? `${account.display_phone ?? "Connected"}${approved < TEMPLATE_LIST.length ? ` · ${approved} of ${TEMPLATE_LIST.length} templates approved` : ""}`
    : null;

  const tally = { total: 0, delivered: 0, read: 0, failed: 0 };
  for (const r of recent ?? []) {
    tally.total++;
    if (r.status === "delivered" || r.status === "read") tally.delivered++;
    if (r.status === "read") tally.read++;
    if (r.status === "failed") tally.failed++;
  }

  const href = (p: Partial<Query>) => {
    const sp = new URLSearchParams({ tab: "whatsapp" });
    const next = { kind, status, page: "", ...p };
    if (next.kind) sp.set("kind", next.kind);
    if (next.status) sp.set("status", next.status);
    if (next.page && next.page !== "0") sp.set("page", next.page);
    return `/dashboard/settings?${sp}#log`;
  };
  const total = count ?? 0;

  return (
    <div className="space-y-6">
      {!enabled && (
        <Card className="p-5 text-sm text-muted">Automatic WhatsApp isn&apos;t switched on for your gym yet.</Card>
      )}

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Sending number</h2>
          <p className="text-sm text-muted">
            Renewal reminders{gym?.renewal_reminder_days ? ` (${gym.renewal_reminder_days} days before, set on the Gym tab)` : ""}, payment receipts, welcome
            messages, invite links and login details go out automatically from this number. No phone needed at the front desk.
          </p>
        </div>
        <SenderChooser current={sender} gymixReady={Boolean(gymix)} ownReady={Boolean(account)} ownLabel={ownLabel} />
        {sender === "own" && account && approved < TEMPLATE_LIST.length && gymix && (
          <p className="text-xs text-muted">Until Meta approves a template on your account, that message still goes out from the Gymix number, so nothing is missed.</p>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Your WhatsApp Business number</h2>
          <p className="text-sm text-muted">Use your own Meta WhatsApp Cloud API account. Gymix creates its message templates on your account and sends from your number.</p>
        </div>
        {account ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-4">
              <span className="grid size-10 place-items-center rounded-full bg-[#1fa855] text-white">
                <MessageCircle className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{account.display_phone ?? "Connected number"}</p>
                <p className="text-sm text-muted">
                  {account.verified_name ?? "WhatsApp Business"}
                  {account.checked_at && ` · checked ${formatDateTime(account.checked_at, timeZone)}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton action={checkWhatsApp} label="Check again" pendingLabel="Checking…" />
                <ActionButton action={disconnectWhatsApp} label="Disconnect" variant="ghost" confirm="Disconnect your number? Messages go back to the Gymix number. Your templates stay on your Meta account." />
              </div>
            </div>
            {account.last_error && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {account.last_error}
              </p>
            )}
            <div>
              <p className="mb-2 text-sm font-medium">Message templates</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {TEMPLATE_LIST.map((t) => (
                  <li key={t.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span>
                      {t.label}
                      <span className="block font-mono text-xs text-muted">{t.name}</span>
                    </span>
                    {templateBadge(templates[t.name])}
                  </li>
                ))}
              </ul>
            </div>
            <details className="group rounded-xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-medium">Delivered and read ticks (optional)</summary>
              <div className="mt-4 space-y-4 text-sm text-muted">
                <p>
                  To see in the log when each message is delivered and read, open your Meta app → WhatsApp → Configuration → Webhook, enter these, and
                  subscribe to the <b className="text-ink">messages</b> field. Then save your app secret below.
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-ink">Callback URL</p>
                  <CopyField label="Callback URL" value={`${origin}/api/whatsapp/webhook/${account.webhook_token}`} />
                  <p className="text-xs font-medium text-ink">Verify token</p>
                  <CopyField label="Verify token" value={account.webhook_token} secret />
                </div>
                <AppSecretForm saved={Boolean(account.app_secret)} />
              </div>
            </details>
            <details className="rounded-xl border border-line p-4">
              <summary className="cursor-pointer text-sm font-medium">Replace the keys</summary>
              <div className="mt-4">
                <ConnectForm reconnect />
              </div>
            </details>
          </>
        ) : (
          <>
            <ol className="space-y-3 text-sm">
              {[
                <>In Meta Business settings, add your number to WhatsApp Manager (a number that isn&apos;t already used in the WhatsApp app).</>,
                <>Create a system user with full control of the WhatsApp account, and generate a permanent token with the whatsapp_business_messaging and whatsapp_business_management permissions.</>,
                <>Paste the IDs and the token here. Gymix checks them with Meta, creates its message templates on your account and switches your messages to your number as Meta approves them.</>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold">{i + 1}</span>
                  <span className="text-muted">{step}</span>
                </li>
              ))}
            </ol>
            <ConnectForm />
          </>
        )}
      </Card>

      <Card id="log" className="scroll-mt-20 overflow-hidden">
        <SectionTitle>Message log</SectionTitle>
        <div className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
          {[
            { label: "Sent, last 30 days", value: tally.total },
            { label: "Delivered", value: tally.delivered },
            { label: "Read", value: tally.read },
            { label: "Failed", value: tally.failed, danger: tally.failed > 0 },
          ].map((s) => (
            <div key={s.label} className="bg-surface px-5 py-3">
              <p className="text-xs text-muted">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.danger ? "text-danger" : ""}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 px-5 py-3">
          <FilterRow items={KIND_FILTERS} active={kind} hrefFor={(id) => href({ kind: id })} label="Message type" />
          <FilterRow items={STATUS_FILTERS} active={status} hrefFor={(id) => href({ status: id })} label="Status" />
        </div>
        {!rows?.length ? (
          <EmptyState>{kind || status ? "No messages match these filters." : "No WhatsApp messages yet. They appear here as soon as one is sent."}</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {rows.map((r) => {
              const s = STATUS[r.status] ?? STATUS.pending;
              const Icon = s.icon;
              const member = r.members as { full_name: string } | null;
              return (
                <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="w-32 shrink-0 pt-0.5 text-xs text-muted tabular-nums">{formatDateTime(r.created_at, timeZone)}</span>
                  <div className="min-w-0 flex-1 basis-60">
                    <p>
                      {member && r.member_id ? (
                        <Link href={`/dashboard/members/${r.member_id}`} className="font-medium hover:underline">
                          {member.full_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-muted">Removed member</span>
                      )}
                      <span className="text-muted"> · {KIND_LABELS[r.kind as WhatsAppKind] ?? r.kind}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {r.phone ?? "No number"} · from {r.sender === "own" ? "your number" : "the Gymix number"}
                    </p>
                    {r.body && (
                      <details className="mt-1">
                        <summary className="line-clamp-1 cursor-pointer text-xs text-muted marker:content-none">{r.body}</summary>
                        <p className="mt-1 rounded-lg bg-canvas px-3 py-2 text-xs whitespace-pre-wrap text-ink">{r.body}</p>
                      </details>
                    )}
                    {r.status === "failed" && r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}
                  </div>
                  <Badge tone={s.tone}>
                    <span className="inline-flex items-center gap-1">
                      <Icon className="size-3" /> {s.label}
                    </span>
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        {total > PAGE && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
            <span className="text-muted tabular-nums">
              {page * PAGE + 1}–{Math.min(total, page * PAGE + PAGE)} of {total}
            </span>
            <span className="flex gap-2">
              {page > 0 && (
                <Link href={href({ page: String(page - 1) })} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink/40">
                  Newer
                </Link>
              )}
              {(page + 1) * PAGE < total && (
                <Link href={href({ page: String(page + 1) })} className="rounded-lg border border-line px-3 py-1.5 hover:border-ink/40">
                  Older
                </Link>
              )}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

function FilterRow({ items, active, hrefFor, label }: { items: { id: string; label: string }[]; active: string; hrefFor: (id: string) => string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {items.map((i) => (
        <Link
          key={i.id || "all"}
          href={hrefFor(i.id)}
          scroll={false}
          aria-current={i.id === active ? "true" : undefined}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition ${
            i.id === active ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-ink/40 hover:text-ink"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
