import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { ROLE_LABELS } from "@/lib/roles";
import { getViewer } from "@/lib/session";
import { leaveSupport } from "@/app/admin/actions";

// A super admin inside a gym (support access or the lab): which gym, as which
// role, and the way back to the console.
export async function SupportBanner() {
  const viewer = await getViewer();
  const gym = viewer?.supportGym;
  if (!gym) return null;
  return (
    <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-strong bg-brand/25 px-4 py-3 text-sm">
      <span className="flex items-center gap-2">
        <LifeBuoy className="size-4 shrink-0" />
        <span>
          {gym.isLab ? "Lab" : "Support access"}: <strong>{gym.name}</strong> as <strong>{ROLE_LABELS[gym.role]}</strong>.
          {!gym.isLab && " Changes are real."}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Link href="/admin/lab" className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-medium">
          Switch role
        </Link>
        <form action={leaveSupport}>
          <button className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white">Back to admin</button>
        </form>
      </span>
    </div>
  );
}
