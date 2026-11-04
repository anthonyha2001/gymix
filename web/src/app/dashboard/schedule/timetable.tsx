import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { ClassForm } from "@/components/schedule-forms";
import { Badge, Card } from "@/components/ui";
import { MANAGER_ROLES } from "@/lib/roles";
import { WEEKDAYS, endTime, hhmm } from "@/lib/schedule";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { RowMenu } from "@/components/row-menu";
import { formatUSD } from "@/lib/format";
import { deleteClass, saveClass, setClassActive } from "@/app/schedule-actions";

// The weekly timetable (managers): classes repeat every week.
export async function Timetable() {
  const { membership } = await requireStaff(MANAGER_ROLES);
  const supabase = await createClient();
  const [{ data: classes }, { data: coaches }] = await Promise.all([
    supabase.from("classes").select("*").eq("gym_id", membership.gymId).order("weekday").order("start_time"),
    supabase.rpc("gym_coaches", { p_gym_id: membership.gymId }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Classes repeat every week. Members can book up to two weeks ahead.</p>
          <Dialog label="Add class" icon={<Plus className="size-4" />} title="Add a class" size="lg">
            <ClassForm action={saveClass.bind(null, null)} coaches={coaches ?? []} submitLabel="Add class" />
          </Dialog>
      </div>
      {!classes?.length ? (
        <Card className="p-8 text-center">
          <p className="font-medium">No classes yet</p>
          <p className="mt-1 text-sm text-muted">Use “Add class” to build your weekly timetable.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Day</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Class</th>
                  <th className="px-5 py-3 font-medium">Trainer</th>
                  <th className="px-5 py-3 text-right font-medium">Spots</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {classes.map((c) => (
                  <tr key={c.id} className={c.is_active ? "" : "text-muted"}>
                    <td className="px-5 py-3">{WEEKDAYS[c.weekday]}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {hhmm(c.start_time)}–{endTime(c.start_time, c.duration_min)}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">
                        {c.name}
                        {c.monthly_price_usd !== null && (
                          <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Course, {formatUSD(c.monthly_price_usd)}/month
                          </span>
                        )}
                      </p>
                      {c.location && <p className="text-xs text-muted">{c.location}</p>}
                    </td>
                    <td className="px-5 py-3">{coaches?.find((t) => t.id === c.trainer_id)?.full_name ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{c.capacity}</td>
                    <td className="px-5 py-3">{c.is_active ? <Badge tone="green">Running</Badge> : <Badge tone="gray">Paused</Badge>}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <RowMenu
                          label={`Actions for ${c.name}`}
                          items={[
                            {
                              kind: "dialog",
                              label: "Edit",
                              title: `Edit ${c.name}`,
                              size: "lg",
                              content: <ClassForm action={saveClass.bind(null, c.id)} coaches={coaches ?? []} initial={c} submitLabel="Save" />,
                            },
                            { kind: "action", label: c.is_active ? "Pause" : "Resume", action: setClassActive.bind(null, c.id, !c.is_active) },
                            {
                              kind: "action",
                              label: "Delete",
                              danger: true,
                              action: deleteClass.bind(null, c.id),
                              confirm: `Delete “${c.name}” on ${WEEKDAYS[c.weekday]}s? Its bookings are removed too.`,
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
