import Link from "next/link";
import { ProgramBuilder } from "@/components/program-builder";
import { RouteModal } from "@/components/route-modal";
import { Badge, Card } from "@/components/ui";
import { EXPERIENCE_LABELS, GOAL_LABELS } from "@/lib/exercises";
import { loadProgram } from "@/lib/programs";
import { createClient } from "@/lib/supabase/server";
import { deleteProgram } from "@/app/program-actions";
import { ActionButton } from "@/app/dashboard/members/action-button";
import { publishProgram, saveAsTemplate } from "@/app/dashboard/programs/actions";

// The coach's program builder, opened as a dialog over whichever page asked for
// it (?program=<id>). `closePath` is that page without the parameter.
export async function ProgramEditorModal({ programId, gymId, closePath }: { programId: string; gymId: string; closePath: string }) {
  const supabase = await createClient();
  const program = await loadProgram(supabase, programId);
  if (!program || program.gymId !== gymId) return null;

  const [{ data: member }, { data: request }] = await Promise.all([
    program.memberId ? supabase.from("members").select("id, full_name").eq("id", program.memberId).single() : { data: null },
    program.requestId
      ? supabase.from("program_requests").select("goal, days_per_week, experience, injuries, notes").eq("id", program.requestId).single()
      : { data: null },
  ]);

  const isDraft = program.kind === "trainer" && !program.isActive;
  const deleteAndClose = deleteProgram.bind(null, program.id, closePath);

  return (
    <RouteModal param="program" title={program.name} description={member ? `For ${member.full_name}` : "Template"} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {program.kind === "template" ? (
              <Badge tone="blue">Template</Badge>
            ) : isDraft ? (
              <Badge tone="amber">Draft — the member can&apos;t see it yet</Badge>
            ) : program.isActive ? (
              <Badge tone="green">Active</Badge>
            ) : (
              <Badge tone="gray">Old program</Badge>
            )}
            {program.kind === "self" && <Badge tone="gray">Built by the member</Badge>}
            {member && !closePath.startsWith("/dashboard/members/") && (
              <Link href={`/dashboard/members/${member.id}`} className="text-sm underline underline-offset-4">
                Member profile
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {isDraft && <ActionButton action={publishProgram.bind(null, program.id)} label="Send to member" variant="primary" />}
            {program.kind !== "template" && (
              <ActionButton action={saveAsTemplate.bind(null, program.id, `${program.name} (template)`)} label="Save as template" />
            )}
            {(isDraft || program.kind === "template") && (
              <ActionButton
                action={async () => {
                  "use server";
                  await deleteAndClose();
                  return {};
                }}
                label="Delete"
                variant="ghost"
                confirm="Delete this program?"
              />
            )}
          </div>
        </div>

        {request && (
          <Card className="space-y-1 border-amber-200 bg-amber-50/50 p-4 text-sm">
            <p className="font-medium">What they asked for</p>
            <p>
              {GOAL_LABELS[request.goal]} · {request.days_per_week} days a week · {EXPERIENCE_LABELS[request.experience]}
            </p>
            {request.injuries && <p className="text-danger">Injuries: {request.injuries}</p>}
            {request.notes && <p className="text-muted">“{request.notes}”</p>}
          </Card>
        )}

        <ProgramBuilder program={program} />
      </div>
    </RouteModal>
  );
}
