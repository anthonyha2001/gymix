import type { Metadata } from "next";
import { HoverLink } from "@/components/hover-link";
import { notFound } from "next/navigation";
import { Eye, Lock, MessageCircle, Pencil, Plus } from "lucide-react";
import { RowMenu } from "@/components/row-menu";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { ProgramEditorModal } from "@/components/program-editor-modal";
import { ChatModal } from "@/components/chat-modal";
import { MemberPreviewModal } from "../preview-modal";
import { Dialog } from "@/components/dialog";
import { InviteShare } from "@/components/invite-share";
import {
  Badge,
  Card,
  EmptyState,
  SectionTitle,
  buttonClass,
} from "@/components/ui";
import { memberInviteMessage } from "@/lib/invite-link";
import { requestOrigin } from "@/lib/origin";
import {
  INVOICE_STATUS,
  MEMBER_STATUS,
  PAYMENT_METHOD_LABELS,
  addDays,
  daysBetween,
  formatDate,
  formatDateTime,
  formatLBP,
  formatUSD,
  todayIn,
  type InvoiceStatus,
  type MemberStatus,
} from "@/lib/format";
import {
  BILLING_ROLES,
  COACH_ROLES,
  MANAGER_ROLES,
} from "@/lib/roles";
import { createMemberProgram } from "../../programs/actions";
import { StartProgramForm } from "../../programs/forms";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  adjustMembership,
  changeMembership,
  deleteCheckin,
  deleteMember,
  inviteToPortal,
  recordPayment,
  refundPayment,
  removePortalAccess,
  sellMembership,
  setArchived,
  updateMember,
  voidInvoice,
} from "../actions";
import { ActionButton } from "../action-button";
import { ResetPassword } from "../reset-password";
import { SubscribeCourseForm } from "../course-form";
import { WEEKDAYS, hhmm } from "@/lib/schedule";
import { cancelCourseSubscription, subscribeMemberForm } from "@/app/schedule-actions";
import { AdjustMembershipForm, RefundForm } from "../admin-forms";
import { CheckInButton } from "../check-in-button";
import { MemberForm } from "../member-form";
import { PaymentForm } from "../payment-form";
import { SellForm } from "../sell-form";
import { MeasurementsPanel } from "@/components/measurements-panel";
import { PtSessionForm } from "@/components/schedule-forms";
import { PT_STATUS } from "@/lib/schedule";
import { schedulePtSession, updatePtSession } from "@/app/schedule-actions";
import { removeProgram, setProgramActive } from "@/app/program-actions";
import { openChatAsStaff } from "@/app/chat-actions";

export const metadata: Metadata = { title: "Member" };

const TABS = ["overview", "billing", "training", "body"] as const;

export default function MemberPage({
  params,
  searchParams,
}: PageProps<"/dashboard/members/[id]">) {
  return (
    <div className="max-w-5xl space-y-6">
      <HoverLink
        href="/dashboard/members"
        className="text-sm text-muted hover:text-ink"
      >
        ← Members
      </HoverLink>
      {/* No loading boundary of its own: on a click inside the dashboard the
          profile appears as soon as the server answers, instead of behind a
          skeleton React keeps up for at least 300ms. Direct visits use the
          layout's boundary. */}
      <MemberContent params={params} searchParams={searchParams} />
    </div>
  );
}

