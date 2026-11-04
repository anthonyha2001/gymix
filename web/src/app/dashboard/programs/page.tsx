import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { ProgramEditorModal } from "@/components/program-editor-modal";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  Skeleton,
} from "@/components/ui";
import { EXPERIENCE_LABELS, GOAL_LABELS } from "@/lib/exercises";
import { formatDate, formatUSD } from "@/lib/format";
import { COACH_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../members/action-button";
import { RowMenu } from "@/components/row-menu";
import { removeProgram, setProgramActive } from "@/app/program-actions";
import { cancelRequest, createMemberProgram } from "./actions";
import { NewTemplateForm, ProgramPriceForm, StartProgramForm } from "./forms";

export const metadata: Metadata = { title: "Programs" };

const TABS = ["requests", "programs"] as const;
const BASE = "/dashboard/programs";

export default function ProgramsPage({
  searchParams,
}: PageProps<"/dashboard/programs">) {
  return (
    <div className="max-w-5xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[500px]" />}>
        <ProgramsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ProgramsContent({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard/programs">["searchParams"];
}) {
  const query = await searchParams;
  const tab = activeTab(query.tab, TABS);
  const here = `${BASE}?tab=${tab}`;
  const openProgram = typeof query.program === "string" ? query.program : null;
  const { membership } = await requireStaff(COACH_ROLES);
  const supabase = await createClient();

  const [
    { data: requests },
    { data: programs },
    { data: templates },
    { data: gym },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("program_requests")
      .select(
        "id, member_id, goal, days_per_week, experience, injuries, notes, status, invoice_id, program_id, created_at, members(full_name), preferred:profiles!program_requests_preferred_trainer_id_fkey(full_name), trainer:profiles!program_requests_trainer_id_fkey(full_name)",
      )
      .eq("gym_id", membership.gymId)
      .in("status", ["open", "in_progress"])
      .order("created_at"),
    supabase
      .from("programs")
      .select(
        "id, name, kind, is_active, updated_at, member_id, members(full_name)",
      )
      .eq("gym_id", membership.gymId)
      .neq("kind", "template")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("programs")
      .select("id, name, updated_at")
      .eq("gym_id", membership.gymId)
      .eq("kind", "template")
      .order("name"),
    supabase
      .from("gyms")
      .select("program_price_usd")
      .eq("id", membership.gymId)
      .single(),
    supabase
      .from("members")
      .select("id, full_name")
      .eq("gym_id", membership.gymId)
      .is("archived_at", null)
      .order("full_name"),
  ]);

  const templateOptions = (templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programs"
        description="Answer members' requests, and build programs and templates."
        action={
          <div className="flex flex-wrap gap-2">
            <Dialog
              label="New program"
              icon={<Plus className="size-4" />}
              title="New program"
              description="For one member. Start blank or from a template."
              size="lg"
            >
              <StartProgramForm
                action={createMemberProgram.bind(
                  null,
                  null,
                  null,
                  `${BASE}?tab=programs`,
                )}
                templates={templateOptions}
                defaultName="Training program"
                members={members ?? []}
              />
            </Dialog>
            {membership.role === "owner" && (
              <Dialog
                label={`Program price: ${Number(gym?.program_price_usd ?? 0) > 0 ? formatUSD(gym?.program_price_usd) : "Free"}`}
                title="Program price"
                variant="secondary"
              >
                <ProgramPriceForm price={Number(gym?.program_price_usd ?? 0)} />
              </Dialog>
            )}
            <Dialog
              label="New template"
              variant="secondary"
              icon={<Plus className="size-4" />}
              title="New template"
              description="Build a program once, then start any member's program from it."
            >
              <NewTemplateForm />
            </Dialog>
          </div>
        }
      />

      <PageTabs
        base={BASE}
        active={tab}
        tabs={[
          { id: "requests", label: "Requests", count: requests?.length ?? 0 },
          { id: "programs", label: "Build programs" },
        ]}
      />

      {openProgram && (
        <ProgramEditorModal
          programId={openProgram}
          gymId={membership.gymId}
          closePath={here}
        />
      )}

      {tab === "requests" && (
        <Card>
          <SectionTitle>Requests from members</SectionTitle>
          {!requests?.length ? (
            <EmptyState>
              No open requests. Members ask for a program from their portal.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {requests.map((r) => {
                const firstName =
                  r.members?.full_name.split(" ")[0] ?? "Member";
                return (
                  <li key={r.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/dashboard/members/${r.member_id}`}
                          className="font-semibold hover:underline"
                        >
                          {r.members?.full_name}
                        </Link>
                        <p className="text-sm">
                          {GOAL_LABELS[r.goal]} · {r.days_per_week} days/week ·{" "}
                          {EXPERIENCE_LABELS[r.experience]}
                        </p>
                        {r.injuries && (
                          <p className="text-sm text-danger">
                            Injuries: {r.injuries}
                          </p>
                        )}
                        {r.notes && (
                          <p className="text-sm text-muted">“{r.notes}”</p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          Asked {formatDate(r.created_at)}
                          {r.preferred?.full_name &&
                            ` · wants ${r.preferred.full_name}`}
                          {r.trainer?.full_name &&
                            ` · ${r.trainer.full_name} is on it`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.invoice_id && (
                          <Badge tone="blue">Paid program</Badge>
                        )}
                        {r.status === "in_progress" ? (
                          <Badge tone="amber">In progress</Badge>
                        ) : (
                          <Badge tone="red">New</Badge>
                        )}
                      </div>
                    </div>
                    {r.status === "open" ? (
                      <div className="flex flex-wrap items-start gap-2">
                        <Dialog
                          label="Build program"
                          title={`Program for ${r.members?.full_name ?? "member"}`}
                          description="Start blank or from one of your templates."
                          size="lg"
                          triggerClassName="h-9"
                        >
                          <StartProgramForm
                            action={createMemberProgram.bind(
                              null,
                              r.member_id,
                              r.id,
                              here,
                            )}
                            templates={templateOptions}
                            defaultName={`${GOAL_LABELS[r.goal]} – ${firstName}`}
                          />
                        </Dialog>
                        <ActionButton
                          action={cancelRequest.bind(null, r.id)}
                          label="Close without a program"
                          variant="ghost"
                          className="h-9"
                        />
                      </div>
                    ) : (
                      r.program_id && (
                        <Link
                          href={`${here}&program=${r.program_id}`}
                          scroll={false}
                          className="text-sm font-medium underline underline-offset-4"
                        >
                          Continue building
                        </Link>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "programs" && (
        <>
          <Card>
            <SectionTitle>Member programs</SectionTitle>
            {!programs?.length ? (
              <EmptyState>
                None yet. Start one from a request, or from a member&apos;s
                page.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {programs.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center pr-3 hover:bg-canvas/50"
                  >
                    <Link
                      href={`${here}&program=${p.id}`}
                      scroll={false}
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-5 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-xs text-muted">
                          {p.members?.full_name} · updated{" "}
                          {formatDate(p.updated_at)}
                        </span>
                      </span>
                      {p.kind === "self" && (
                        <Badge tone="gray">Built by member</Badge>
                      )}
                      {p.kind === "trainer" && !p.is_active ? (
                        <Badge tone="amber">Draft</Badge>
                      ) : p.is_active ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="gray">Old</Badge>
                      )}
                    </Link>
                    <RowMenu
                      label={`Actions for ${p.name}`}
                      items={[
                        {
                          kind: "link",
                          label: "Open",
                          href: `${here}&program=${p.id}`,
                        },
                        p.is_active && {
                          kind: "action",
                          label: "Retire (keep history)",
                          action: setProgramActive.bind(null, p.id, false),
                        },
                        !p.is_active &&
                          p.kind !== "trainer" && {
                            kind: "action",
                            label: "Reactivate",
                            action: setProgramActive.bind(null, p.id, true),
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
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle>Templates</SectionTitle>
            {!templates?.length && (
              <EmptyState>
                No templates yet. Use “New template” to build one.
              </EmptyState>
            )}
            {templates && templates.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {templates.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center pr-3 hover:bg-canvas/50"
                  >
                    <Link
                      href={`${here}&program=${t.id}`}
                      scroll={false}
                      className="block flex-1 px-5 py-3 font-medium"
                    >
                      {t.name}
                    </Link>
                    <RowMenu
                      label={`Actions for ${t.name}`}
                      items={[
                        {
                          kind: "link",
                          label: "Open",
                          href: `${here}&program=${t.id}`,
                        },
                        {
                          kind: "action",
                          label: "Delete template",
                          danger: true,
                          action: removeProgram.bind(null, t.id),
                          confirm: `Delete the template “${t.name}”? Programs made from it aren't affected.`,
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
