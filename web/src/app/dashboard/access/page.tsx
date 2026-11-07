import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ChevronRight, Download, DoorOpen, Plus, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { RowMenu } from "@/components/row-menu";
import { activeTab, PageTabs, TabPanel } from "@/components/page-tabs";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { requestOrigin } from "@/lib/origin";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../members/action-button";
import { createDevice, createZone, deleteZone, renameZone, setPlanZones, syncNow } from "./actions";
import { CopyField, DeviceForm, NameForm, PlanZonesForm } from "./forms";
import { CONNECTION_LABEL, DIRECTION_LABEL, METHOD_LABEL, OutcomeBadge, VENDOR_LABEL, ago, deviceStatus, isRecent } from "./shared";

export const metadata: Metadata = { title: "Access" };

const TABS = ["devices", "zones", "activity", "bridge"] as const;

export default function AccessPage({ searchParams }: PageProps<"/dashboard/access">) {
  return (
    <div className="max-w-5xl space-y-6">
      <Suspense fallback={<Skeleton className="h-[520px]" />}>
        <AccessContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AccessContent({ searchParams }: { searchParams: PageProps<"/dashboard/access">["searchParams"] }) {
  const tab = activeTab((await searchParams).tab, TABS);
  const { membership } = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(membership.gymId, "access_control"))) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: devices }, { data: zones }, { data: counts }] = await Promise.all([
    supabase.from("access_devices").select("*").eq("gym_id", membership.gymId).order("created_at"),
    supabase.from("access_zones").select("id, name").eq("gym_id", membership.gymId).order("name"),
    supabase.rpc("access_device_counts", { p_gym_id: membership.gymId }),
  ]);
  const byDevice = new Map((counts ?? []).map((c) => [c.device_id, c]));
  const zoneName = new Map((zones ?? []).map((z) => [z.id, z.name]));
  const hasDirect = (devices ?? []).some((d) => d.connection === "direct" && d.is_active);

  return (
    <>
      <PageHeader
        title="Access"
        description="Door devices let members in with their face, fingerprint or card. Gymix keeps every device in step with memberships and payments."
        action={
          <div className="flex flex-wrap gap-2">
            {hasDirect && <ActionButton action={syncNow} label="Sync now" pendingLabel="Syncing…" icon={<RefreshCw className="size-4" />} className="h-10 w-10 justify-center" />}
            <Dialog label="Add device" icon={<Plus className="size-4" />} title="Add a door device" description="ZKTeco terminals connect on their own. Hikvision devices connect through the Gymix Bridge or directly." size="lg">
              <DeviceForm action={createDevice} zones={zones ?? []} submitLabel="Add device" />
            </Dialog>
          </div>
        }
      />
      <PageTabs
        instant
        base="/dashboard/access"
        active={tab}
        tabs={[
          { id: "devices", label: "Devices", count: devices?.length || undefined },
          { id: "zones", label: "Zones" },
          { id: "activity", label: "Activity" },
          { id: "bridge", label: "Gymix Bridge" },
        ]}
      />

      <TabPanel id="devices" tabs={TABS}>
        {!devices?.length ? (
          <Card className="px-6 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-ink text-brand">
              <DoorOpen className="size-6" />
            </span>
            <p className="mt-4 font-semibold">No door devices yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Add your ZKTeco or Hikvision terminal. Members with an active, paid membership are sent to it automatically, and removed when they expire or stop paying.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {devices.map((d) => {
              const status = deviceStatus(d);
              const c = byDevice.get(d.id);
              return (
                <Link key={d.id} href={`/dashboard/access/${d.id}`} className="group">
                  <Card className="flex flex-wrap items-center gap-4 p-4 transition group-hover:border-ink/30 group-hover:shadow-md">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${d.is_active ? "bg-ink text-brand" : "bg-canvas text-muted"}`}>
                      <DoorOpen className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{d.name}</span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {VENDOR_LABEL[d.vendor as keyof typeof VENDOR_LABEL]} · {CONNECTION_LABEL[d.connection as keyof typeof CONNECTION_LABEL]} · {DIRECTION_LABEL[d.direction as keyof typeof DIRECTION_LABEL]}
                        {d.zone_id && zoneName.get(d.zone_id) ? ` · ${zoneName.get(d.zone_id)}` : ""}
                      </span>
                      {d.last_error && d.is_active && <span className="mt-1 block text-sm text-danger">{d.last_error}</span>}
                    </span>
                    <span className="order-last flex w-full gap-6 pl-15 text-sm sm:order-none sm:w-auto sm:pl-0 sm:text-right">
                      <span>
                        <span className="block font-semibold tabular-nums">{c?.granted ?? 0}</span>
                        <span className="text-xs text-muted">members</span>
                      </span>
                      <span>
                        <span className={`block font-semibold tabular-nums ${c?.pending ? "text-amber-700" : ""}`}>{c?.pending ?? 0}</span>
                        <span className="text-xs text-muted">to send</span>
                      </span>
                      <span className="hidden sm:block">
                        <span className="block font-semibold">{ago(d.last_seen_at)}</span>
                        <span className="text-xs text-muted">last seen</span>
                      </span>
                    </span>
                    <ChevronRight className="hidden size-4 text-muted transition group-hover:translate-x-0.5 sm:block" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </TabPanel>

      <TabPanel id="zones" tabs={TABS}>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <ZonesPanel gymId={membership.gymId} zones={zones ?? []} />
        </Suspense>
      </TabPanel>

      <TabPanel id="activity" tabs={TABS}>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ActivityPanel gymId={membership.gymId} timeZone={membership.timezone} />
        </Suspense>
      </TabPanel>

      <TabPanel id="bridge" tabs={TABS}>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <BridgePanel gymId={membership.gymId} bridgeDevices={(devices ?? []).filter((d) => d.connection === "bridge").length} />
        </Suspense>
      </TabPanel>
    </>
  );
}

async function ZonesPanel({ gymId, zones }: { gymId: string; zones: { id: string; name: string }[] }) {
  const supabase = await createClient();
  const [{ data: plans }, { data: links }] = await Promise.all([
    supabase.from("membership_plans").select("id, name, is_active").eq("gym_id", gymId).order("is_active", { ascending: false }).order("name"),
    supabase.from("plan_access_zones").select("plan_id, zone_id"),
  ]);
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          action={
            <Dialog label="Add zone" icon={<Plus className="size-4" />} variant="secondary" triggerClassName="h-9" title="Add a zone" description="A group of doors, like Ladies area or Pool.">
              <NameForm action={createZone} submitLabel="Add zone" placeholder="e.g. Ladies area" />
            </Dialog>
          }
        >
          Zones
        </SectionTitle>
        {!zones.length ? (
          <EmptyState>No zones: every plan opens every door. Add zones when some doors are only for some plans (a ladies area, a pool, a VIP room).</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{z.name}</span>
                <RowMenu
                  label={`Actions for ${z.name}`}
                  items={[
                    { kind: "dialog", label: "Rename", title: `Rename ${z.name}`, content: <NameForm action={renameZone.bind(null, z.id)} initial={z.name} submitLabel="Save" /> },
                    { kind: "action", label: "Delete", danger: true, action: deleteZone.bind(null, z.id), confirm: `Delete “${z.name}”? Its doors open to every plan again.` },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {zones.length > 0 && (
        <Card>
          <SectionTitle>Which doors each plan opens</SectionTitle>
          <p className="-mt-2 px-5 pb-3 text-sm text-muted">Tick the zones a plan opens. A plan with nothing ticked opens every door. Doors without a zone are open to everyone.</p>
          <ul className="divide-y divide-line border-t border-line">
            {(plans ?? []).map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className={`font-medium ${p.is_active ? "" : "text-muted"}`}>
                  {p.name}
                  {!p.is_active && <span className="ml-2 text-xs font-normal">(archived)</span>}
                </span>
                <PlanZonesForm action={setPlanZones.bind(null, p.id)} zones={zones} selected={(links ?? []).filter((l) => l.plan_id === p.id).map((l) => l.zone_id)} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

async function ActivityPanel({ gymId, timeZone }: { gymId: string; timeZone: string }) {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("access_events")
    .select("id, occurred_at, direction, method, outcome, pin, members(id, full_name), access_devices(name)")
    .eq("gym_id", gymId)
    .order("occurred_at", { ascending: false })
    .limit(60);
  return (
    <Card>
      <SectionTitle>Latest at the doors</SectionTitle>
      {!events?.length ? (
        <EmptyState>Nothing yet. Entries and exits appear here as they happen.</EmptyState>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              <span className="w-28 shrink-0 text-xs text-muted tabular-nums">{formatDateTime(e.occurred_at, timeZone)}</span>
              <span className="min-w-0 flex-1">
                {e.members ? (
                  <Link href={`/dashboard/members/${e.members.id}`} className="font-medium hover:underline">
                    {e.members.full_name}
                  </Link>
                ) : (
                  <span className="text-muted">{e.pin ? `Unknown person (#${e.pin})` : "Unknown card"}</span>
                )}
                <span className="block text-xs text-muted">
                  {e.access_devices?.name}
                  {METHOD_LABEL[e.method] ? ` · ${METHOD_LABEL[e.method]}` : ""}
                </span>
              </span>
              <OutcomeBadge outcome={e.outcome} direction={e.direction} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function BridgePanel({ gymId, bridgeDevices }: { gymId: string; bridgeDevices: number }) {
  const supabase = await createClient();
  const [{ data: token }, { data: status }] = await Promise.all([
    supabase.rpc("access_bridge_token", { p_gym_id: gymId }),
    supabase.rpc("access_bridge_status", { p_gym_id: gymId }).maybeSingle(),
  ]);
  const origin = await requestOrigin();
  const online = isRecent(status?.last_seen_at, 2 * 60_000);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Gymix Bridge</h2>
              {status?.last_seen_at ? <Badge tone={online ? "green" : "red"}>{online ? "Running" : "Not running"}</Badge> : <Badge tone="gray">Not set up</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              A small program for a computer that stays on at the gym. It connects Hikvision devices on your network to Gymix, and older ZKTeco terminals that can&apos;t use HTTPS. Nothing to change on your router.
            </p>
            {status?.last_seen_at && (
              <p className="mt-2 text-xs text-muted">
                Last heard from {ago(status.last_seen_at)}
                {status.version ? ` · version ${status.version}` : ""} · {bridgeDevices} device{bridgeDevices === 1 ? "" : "s"} through it
              </p>
            )}
          </div>
          <a href="/api/access/bridge/launcher" className={buttonClass("primary")}>
            <Download className="size-4" /> Download for Windows
          </a>
        </div>
        <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["Install Node.js", "The free LTS version from nodejs.org (once)."],
            ["Run gymix-bridge.cmd", "Put it in a folder and double-click. Keep the window open."],
            ["Start it with Windows", "Put a shortcut in the Startup folder (Win+R → shell:startup)."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl bg-canvas p-4">
              <span className="text-xs font-semibold text-muted">Step {i + 1}</span>
              <span className="mt-1 block font-medium">{t}</span>
              <span className="text-muted">{d}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-semibold">On a Mac, Linux or a Raspberry Pi</h2>
        <p className="text-sm text-muted">With Node.js 18 or newer installed, run:</p>
        <pre className="overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-white">
          {`curl -fsSLO ${origin}/downloads/gymix-bridge.mjs\nGYMIX_URL=${origin} GYMIX_BRIDGE_TOKEN=<token below> node gymix-bridge.mjs`}
        </pre>
        <CopyField label="Bridge token" value={token ?? ""} secret />
        <p className="text-xs text-muted">The token lets the bridge act for your gym&apos;s doors. Keep it private.</p>
      </Card>
    </div>
  );
}
