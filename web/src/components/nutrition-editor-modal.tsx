import Link from "next/link";
import { NutritionEditor } from "@/components/nutrition-editor";
import { RouteModal } from "@/components/route-modal";
import { Badge, Card } from "@/components/ui";
import { ACTIVITY_LABELS, NUTRITION_GOAL_LABELS, PLAN_STATUS, loadNutritionPlan } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "@/app/dashboard/members/action-button";
import { archiveNutritionPlan, deleteNutritionPlan } from "@/app/nutrition-actions";
import { MEMBER_STATUS, formatDate, type MemberStatus } from "@/lib/format";
import { EXPERIENCE_LABELS, GOAL_LABELS } from "@/lib/exercises";

// The dietitian's plan editor, opened as a dialog (?plan=<id>) over the page
// that asked for it. `closePath` is that page without the parameter.
export async function NutritionEditorModal({ planId, gymId, closePath }: { planId: string; gymId: string; closePath: string }) {
  const supabase = await createClient();
  const plan = await loadNutritionPlan(supabase, planId);
  if (!plan || plan.gym_id !== gymId) return null;

  const [{ data: member }, { data: request }, { data: body }, { data: programRequest }] = await Promise.all([
    supabase.from("member_overview").select("id, full_name, phone, email, status, plan_name, ends_on").eq("id", plan.member_id).single(),
    plan.request_id
      ? supabase
          .from("nutrition_requests")
          .select("goal, weight_kg, height_cm, activity, allergies, preferences, notes")
          .eq("id", plan.request_id)
          .single()
      : { data: null },
    supabase
      .from("body_measurements")
      .select("measured_on, weight_kg, body_fat_pct, muscle_mass_kg, waist_cm")
      .eq("member_id", plan.member_id)
      .order("measured_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("program_requests")
      .select("goal, experience, days_per_week, injuries")
      .eq("member_id", plan.member_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const status = PLAN_STATUS[plan.status] ?? PLAN_STATUS.draft;
  const deleteAndClose = deleteNutritionPlan.bind(null, plan.id, closePath);

  return (
    <RouteModal param="plan" title={plan.name} description={member ? `Nutrition plan for ${member.full_name}` : undefined} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status.tone}>{plan.status === "draft" ? "Draft — the member can't see it yet" : status.label}</Badge>
            {member && !closePath.startsWith("/dashboard/members/") && (
              <Link href={`/dashboard/members/${member.id}?tab=nutrition`} className="text-sm underline underline-offset-4">
                Member profile
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {plan.status === "active" && (
              <ActionButton
                action={archiveNutritionPlan.bind(null, plan.id)}
                label="Archive"
                variant="ghost"
                confirm="Archive this plan? The member no longer sees it as their current plan."
              />
            )}
            {plan.status !== "active" && (
              <ActionButton
                action={async () => {
                  "use server";
                  await deleteAndClose();
                  return {};
                }}
                label="Delete"
                variant="ghost"
                confirm="Delete this plan?"
              />
            )}
          </div>
        </div>

        {member && (
          <Card className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Member</p>
              <p className="font-medium">{member.full_name}</p>
              <p className="text-muted">{[member.phone, member.email].filter(Boolean).join(" · ") || "No contact details"}</p>
              <p className="text-muted">
                {MEMBER_STATUS[(member.status ?? "none") as MemberStatus].label}
                {member.plan_name && ` · ${member.plan_name}`}
                {member.ends_on && ` until ${formatDate(member.ends_on)}`}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Body{body ? ` · ${formatDate(body.measured_on)}` : ""}
              </p>
              {body ? (
                <p>
                  {[
                    body.weight_kg && `${Number(body.weight_kg)} kg`,
                    body.body_fat_pct && `${Number(body.body_fat_pct)}% body fat`,
                    body.muscle_mass_kg && `${Number(body.muscle_mass_kg)} kg muscle`,
                    body.waist_cm && `waist ${Number(body.waist_cm)} cm`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : (
                <p className="text-muted">No measurements yet.</p>
              )}
              {programRequest && (
                <p className="text-muted">
                  Training: {GOAL_LABELS[programRequest.goal]}, {EXPERIENCE_LABELS[programRequest.experience]}, {programRequest.days_per_week} days a week
                </p>
              )}
              {programRequest?.injuries && <p className="text-danger">Injuries: {programRequest.injuries}</p>}
            </div>
          </Card>
        )}

        {request && (
          <Card className="space-y-1 border-amber-200 bg-amber-50/50 p-4 text-sm">
            <p className="font-medium">What they asked for</p>
            <p>
              {NUTRITION_GOAL_LABELS[request.goal]} · {ACTIVITY_LABELS[request.activity]}
              {request.weight_kg && ` · ${Number(request.weight_kg)} kg`}
              {request.height_cm && ` · ${Number(request.height_cm)} cm`}
            </p>
            {request.allergies && <p className="text-danger">Allergies: {request.allergies}</p>}
            {request.preferences && <p>Preferences: {request.preferences}</p>}
            {request.notes && <p className="text-muted">“{request.notes}”</p>}
          </Card>
        )}

        <NutritionEditor plan={plan} />
      </div>
    </RouteModal>
  );
}
