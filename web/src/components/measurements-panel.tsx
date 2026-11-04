import { Plus } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Card, SectionTitle } from "@/components/ui";
import { MeasurementForm } from "@/components/measurement-form";
import { TrendChart } from "@/components/trend-chart";
import { formatDate, todayIn } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import { addMeasurement, deleteMeasurement } from "@/app/measurement-actions";
import { ActionButton } from "@/app/dashboard/members/action-button";

type Client = Awaited<ReturnType<typeof createClient>>;

const CHARTS = [
  { key: "weight_kg", title: "Weight", unit: "kg" },
  { key: "body_fat_pct", title: "Body fat", unit: "%" },
  { key: "muscle_mass_kg", title: "Muscle mass", unit: "kg" },
  { key: "waist_cm", title: "Waist", unit: "cm" },
] as const;

const COLUMNS = [
  { key: "weight_kg", label: "Weight" },
  { key: "body_fat_pct", label: "Fat %" },
  { key: "muscle_mass_kg", label: "Muscle" },
  { key: "waist_cm", label: "Waist" },
  { key: "chest_cm", label: "Chest" },
  { key: "hips_cm", label: "Hips" },
  { key: "arm_cm", label: "Arm" },
  { key: "thigh_cm", label: "Thigh" },
] as const;

// Charts + full history table (the table is the accessible view of the charts)
// + a form to add a measurement. `recordFor` = member id when staff record for
// someone, null when members record for themselves.
export async function MeasurementsPanel({
  supabase,
  memberId,
  viewerId,
  timeZone,
  canRecord,
  recordFor,
}: {
  supabase: Client;
  memberId: string;
  viewerId: string;
  timeZone: string;
  canRecord: boolean;
  recordFor: string | null;
}) {
  const { data: rows } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("member_id", memberId)
    .order("measured_on", { ascending: false })
    .limit(200);
  const all = rows ?? [];
  const charts = CHARTS.map((c) => ({
    ...c,
    points: all.filter((r) => r[c.key] !== null).map((r) => ({ date: r.measured_on, value: Number(r[c.key]) })),
  })).filter((c) => c.points.length > 0);
  const columns = COLUMNS.filter((c) => all.some((r) => r[c.key] !== null));

  return (
    <div className="space-y-4">
      {canRecord && (
        <div className="flex justify-end">
          <Dialog label="Add measurement" icon={<Plus className="size-4" />} title="Add a measurement" description="Fill in what you have — every field is optional." size="lg">
            <MeasurementForm action={addMeasurement.bind(null, recordFor)} today={todayIn(timeZone)} />
          </Dialog>
        </div>
      )}

      {charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((c) => (
            <Card key={c.key} className="p-4">
              <TrendChart title={c.title} unit={c.unit} points={c.points} />
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <SectionTitle>History</SectionTitle>
        {!all.length ? (
          <p className="border-t border-line px-5 py-4 text-sm text-muted">No measurements yet.</p>
        ) : (
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas/60 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {all.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      {formatDate(r.measured_on)}
                      {r.notes && <span className="block text-xs text-muted">{r.notes}</span>}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-right tabular-nums">
                        {r[c.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right">
                      {(r.recorded_by === viewerId || recordFor) && (
                        <ActionButton action={deleteMeasurement.bind(null, r.id)} label="Delete" variant="ghost" className="h-7 px-2 text-xs" confirm="Delete this measurement?" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
