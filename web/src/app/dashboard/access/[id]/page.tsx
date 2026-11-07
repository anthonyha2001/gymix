import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, DoorOpen } from "lucide-react";
import { RowMenu } from "@/components/row-menu";
import { Alert, Badge, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { hasFeature } from "@/lib/features";
import { requestOrigin } from "@/lib/origin";
import { MANAGER_ROLES } from "@/lib/roles";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../../members/action-button";
import { deleteDevice, resyncDevice, setDeviceActive, updateDevice } from "../actions";
import { CopyField, DeviceForm, type DeviceValues } from "../forms";
import { CONNECTION_LABEL, DIRECTION_LABEL, METHOD_LABEL, OutcomeBadge, VENDOR_LABEL, ago, deviceStatus, isRecent } from "../shared";

export const metadata: Metadata = { title: "Door device" };

export default function DevicePage({ params, searchParams }: PageProps<"/dashboard/access/[id]">) {
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/dashboard/access" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Access
      </Link>
      <Suspense fallback={<Skeleton className="h-[560px]" />}>
        <DeviceContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DeviceContent({ params, searchParams }: Pick<PageProps<"/dashboard/access/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const { membership } = await requireStaff(MANAGER_ROLES);
  if (!(await hasFeature(membership.gymId, "access_control"))) redirect("/dashboard");
  const supabase = await createClient();
  const { data: device } = await supabase.from("access_devices").select("*").eq("id", id).eq("gym_id", membership.gymId).maybeSingle();
  if (!device) notFound();

  const [{ data: zones }, { data: counts }, { data: problems }, { data: events }, { data: bridge }] = await Promise.all([
    supabase.from("access_zones").select("id, name").eq("gym_id", membership.gymId).order("name"),
    supabase.rpc("access_device_counts", { p_gym_id: membership.gymId }),
    supabase.from("access_commands").select("id, kind, result, done_at, payload").eq("device_id", id).eq("status", "failed").order("id", { ascending: false }).limit(8),
    supabase
      .from("access_events")
      .select("id, occurred_at, direction, method, outcome, pin, members(id, full_name)")
      .eq("device_id", id)
      .order("occurred_at", { ascending: false })
      .limit(25),
    supabase.rpc("access_bridge_status", { p_gym_id: membership.gymId }).maybeSingle(),
  ]);
  const c = (counts ?? []).find((r) => r.device_id === id);
  const status = deviceStatus(device);
  const origin = await requestOrigin();
  const zone = (zones ?? []).find((z) => z.id === device.zone_id);
  const neverSeen = !device.last_seen_at;
  const info = (device.info ?? {}) as Record<string, string | number | null>;

  const initial: DeviceValues = {
    vendor: device.vendor as DeviceValues["vendor"],
    name: device.name,
    zone_id: device.zone_id,
    direction: device.direction as DeviceValues["direction"],
    serial_number: device.serial_number,
    connection: device.connection as DeviceValues["connection"],
    host: device.host,
    username: device.username,
    door_no: device.door_no,
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`grid size-14 place-items-center rounded-2xl ${device.is_active ? "bg-ink text-brand" : "bg-canvas text-muted"}`}>
            <DoorOpen className="size-6" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{device.name}</h1>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted">
              {VENDOR_LABEL[device.vendor as keyof typeof VENDOR_LABEL]}
              {info.model ? ` ${info.model}` : ""} · {CONNECTION_LABEL[device.connection as keyof typeof CONNECTION_LABEL]} ·{" "}
              {DIRECTION_LABEL[device.direction as keyof typeof DIRECTION_LABEL]}
              {zone ? ` · ${zone.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            action={resyncDevice.bind(null, id)}
            label="Send everyone again"
            pendingLabel="Sending…"
            confirm="Send every member with access to this device again? Useful after replacing or resetting a device."
          />
          <RowMenu
            label={`Actions for ${device.name}`}
            items={[
              { kind: "dialog", label: "Edit", title: `Edit ${device.name}`, size: "lg", content: <DeviceForm action={updateDevice.bind(null, id)} zones={zones ?? []} initial={initial} submitLabel="Save changes" /> },
              {
                kind: "action",
                label: device.is_active ? "Pause" : "Switch back on",
                action: setDeviceActive.bind(null, id, !device.is_active),
                confirm: device.is_active ? "Pause this device? Gymix stops sending it changes and ignores its events until you switch it back on." : undefined,
              },
              { kind: "action", label: "Remove", danger: true, action: deleteDevice.bind(null, id), confirm: `Remove ${device.name}? Members already on the device stay there until you clear it on the device itself.` },
            ]}
          />
        </div>
      </div>

      {device.last_error && device.is_active && <Alert tone="error">{device.last_error}</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Members on the device", String(c?.granted ?? 0)],
          ["Changes to send", String(c?.pending ?? 0)],
          ["Failed this week", String(c?.failed ?? 0)],
          ["Last seen", ago(device.last_seen_at)],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <p className="text-xs text-muted">{k}</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums">{v}</p>
          </Card>
        ))}
      </div>

      <Card className={`p-5 ${isNew || neverSeen ? "border-brand-strong" : ""}`}>
        <details open={isNew || neverSeen} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block font-semibold">{isNew ? "Device added. Now connect it" : "How to connect this device"}</span>
              <span className="text-sm text-muted">{neverSeen ? "Gymix hasn't heard from it yet." : "It's connected. Here if you need to set it up again."}</span>
            </span>
            <span className="text-sm text-muted group-open:hidden">Show</span>
          </summary>
          <div className="mt-5">
            {device.vendor === "zkteco" ? (
              <ZkSetup origin={origin} />
            ) : device.connection === "bridge" ? (
              <HikBridgeSetup bridgeSeen={bridge?.last_seen_at ?? null} />
            ) : (
              <HikDirectSetup eventUrl={`${origin}/api/access/hikvision/${device.event_token}`} />
            )}
          </div>
        </details>
      </Card>

      {!!problems?.length && (
        <Card>
          <SectionTitle>Recent problems</SectionTitle>
          <ul className="divide-y divide-line border-t border-line">
            {problems.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                <span>
                  <span className="font-medium">
                    {p.kind === "upsert_user" ? "Adding" : p.kind === "revoke_user" ? "Blocking" : "Sending"} {(p.payload as { name?: string })?.name ?? "a member"}
                  </span>
                  <span className="block text-xs text-danger">{p.result}</span>
                </span>
                <span className="text-xs text-muted">{p.done_at ? formatDateTime(p.done_at, membership.timezone) : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>At this door</SectionTitle>
        {!events?.length ? (
          <EmptyState>No entries yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-xs text-muted tabular-nums">{formatDateTime(e.occurred_at, membership.timezone)}</span>
                <span className="min-w-0 flex-1">
                  {e.members ? (
                    <Link href={`/dashboard/members/${e.members.id}`} className="font-medium hover:underline">
                      {e.members.full_name}
                    </Link>
                  ) : (
                    <span className="text-muted">{e.pin ? `Unknown person (#${e.pin})` : "Unknown card"}</span>
                  )}
                  {METHOD_LABEL[e.method] && <span className="block text-xs text-muted">{METHOD_LABEL[e.method]}</span>}
                </span>
                <OutcomeBadge outcome={e.outcome} direction={e.direction} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(info.firmware || info.serial) && (
        <p className="text-xs text-muted">
          {[info.serial && `Serial ${info.serial}`, info.firmware && `Firmware ${info.firmware}`, info.ip && `IP ${info.ip}`].filter(Boolean).join(" · ")}
        </p>
      )}
    </>
  );
}

