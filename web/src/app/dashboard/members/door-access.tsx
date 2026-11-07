import { DoorOpen } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import { setMemberCard } from "../access/actions";
import { CardForm } from "../access/forms";

// A member's door credentials and where they stand on each device. Shown on
// the member page while door access is on for the gym.
export async function DoorAccessCard({ memberId, gymId }: { memberId: string; gymId: string }) {
  if (!(await hasFeature(gymId, "access_control"))) return null;
  const supabase = await createClient();
  const [{ data: member }, { data: grants }, { count: devices }] = await Promise.all([
    supabase.from("members").select("access_pin, access_card").eq("id", memberId).single(),
    supabase.from("access_grants").select("device_id, valid_until, access_devices(name)").eq("member_id", memberId),
    supabase.from("access_events").select("id", { count: "exact", head: true }).eq("member_id", memberId),
  ]);
  if (!member) return null;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-brand">
            <DoorOpen className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Door access</h2>
            <p className="text-sm text-muted">
              Number on the devices: <b className="font-mono text-ink">{member.access_pin}</b>
              {" · "}Card: {member.access_card ? <b className="font-mono text-ink">{member.access_card}</b> : "none"}
            </p>
            <p className="mt-0.5 text-xs text-muted">Use this number as the user ID when enrolling their face or fingerprint on a device.</p>
          </div>
        </div>
        <Dialog label={member.access_card ? "Change card" : "Add card"} variant="secondary" triggerClassName="h-9" title="Access card">
          <CardForm action={setMemberCard.bind(null, memberId)} initial={member.access_card} />
        </Dialog>
      </div>
      {!!grants?.length && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {grants.map((g) => (
            <li key={g.device_id} className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-sm">
              {g.access_devices?.name}
              {g.valid_until ? <Badge tone="green">Until {formatDate(g.valid_until)}</Badge> : <Badge tone="red">Blocked</Badge>}
            </li>
          ))}
        </ul>
      )}
      {!grants?.length && !devices && <p className="mt-4 text-sm text-muted">Not on any device yet: they&apos;re sent automatically once they have an active, paid membership.</p>}
    </Card>
  );
}
