import { RouteModal } from "@/components/route-modal";
import { MachineDetail } from "@/components/machine-detail";
import { createClient } from "@/lib/supabase/server";

// A machine slid up over the current portal page (?machine=<id>): opened from
// the Machines list, or by tapping the NFC sticker on the machine.
export async function MachineSheet({ machineId, viewer }: { machineId: string; viewer: { id: string } }) {
  const supabase = await createClient();
  // RLS hides machines from other gyms.
  const { data: machine } = await supabase.from("gym_machines").select("id, name").eq("id", machineId).maybeSingle();
  if (!machine) return null;
  return (
    <RouteModal param="machine" title={machine.name} sheet>
      <MachineDetail id={machine.id} viewer={viewer} showName={false} />
    </RouteModal>
  );
}
