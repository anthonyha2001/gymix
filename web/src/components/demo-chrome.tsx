import { Suspense } from "react";
import { FlaskConical, LayoutDashboard, Smartphone } from "lucide-react";
import { getViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { demoExpiry, isDemoEmail } from "@/lib/demo";
import { gymFeatures } from "@/lib/features";
import { hiddenPortalPages } from "@/lib/portal";
import { PORTAL_PAGES } from "@/lib/portal-pages";
import { navFor } from "@/app/dashboard/nav-items";
import { endDemo, switchDemoRole } from "@/app/demo/actions";
import { DemoGuide } from "./demo-guide";

const hoursLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));

// In a sample gym: a bar saying so (with the way to the member app and to a
// real trial) and the guide. Renders nothing in a real gym.
export async function DemoChrome({ area }: { area: "owner" | "member" }) {
  const viewer = await getViewer();
  if (!viewer || !isDemoEmail(viewer.email)) return null;
  const membership = viewer.memberships[0];
  if (!membership) return null;
  const expiry = await demoExpiry(membership.gymId);
  if (!expiry) return null;

  let available: string[];
  let profileHref: string | null = null;
  if (area === "owner") {
    const supabase = await createClient();
    const [features, { data: fadi }] = await Promise.all([
      gymFeatures(membership.gymId),
      supabase.from("members").select("id").eq("gym_id", membership.gymId).eq("full_name", "Fadi Germanos").maybeSingle(),
    ]);
    available = navFor(membership.role, {}, features).map((n) => n.href);
    profileHref = fadi ? `/dashboard/members/${fadi.id}` : null;
  } else {
    const hidden = await hiddenPortalPages(membership.gymId);
    available = ["/portal", ...PORTAL_PAGES.filter((p) => !hidden.includes(p.id)).map((p) => `/portal/${p.id}`), "/portal/profile"];
  }

  return (
    <>
      {/* The guide takes the corner the install suggestion would use. */}
      <style>{"[data-install-prompt]{display:none}"}</style>
      <div role="status" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink/10 bg-ink px-4 py-2.5 text-sm text-white">
        <span className="flex min-w-0 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-brand" />
          <span>
            <strong className="font-semibold">Demo gym.</strong>{" "}
            <span className="text-white/70">Sample data, yours for {hoursLeft(expiry)} more hours. Nothing is sent to anyone.</span>
          </span>
        </span>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <form action={switchDemoRole.bind(null, area === "owner" ? "member" : "owner")}>
            <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-xs font-medium hover:bg-white/10">
              {area === "owner" ? <Smartphone className="size-3.5" /> : <LayoutDashboard className="size-3.5" />}
              {area === "owner" ? "Member app" : "Owner dashboard"}
            </button>
          </form>
          <form action={endDemo.bind(null, "signup")}>
            <button className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-semibold text-ink hover:bg-brand-strong">Start my free trial</button>
          </form>
          <form action={endDemo.bind(null, "home")}>
            <button className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-white/60 hover:text-white">Exit</button>
          </form>
        </span>
      </div>
      <Suspense fallback={null}>
        <DemoGuide area={area} available={available} profileHref={profileHref} />
      </Suspense>
    </>
  );
}