async function MemberContent({
  params,
  searchParams,
}: {
  params: PageProps<"/dashboard/members/[id]">["params"];
  searchParams: PageProps<"/dashboard/members/[id]">["searchParams"];
}) {
  const { id } = await params;
  const query = await searchParams;
  const { viewer: staffViewer, membership: staff } = await requireStaff();
  const canBill = BILLING_ROLES.includes(staff.role);
  const tabs = TABS.filter((t) => t !== "billing" || canBill);
  const tab = activeTab(query.tab, tabs);
  const base = `/dashboard/members/${id}`;
  const here = `${base}?tab=${tab}`;
  const openProgram = typeof query.program === "string" ? query.program : null;
  const canManage = MANAGER_ROLES.includes(staff.role);
  const supabase = await createClient();
  await supabase.rpc("freeze_unpaid_members", { p_gym_id: staff.gymId });

  const { data: member } = await supabase
    .from("member_overview")
    .select("*")
    .eq("id", id)
    .eq("gym_id", staff.gymId)
    .maybeSingle();
  if (!member) notFound();

  const today = todayIn(staff.timezone);
  const [memberships, invoices, payments, checkins, plans, invite] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("*")
        .eq("member_id", id)
        .order("starts_on", { ascending: false })
        .limit(20),
      canBill
        ? supabase
            .from("invoice_summary")
            .select("*")
            .eq("member_id", id)
            .order("number", { ascending: false })
        : null,
      canBill
        ? supabase
            .from("payments")
            .select("*")
            .eq("member_id", id)
            .order("paid_at", { ascending: false })
            .limit(20)
        : null,
      supabase
        .from("checkins")
        .select("*")
        .eq("member_id", id)
        .order("checked_in_at", { ascending: false })
        .limit(10),
      canBill
        ? supabase
            .from("membership_plans")
            .select("*")
            .eq("gym_id", staff.gymId)
            .eq("is_active", true)
            .order("price_usd")
        : null,
      !member.user_id
        ? supabase
            .from("invites")
            .select("token, expires_at")
            .eq("gym_id", staff.gymId)
            .eq("member_id", id)
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : null,
    ]);

  const canCoach = COACH_ROLES.includes(staff.role);
  const [
    { data: programs },
    { data: sessions },
    { data: templates },
    { data: ptSessions },
    { data: coaches },
  ] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, kind, is_active, updated_at")
      .eq("member_id", id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("workout_sessions")
      .select("id, day_name, started_at, finished_at, set_logs(count)")
      .eq("member_id", id)
      .order("started_at", { ascending: false })
      .limit(5),
    canCoach
      ? supabase
          .from("programs")
          .select("id, name")
          .eq("gym_id", staff.gymId)
          .eq("kind", "template")
          .order("name")
      : { data: [] },
    supabase
      .from("pt_sessions")
      .select(
        "id, starts_at, duration_min, status, trainer:profiles!pt_sessions_trainer_id_fkey(full_name)",
      )
      .eq("member_id", id)
      .in("status", ["requested", "confirmed"])
      .order("starts_at")
      .limit(10),
    supabase.rpc("gym_coaches", { p_gym_id: staff.gymId }),
  ]);
  const [{ data: courseSubs }, { data: courses }] = await Promise.all([
    supabase
      .from("class_subscriptions")
      .select("id, starts_on, ends_on, price_usd, status, classes(name), invoice_summary(balance_usd)")
      .eq("member_id", id)
      .order("starts_on", { ascending: false })
      .limit(12),
    supabase
      .from("classes")
      .select("id, name, weekday, start_time, monthly_price_usd")
      .eq("gym_id", staff.gymId)
      .eq("is_active", true)
      .not("monthly_price_usd", "is", null)
      .order("name"),
  ]);

  const origin = await requestOrigin();
  const nowIso = new Date().toISOString();
  const inviteUrl = invite?.data ? `${origin}/join/${invite.data.token}` : null;
  const firstName = member.full_name?.split(" ")[0] ?? "there";
  const status = MEMBER_STATUS[(member.status ?? "none") as MemberStatus];
  const currentId = member.membership_id;
  const current = memberships.data?.find((m) => m.id === currentId) ?? null;
  // Renewing an active membership starts the day after it ends.
  const defaultStart =
    current && current.ends_on && current.ends_on >= today && !current.frozen_on
      ? addDays(current.ends_on, 1)
      : today;
  const daysLeft =
    current && member.status === "active"
      ? daysBetween(today, current.ends_on)
      : null;

  return (
    <div className="space-y-6">
      {member.unpaid_frozen_at && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-danger" />
          <p>
            <span className="font-semibold text-danger">Account frozen for an unpaid balance</span> since{" "}
            {formatDate(member.unpaid_frozen_at.slice(0, 10))}. Their member app shows only its home page and check-in is
            refused. Once the balance is paid, their next check-in unfreezes it.
          </p>
        </div>
      )}
      {/* Header */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {member.full_name}
              </h1>
              <Badge tone={status.tone}>{status.label}</Badge>
              {canBill && Number(member.balance_usd) > 0 && (
                <Badge tone="red">Owes {formatUSD(member.balance_usd)}</Badge>
              )}
              {member.archived_at && <Badge tone="gray">Archived</Badge>}
              {member.unpaid_frozen_at && <Badge tone="red">Frozen, unpaid</Badge>}
            </div>
            <p className="text-sm text-muted">
              {[member.phone, member.email].filter(Boolean).join(" · ") ||
                "No contact details"}
            </p>
            {member.notes && (
              <p className="text-sm">
                <span className="text-muted">Notes:</span> {member.notes}
              </p>
            )}
            <p className="text-xs text-muted">
              Check-in code{" "}
              <span className="font-mono font-medium text-ink">
                {member.checkin_code}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <HoverLink
              href={`${here}&preview=${member.id}`}
              scroll={false}
              className={buttonClass("secondary")}
            >
              <Eye className="size-4" /> View as member
            </HoverLink>
            {canBill && (
              <Dialog
                label={current ? "Renew / sell" : "Sell membership"}
                icon={<Plus className="size-4" />}
                title={
                  current ? "Renew or sell a membership" : "Sell a membership"
                }
                description={member.full_name ?? undefined}
                size="lg"
              >
                <SellForm
                  action={sellMembership.bind(null, member.id!)}
                  plans={(plans?.data ?? []).map((p) => ({
                    ...p,
                    price_usd: Number(p.price_usd),
                  }))}
                  defaultStart={defaultStart}
                  today={today}
                  rate={staff.lbpRate}
                />
              </Dialog>
            )}
            {canBill && <CheckInButton memberId={member.id!} />}
            {member.user_id && (
              <ActionButton
                action={openChatAsStaff.bind(null, member.id!, here)}
                label="Message"
                icon={<MessageCircle className="size-[18px]" />}
                variant="secondary"
                className="h-10 w-10 shrink-0 px-0!"
              />
            )}
            {canBill && (
              <Dialog
                label={<span className="sr-only">Edit details</span>}
                icon={<Pencil className="size-[18px]" />}
                triggerClassName="h-10 w-10 shrink-0 px-0!"
                title="Edit member"
                variant="secondary"
                size="lg"
              >
                <MemberForm
                  action={updateMember.bind(null, member.id!)}
                  initial={{
                    full_name: member.full_name!,
                    phone: member.phone,
                    email: member.email,
                    notes: member.notes,
                  }}
                  submitLabel="Save details"
                />
              </Dialog>
            )}
            <RowMenu
              label="More actions"
              items={[
                canBill && {
                  kind: "action",
                  label: member.archived_at
                    ? "Restore member"
                    : "Archive member",
                  action: setArchived.bind(
                    null,
                    member.id!,
                    !member.archived_at,
                  ),
                  confirm: member.archived_at
                    ? undefined
                    : "Archive this member? They're hidden from lists but their history stays. You can restore them any time.",
                },
                canManage && {
                  kind: "action",
                  label: "Delete permanently",
                  danger: true,
                  action: deleteMember.bind(null, member.id!),
                  confirm: `Delete ${member.full_name} permanently? Only possible if they were never billed — otherwise archive them.`,
                },
              ]}
            />
          </div>
        </div>
      </Card>

      <PageTabs instant
        base={base}
        active={tab}
        tabs={tabs.map((t) => ({
          id: t,
          label: {
            overview: "Overview",
            billing: "Billing",
            training: "Training",
            body: "Body",
          }[t],
        }))}
      />

      {openProgram && canCoach && (
        <ProgramEditorModal
          programId={openProgram}
          gymId={staff.gymId}
          closePath={here}
        />
      )}
      {typeof query.preview === "string" && (
        <MemberPreviewModal memberId={member.id!} viewerId={staffViewer.id} membership={staff} />
      )}
      {typeof query.c === "string" && <ChatModal conversationId={query.c} viewerId={staffViewer.id} timeZone={staff.timezone} as="staff" />}

      {/* Portal access */}
      <TabPanel id="overview" tabs={tabs}>{canBill && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          {member.user_id ? (
            <>
              <p className="text-sm">
                <span className="font-medium">Member portal:</span>{" "}
                <span className="text-muted">active — they can log in.</span>
              </p>
              <span className="flex flex-wrap items-center gap-2">
              <Dialog label="Reset password" variant="secondary" triggerClassName="h-8 px-3" title={`New password for ${member.full_name}`}>
                <ResetPassword
                  memberId={member.id!}
                  firstName={firstName}
                  phone={member.phone}
                  gymName={staff.gymName}
                  loginUrl={`${origin}/login`}
                />
              </Dialog>
              <ActionButton
                action={async () => {
                  "use server";
                  await removePortalAccess(member.id!);
                  return { success: "Portal access removed." };
                }}
                label="Remove access"
                variant="ghost"
                className="h-8 px-3"
                confirm="Remove their portal access? Their membership and history stay."
              />
              </span>
            </>
          ) : invite?.data && invite.data.expires_at > nowIso ? (
            <>
              <div className="text-sm">
                <p className="font-medium">Invite to the member portal</p>
                <p className="text-muted">
                  Send this personal link — one tap and they&apos;re in their
                  portal, nothing to sign up for.
                </p>
              </div>
              <InviteShare
                url={inviteUrl!}
                message={memberInviteMessage(
                  firstName,
                  staff.gymName,
                  inviteUrl!,
                )}
                phone={member.phone}
              />
            </>
          ) : (
            <>
              <p className="text-sm">
                <span className="font-medium">Member portal:</span>{" "}
                <span className="text-muted">
                  {invite?.data
                    ? "the invite link expired."
                    : "not invited yet."}
                </span>
              </p>
              <ActionButton
                action={inviteToPortal.bind(null, member.id!)}
                label={invite?.data ? "New invite link" : "Create invite link"}
                variant="secondary"
                className="h-9"
              />
            </>
          )}
        </Card>
      )}</TabPanel>

      {/* Current membership */}
      <TabPanel id="overview" tabs={tabs}>{(
        <Card>
          <SectionTitle>Current membership</SectionTitle>
          {!current ? (
            <EmptyState>
              No membership yet.{canBill && " Use “Sell membership” above."}
            </EmptyState>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-5 py-4">
              <div>
                <p className="font-medium">{current.plan_name}</p>
                <p className="text-sm text-muted">
                  {formatDate(current.starts_on)} →{" "}
                  {formatDate(current.ends_on)}
                  {daysLeft !== null &&
                    ` · ${daysLeft === 0 ? "last day today" : `${daysLeft} days left`}`}
                  {current.visit_limit &&
                    ` · ${current.visit_limit - current.visits_used} of ${current.visit_limit} visits left`}
                  {current.frozen_on &&
                    ` · frozen since ${formatDate(current.frozen_on)}`}
                </p>
              </div>
              {canBill && (
                <RowMenu
                  label="Membership actions"
                  items={[
                    member.status !== "expired" &&
                      (current.frozen_on
                        ? {
                            kind: "action",
                            label: "Unfreeze",
                            action: changeMembership.bind(
                              null,
                              current.id,
                              "unfreeze",
                            ),
                          }
                        : {
                            kind: "action",
                            label: "Freeze",
                            action: changeMembership.bind(
                              null,
                              current.id,
                              "freeze",
                            ),
                            confirm:
                              "Freeze this membership? The days it stays frozen are added back when you unfreeze.",
                          }),
                    canManage && {
                      kind: "dialog",
                      label: "Edit dates & visits",
                      title: `Edit ${current.plan_name}`,
                      content: (
                        <AdjustMembershipForm
                          action={adjustMembership.bind(null, current.id)}
                          startsOn={current.starts_on}
                          endsOn={current.ends_on}
                          visitLimit={current.visit_limit}
                          visitsUsed={current.visits_used}
                        />
                      ),
                    },
                    canManage && {
                      kind: "action",
                      label: "Cancel membership",
                      danger: true,
                      action: changeMembership.bind(null, current.id, "cancel"),
                      confirm:
                        "Cancel this membership? This can't be undone. Invoices stay as they are.",
                    },
                  ]}
                />
              )}
            </div>
          )}
        </Card>
      )}</TabPanel>

      <TabPanel id="billing" tabs={tabs}>{canBill && (
        <Card>
          <SectionTitle>Invoices</SectionTitle>
          {!invoices?.data?.length ? (
            <EmptyState>No invoices yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {invoices.data.map((inv) => {
                const s = INVOICE_STATUS[inv.status as InvoiceStatus];
                const balance = Number(inv.balance_usd);
                const hasPayments = Number(inv.paid_usd) > 0;
                return (
                  <li key={inv.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-mono text-xs text-muted">
                        #{String(inv.number).padStart(4, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        {inv.description}
                      </span>
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <span className="w-40 text-right text-sm tabular-nums">
                        {formatUSD(inv.total_usd)}
                        {Number(inv.discount_usd) > 0 && (
                          <span className="block text-xs text-muted">
                            after {formatUSD(inv.discount_usd)} discount
                          </span>
                        )}
                        {balance > 0 && inv.status !== "void" && (
                          <span className="block text-xs text-danger">
                            {formatUSD(balance)} due
                          </span>
                        )}
                      </span>
                    </div>
                    {inv.status !== "void" && (balance > 0 || canManage) && (
                      <div className="mt-2 flex flex-wrap items-start gap-3">
                        {balance > 0 && (
                          <Dialog
                            label="Record payment"
                            title={`Payment for invoice #${String(inv.number).padStart(4, "0")}`}
                            description={`${formatUSD(balance)} due`}
                            size="lg"
                            triggerClassName="h-9"
                          >
                            <PaymentForm
                              action={recordPayment.bind(null, inv.id!)}
                              balance={balance}
                              rate={staff.lbpRate}
                            />
                          </Dialog>
                        )}
                        {canManage && (
                          <RowMenu
                            label={`Actions for invoice ${inv.number}`}
                            items={[
                              hasPayments
                                ? {
                                    kind: "link",
                                    label:
                                      "To void: refund its payments first (below)",
                                    href: "#payments",
                                  }
                                : {
                                    kind: "action",
                                    label: "Void invoice",
                                    danger: true,
                                    action: voidInvoice.bind(null, inv.id!),
                                    confirm:
                                      "Void this invoice? Its membership will be cancelled too.",
                                  },
                            ]}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}</TabPanel>

      <div className="space-y-6">
        <TabPanel id="billing" tabs={tabs}>{canBill && (
          <Card>
            <SectionTitle>
              <span id="payments">Payments</span>
            </SectionTitle>
            {!payments?.data?.length ? (
              <EmptyState>No payments yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {payments.data.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span>
                      {PAYMENT_METHOD_LABELS[p.method]}
                      <span className="block text-xs text-muted">
                        {formatDateTime(p.paid_at, staff.timezone)}
                        {p.amount_lbp ? ` · ${formatLBP(p.amount_lbp)}` : ""}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-medium tabular-nums">
                        {formatUSD(p.amount_usd)}
                      </span>
                      {canManage && (
                        <RowMenu
                          label="Payment actions"
                          items={[
                            {
                              kind: "dialog",
                              label: "Refund",
                              danger: true,
                              title: "Refund payment",
                              content: (
                                <RefundForm
                                  action={refundPayment.bind(null, p.id)}
                                  amountUsd={Number(p.amount_usd)}
                                />
                              ),
                            },
                          ]}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}</TabPanel>

        <TabPanel id="overview" tabs={tabs}>{(
          <Card>
            <SectionTitle>Recent visits</SectionTitle>
            {!checkins.data?.length ? (
              <EmptyState>No visits yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {checkins.data.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                  >
                    <span>
                      {formatDateTime(c.checked_in_at, staff.timezone)}
                    </span>
                    <span className="flex items-center gap-1">
                      {c.allowed ? (
                        <Badge tone="green">Checked in</Badge>
                      ) : (
                        <Badge tone="red">{c.reason ?? "Denied"}</Badge>
                      )}
                      {canManage && (
                        <RowMenu
                          label="Check-in actions"
                          items={[
                            {
                              kind: "action",
                              label: "Delete check-in",
                              danger: true,
                              action: deleteCheckin.bind(null, c.id),
                              confirm:
                                "Delete this check-in? If it used a punch-card visit, the visit is given back.",
                            },
                          ]}
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}</TabPanel>
      </div>

      <TabPanel id="training" tabs={tabs}>{(
        <Card>
          <SectionTitle
            action={
              canCoach && (
                <Dialog
                  label="Build program"
                  icon={<Plus className="size-4" />}
                  title={`Program for ${member.full_name}`}
                  description="Start blank or from one of your templates."
                  size="lg"
                  triggerClassName="h-9"
                >
                  <StartProgramForm
                    action={createMemberProgram.bind(
                      null,
                      member.id!,
                      null,
                      `${base}?tab=training`,
                    )}
                    templates={templates ?? []}
                    defaultName={`Program – ${member.full_name?.split(" ")[0]}`}
                  />
                </Dialog>
              )
            }
          >
            Training
          </SectionTitle>
          <div className="grid gap-px border-t border-line bg-line md:grid-cols-2">
            <div className="bg-surface">
              <p className="px-5 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
                Programs
              </p>
              {!programs?.length ? (
                <EmptyState>
                  <span className="block pt-2">No programs yet.</span>
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {programs.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                    >
                      {canCoach ? (
                        <HoverLink
                          href={`${base}?tab=training&program=${p.id}`}
                          scroll={false}
                          className="font-medium hover:underline"
                        >
                          {p.name}
                        </HoverLink>
                      ) : (
                        <span className="font-medium">{p.name}</span>
                      )}
                      <span className="flex gap-1">
                        {p.kind === "self" && <Badge tone="gray">Own</Badge>}
                        {p.kind === "trainer" && !p.is_active ? (
                          <Badge tone="amber">Draft</Badge>
                        ) : p.is_active ? (
                          <Badge tone="green">Active</Badge>
                        ) : (
                          <Badge tone="gray">Old</Badge>
                        )}
                        {canCoach && (
                          <RowMenu
                            label={`Actions for ${p.name}`}
                            items={[
                              {
                                kind: "link",
                                label: "Open",
                                href: `${base}?tab=training&program=${p.id}`,
                              },
                              p.is_active && {
                                kind: "action",
                                label: "Retire (keep history)",
                                action: setProgramActive.bind(
                                  null,
                                  p.id,
                                  false,
                                ),
                              },
                              {
                                kind: "action",
                                label: "Delete",
                                danger: true,
                                action: removeProgram.bind(null, p.id),
                                confirm: `Delete “${p.name}”? Logged workouts stay in the member's history.`,
                              },
                            ]}
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-surface">
              <p className="px-5 pt-3 text-xs font-medium uppercase tracking-wide text-muted">
                Recent workouts
              </p>
              {!sessions?.length ? (
                <EmptyState>
                  <span className="block pt-2">No workouts logged yet.</span>
                </EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                    >
                      <span>
                        {s.day_name ?? "Workout"}
                        <span className="block text-xs text-muted">
                          {formatDateTime(s.started_at, staff.timezone)}
                        </span>
                      </span>
                      <span className="text-xs text-muted">
                        {s.set_logs[0]?.count ?? 0} sets
                        {!s.finished_at && " · in progress"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      )}</TabPanel>

      <TabPanel id="training" tabs={tabs}>{(canBill || (courseSubs?.length ?? 0) > 0) && (
        <Card>
          <SectionTitle
            action={
              canBill &&
              (courses?.length ?? 0) > 0 && (
                <Dialog label="Subscribe to course" icon={<Plus className="size-4" />} title={`Monthly course for ${member.full_name}`} triggerClassName="h-9">
                  <SubscribeCourseForm
                    action={subscribeMemberForm.bind(null, member.id!)}
                    defaultStart={today}
                    courses={(courses ?? []).map((c) => ({
                      id: c.id,
                      label: `${c.name}, ${WEEKDAYS[c.weekday]} ${hhmm(c.start_time)}, ${formatUSD(c.monthly_price_usd)}/month`,
                    }))}
                  />
                </Dialog>
              )
            }
          >
            Monthly courses
          </SectionTitle>
          {!courseSubs?.length ? (
            <EmptyState>
              {(courses?.length ?? 0) > 0 ? "Not subscribed to any course." : "No monthly courses yet. Set a monthly price on a class in the timetable."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {courseSubs.map((s) => {
                const owed = Number(s.invoice_summary?.balance_usd ?? 0);
                const current = s.status === "active" && s.ends_on >= today;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{s.classes?.name}</span>
                      <span className="block text-xs text-muted">
                        {formatDate(s.starts_on)} – {formatDate(s.ends_on)} · {formatUSD(s.price_usd)}
                        {owed > 0 && <span className="text-danger"> · owes {formatUSD(owed)}</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      {s.status === "cancelled" ? (
                        <Badge tone="gray">Cancelled</Badge>
                      ) : current ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="gray">Ended</Badge>
                      )}
                      {canBill && current && (
                        <RowMenu
                          label="Course actions"
                          items={[
                            {
                              kind: "action",
                              label: "Cancel subscription",
                              danger: true,
                              action: cancelCourseSubscription.bind(null, s.id),
                              confirm: "Cancel this course subscription? Its coming sessions are released. The invoice stays: void it from Billing if needed.",
                            },
                          ]}
                        />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}</TabPanel>

      <TabPanel id="training" tabs={tabs}>{(canCoach || canBill) && (
        <Card>
          <SectionTitle
            action={
              <Dialog
                label="Book session"
                icon={<Plus className="size-4" />}
                title={`PT session for ${member.full_name}`}
                size="lg"
                triggerClassName="h-9"
              >
                <PtSessionForm
                  action={schedulePtSession.bind(null, member.id!)}
                  coaches={coaches ?? []}
                  defaultDate={today}
                  today={today}
                  submitLabel="Book session"
                />
              </Dialog>
            }
          >
            Personal training
          </SectionTitle>
          {!ptSessions?.length && (
            <EmptyState>No upcoming sessions.</EmptyState>
          )}
          {ptSessions && ptSessions.length > 0 && (
            <ul className="divide-y divide-line border-t border-line">
              {ptSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <span>
                    {formatDateTime(s.starts_at, staff.timezone)} ·{" "}
                    {s.duration_min} min
                    <span className="block text-xs text-muted">
                      with {s.trainer?.full_name ?? "trainer"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge tone={PT_STATUS[s.status].tone}>
                      {PT_STATUS[s.status].label}
                    </Badge>
                    <RowMenu
                      label="Session actions"
                      items={[
                        s.status === "requested" && {
                          kind: "action",
                          label: "Confirm",
                          action: updatePtSession.bind(null, s.id, "confirm"),
                        },
                        s.status === "confirmed" && {
                          kind: "action",
                          label: "Mark as done",
                          action: updatePtSession.bind(null, s.id, "done"),
                        },
                        {
                          kind: "action",
                          label: "Cancel session",
                          danger: true,
                          action: updatePtSession.bind(null, s.id, "cancel"),
                          confirm: "Cancel this session?",
                        },
                      ]}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}</TabPanel>


      <TabPanel id="body" tabs={tabs}>{(
        <section className="space-y-3">
          <h2 className="font-semibold">Body measurements</h2>
          <MeasurementsPanel
            supabase={supabase}
            memberId={member.id!}
            viewerId={staffViewer.id}
            timeZone={staff.timezone}
            canRecord={canCoach}
            recordFor={canCoach ? member.id! : null}
          />
        </section>
      )}</TabPanel>

      <TabPanel id="overview" tabs={tabs}>{memberships.data &&
        memberships.data.length > 0 && (
          <Card>
            <SectionTitle>Membership history</SectionTitle>
            <ul className="divide-y divide-line border-t border-line">
              {memberships.data.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm"
                >
                  <span>
                    {m.plan_name}
                    <span className="block text-xs text-muted">
                      {formatDate(m.starts_on)} → {formatDate(m.ends_on)}
                    </span>
                  </span>
                  {m.cancelled_at ? (
                    <Badge tone="gray">Cancelled</Badge>
                  ) : m.ends_on < today ? (
                    <Badge tone="gray">Ended</Badge>
                  ) : m.starts_on > today ? (
                    <Badge tone="amber">Upcoming</Badge>
                  ) : (
                    <Badge tone="green">Current</Badge>
                  )}
                  {canManage && !m.cancelled_at && (
                    <RowMenu
                      label="Membership actions"
                      items={[
                        {
                          kind: "dialog",
                          label: "Edit dates & visits",
                          title: `Edit ${m.plan_name}`,
                          content: (
                            <AdjustMembershipForm
                              action={adjustMembership.bind(null, m.id)}
                              startsOn={m.starts_on}
                              endsOn={m.ends_on}
                              visitLimit={m.visit_limit}
                              visitsUsed={m.visits_used}
                            />
                          ),
                        },
                        {
                          kind: "action",
                          label: "Cancel membership",
                          danger: true,
                          action: changeMembership.bind(null, m.id, "cancel"),
                          confirm:
                            "Cancel this membership? This can't be undone.",
                        },
                      ]}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}</TabPanel>
    </div>
  );
}
