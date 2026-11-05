import { FlaskConical } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Dialog } from "@/components/dialog";
import { ROLE_LABELS, type GymRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLabGym, openGymAs, openGymAsSupport, setFeatureOverride } from "./actions";
import { FeatureOverrideForm, OpenAsForm, RolloutSelect } from "./forms";

const ROLES: GymRole[] = ["owner", "manager", "front_desk", "trainer", "dietitian", "member"];

const ROLLOUT = {
  off: { label: "Off", tone: "gray" },
  lab: { label: "Lab only", tone: "amber" },
  all: { label: "Everyone", tone: "green" },
} as const;

// The super admin's lab: a test gym seen as any role, and the feature switches
// that decide who gets what (off, lab only, everyone, per-gym exceptions).
export async function Lab() {
  const admin = createAdminClient();
  const [{ data: gyms }, { data: features }, { data: overrides }] = await Promise.all([
    admin.from("gyms").select("id, name, is_lab").order("name"),
    admin.from("features").select("key, name, description, rollout").order("created_at"),
    admin.from("gym_feature_overrides").select("gym_id, feature_key, enabled"),
  ]);
  const lab = (gyms ?? []).find((g) => g.is_lab);
  const gymName = new Map((gyms ?? []).map((g) => [g.id, g.name]));
  const gymOptions = (gyms ?? []).map((g) => ({ id: g.id, name: g.is_lab ? `${g.name} (lab)` : g.name }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FlaskConical className="size-4" /> Your lab
          </h2>
          {lab ? (
            <>
              <p className="mt-1 mb-4 text-sm text-muted">
                {lab.name}: a gym only you use. Features set to &quot;Lab only&quot; are on here. Open it as any role to see what each person sees.
              </p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <form key={role} action={openGymAsSupport.bind(null, lab.id, role)}>
                    <button className={`h-9 rounded-lg px-3 text-sm font-medium ${role === "member" ? "bg-brand" : "border border-line bg-surface hover:border-ink/30"}`}>
                      {ROLE_LABELS[role]}
                    </button>
                  </form>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 mb-4 text-sm text-muted">
                A test gym only you use, to try new features before anyone else. You can open it as owner, any staff role or a member.
              </p>
              <form action={createLabGym}>
                <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">Create my lab gym</button>
              </form>
            </>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Open any gym as a role</h2>
          <p className="mt-1 mb-4 text-sm text-muted">See a real gym exactly as one of its people does. Changes are real. Member view is lab only.</p>
          <OpenAsForm action={openGymAs} gyms={gymOptions} roles={ROLES.filter((r) => r !== "member").map((r) => ({ id: r, label: ROLE_LABELS[r] }))} />
        </Card>
      </div>

      <Card>
        <div className="border-b border-line p-5">
          <h2 className="font-semibold">Features</h2>
          <p className="mt-1 text-sm text-muted">
            New features start as &quot;Lab only&quot;. When they work, switch them to Everyone. Exceptions turn a feature on early, or off, for one gym.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {(features ?? []).map((f) => {
            const exceptions = (overrides ?? []).filter((o) => o.feature_key === f.key);
            const tone = ROLLOUT[f.rollout as keyof typeof ROLLOUT] ?? ROLLOUT.off;
            return (
              <li key={f.key} className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {f.name} <Badge tone={tone.tone}>{tone.label}</Badge>
                  </p>
                  <p className="text-sm text-muted">{f.description}</p>
                  {exceptions.length > 0 && (
                    <p className="text-xs text-muted">
                      Exceptions:{" "}
                      {exceptions.map((o, i) => (
                        <span key={o.gym_id}>
                          {i > 0 && ", "}
                          {gymName.get(o.gym_id) ?? "Gym"} <strong className={o.enabled ? "text-success" : "text-danger"}>{o.enabled ? "on" : "off"}</strong>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <RolloutSelect featureKey={f.key} rollout={f.rollout} label={f.name} />
                  <Dialog label="Exception" title={`${f.name}: one gym`} variant="secondary" triggerClassName="h-9 px-3 text-xs">
                    <FeatureOverrideForm action={setFeatureOverride.bind(null, f.key)} gyms={gymOptions} />
                  </Dialog>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
