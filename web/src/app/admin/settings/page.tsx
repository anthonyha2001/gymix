import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requestOrigin } from "@/lib/origin";
import { requirePlatformAdmin } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMPLATE_LIST } from "@/lib/whatsapp-templates";
import { gymixVerifyToken } from "@/lib/whatsapp-webhook";
import { ActionButton } from "../../dashboard/members/action-button";
import { syncGymixTemplates } from "../actions";
import { monitoring } from "../data";
import { BroadcastForm, PruneForm, WhatsAppKeysForm } from "../forms";
import { Pill, RoomHeader } from "../room-head";
import { Panel } from "../room-ui";

export const metadata: Metadata = { title: "Settings" };

// Platform-wide switches: a message to every gym, the Gymix WhatsApp number,
// and housekeeping for the monitoring data.
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <RoomHeader eyebrow="Settings" title="The platform" description="Things that apply to every gym at once." />
      <div className="room-ink grid gap-4 xl:grid-cols-2">
        <Panel title="Notify every gym">
          <p className="-mt-1 mb-4 text-sm text-white/45">Maintenance, new features, anything every gym should know. It lands in their bell.</p>
          <BroadcastForm />
        </Panel>
        <Panel title="Gymix WhatsApp number">
          <p className="-mt-1 mb-4 text-sm text-white/45">The default sender for reminders, receipts, invites and login details. Gyms can switch to their own number in Settings → WhatsApp.</p>
          <Suspense fallback={<Skeleton className="h-64 bg-white/5" />}>
            <WhatsAppKeys />
          </Suspense>
        </Panel>
        <Panel title="Monitoring data">
          <Suspense fallback={<Skeleton className="h-24 bg-white/5" />}>
            <Stored />
          </Suspense>
        </Panel>
      </div>
    </div>
  );
}

async function Stored() {
  await requirePlatformAdmin();
  const m = await monitoring(30);
  return (
    <>
      <p className="-mt-1 mb-4 text-sm text-white/45">
        {m.stored_events.toLocaleString("en-US")} events stored
        {m.oldest_event ? `, the oldest from ${formatDate(m.oldest_event)}` : ""}. Delete old ones to keep the database small.
      </p>
      <PruneForm />
    </>
  );
}

async function WhatsAppKeys() {
  await requirePlatformAdmin();
  const [{ data }, origin] = await Promise.all([
    createAdminClient().from("platform_secrets").select("whatsapp_token, whatsapp_phone_number_id, whatsapp_waba_id, whatsapp_app_secret, whatsapp_templates").maybeSingle(),
    requestOrigin(),
  ]);
  const token = data?.whatsapp_token ?? "";
  const templates = (data?.whatsapp_templates ?? {}) as Record<string, string>;
  return (
    <div className="space-y-5">
      <WhatsAppKeysForm tokenHint={token ? token.slice(-4) : null} phoneNumberId={data?.whatsapp_phone_number_id ?? ""} wabaId={data?.whatsapp_waba_id ?? ""} secretSaved={Boolean(data?.whatsapp_app_secret)} />
      <div className="space-y-2 border-t border-white/[0.06] pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Message templates</p>
          <ActionButton action={syncGymixTemplates} label="Create or check templates" pendingLabel="Checking…" className="h-8 px-3 text-xs" />
        </div>
        <ul className="room-rows divide-y divide-white/[0.05] rounded-2xl bg-white/[0.02] text-sm ring-1 ring-white/[0.06]">
          {TEMPLATE_LIST.map((t) => {
            const s = templates[t.name];
            return (
              <li key={t.name} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="font-mono text-xs text-white/70">{t.name}</span>
                <Pill tone={s === "APPROVED" ? "good" : s === "PENDING" ? "warn" : s ? "bad" : "none"}>{s?.toLowerCase() ?? "not checked"}</Pill>
              </li>
            );
          })}
        </ul>
      </div>
      {data?.whatsapp_app_secret && (
        <div className="space-y-1 border-t border-white/[0.06] pt-4 text-xs text-white/45">
          <p className="text-sm font-medium text-white">Delivery updates webhook</p>
          <p>
            Meta app → WhatsApp → Configuration → Webhook, subscribe to <b>messages</b>:
          </p>
          <p className="font-mono break-all text-white">{origin}/api/whatsapp/webhook</p>
          <p>
            Verify token: <span className="font-mono text-white">{gymixVerifyToken(data.whatsapp_app_secret)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