function Steps({ items }: { items: { title: string; body: React.ReactNode }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold">{i + 1}</span>
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p className="font-medium">{s.title}</p>
            <div className="text-muted">{s.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ZkSetup({ origin }: { origin: string }) {
  const host = new URL(origin).host;
  return (
    <Steps
      items={[
        { title: "On the device, open the cloud server settings", body: <>Menu → COMM. → Cloud Server Setting (on some models: ADMS, or Comm. → Cloud Server).</> },
        {
          title: "Point it at Gymix",
          body: (
            <div className="space-y-2">
              <p>Turn on Enable Domain Name, then enter:</p>
              <CopyField label="Server address" value={host} />
              <p>
                Server port <b className="text-ink">443</b>, and turn <b className="text-ink">HTTPS</b> on if the device has it. Proxy server off.
              </p>
            </div>
          ),
        },
        { title: "Save", body: <>The device connects within a minute and this page shows it Online. Members with an active, paid membership are sent to it straight away.</> },
        {
          title: "Older terminal without HTTPS?",
          body: <>Run the Gymix Bridge on a computer at the gym, then enter that computer&apos;s address (e.g. 192.168.1.10), port 8091, with Enable Domain Name off. The bridge passes everything on to Gymix securely.</>,
        },
        {
          title: "Enrol faces, fingerprints and cards on the device as usual",
          body: <>Use the member&apos;s number as the user ID (shown on their page under Door access). Gymix saves what you enrol and copies it to your other ZKTeco doors, and restores it if they renew after expiring.</>,
        },
      ]}
    />
  );
}

function HikBridgeSetup({ bridgeSeen }: { bridgeSeen: string | null }) {
  const running = isRecent(bridgeSeen, 2 * 60_000);
  return (
    <Steps
      items={[
        {
          title: running ? "The Gymix Bridge is running" : "Run the Gymix Bridge at the gym",
          body: running ? (
            <>Heard from it {ago(bridgeSeen)}. Nothing to do here.</>
          ) : (
            <>
              On a computer that stays on, on the same network as the device. Download it from{" "}
              <Link href="/dashboard/access?tab=bridge" className="font-medium text-ink underline underline-offset-4">
                Access → Gymix Bridge
              </Link>
              .
            </>
          ),
        },
        { title: "Give the device a fixed address", body: <>In your router, reserve the device&apos;s address (DHCP reservation), so it doesn&apos;t change after a power cut.</> },
        { title: "That's it", body: <>The bridge checks the device every minute, sets it to send its door events to the bridge, and sends members to it with their validity dates. Expired members are refused by the device itself, even if the internet is down.</> },
        { title: "Enrol faces and cards", body: <>On the device or in Hik-Connect, use the member&apos;s number as the employee ID (shown on their page under Door access).</> },
      ]}
    />
  );
}

function HikDirectSetup({ eventUrl }: { eventUrl: string }) {
  return (
    <Steps
      items={[
        { title: "Make the device reachable", body: <>In your router, forward a port to the device&apos;s HTTP port (usually 80). The address you entered must reach it from the internet.</> },
        {
          title: "Send door events to Gymix",
          body: (
            <div className="space-y-2">
              <p>On the device&apos;s web page: Configuration → Network → Advanced → HTTP Listening (or Event → Alarm Host). Add this address, protocol HTTPS, port 443:</p>
              <CopyField label="Event address" value={eventUrl} secret />
              <p>It contains a secret for this device. If your device only offers HTTP, use the Gymix Bridge instead.</p>
            </div>
          ),
        },
        { title: "Test", body: <>Press Test on the device: it should succeed. Gymix also contacts the device whenever there&apos;s a change to send, and every night.</> },
      ]}
    />
  );
}
