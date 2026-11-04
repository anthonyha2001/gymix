import { SubscriptionPanel } from "./subscription-panel";
import { NfcWriteButton } from "@/components/nfc-write";
import { QrDownload, qrFor } from "@/components/qr-tools";
import type { Metadata } from "next";
import { Suspense } from "react";
import { requestOrigin } from "@/lib/origin";
import QRCode from "qrcode";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../members/action-button";
import { activeTab, PageTabs } from "@/components/page-tabs";
import { rotateStickerLink, setTapSimulator } from "./actions";
import { CopyLink, PortalPagesForm, SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

const TABS = ["gym", "app", "checkin", "subscription"] as const;

export default function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" />
      <Suspense fallback={<Skeleton className="h-[500px]" />}>
        <SettingsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SettingsContent({ searchParams }: { searchParams: PageProps<"/dashboard/settings">["searchParams"] }) {
  const tab = activeTab((await searchParams).tab, TABS);
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  const [{ data: token }, { data: gym }] = await Promise.all([
    supabase.rpc("get_checkin_token", { p_gym_id: membership.gymId }),
    supabase.from("gyms").select("tap_simulator, portal_hidden, unpaid_grace_days").eq("id", membership.gymId).single(),
  ]);

  const url = `${await requestOrigin()}/c/${token}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 200 });

  return (
    <>
      <PageTabs
        base="/dashboard/settings"
        active={tab}
        tabs={[
          { id: "gym", label: "Gym" },
          { id: "app", label: "Member app" },
          { id: "checkin", label: "Check-in sticker" },
          { id: "subscription", label: "Subscription" },
        ]}
      />
      {tab === "subscription" && <SubscriptionPanel gymId={membership.gymId} gymName={membership.gymName} />}

      {tab === "gym" && (
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Gym</h2>
        <SettingsForm name={membership.gymName} lbpRate={membership.lbpRate} graceDays={gym?.unpaid_grace_days ?? 3} />
      </Card>
      )}

      {tab === "app" && (
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Member portal pages</h2>
          <p className="text-sm text-muted">Choose what members see in their app. Pages you switch off disappear from their menu.</p>
        </div>
        <PortalPagesForm hidden={gym?.portal_hidden ?? []} />
      </Card>
      )}

      {tab === "checkin" && (
      <Card className="space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Tap-to-check-in sticker</h2>
          <p className="text-sm text-muted">
            Members tap their phone on a sticker at the entrance and they&apos;re checked in — no app, no QR scanning.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_200px]">
          <div className="space-y-4 text-sm">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Buy <strong>NFC stickers</strong> (type <strong>NTAG213</strong> or NTAG215, about $1 each online or at
                electronics shops).
              </li>
              <li>
                On any phone, install the free app <strong>NFC Tools</strong> → <em>Write</em> → <em>Add a record</em> →{" "}
                <em>URL</em>, paste the link below, then hold the phone on the sticker.
              </li>
              <li>Stick it at the entrance with a small sign: &ldquo;Tap your phone here to check in&rdquo;.</li>
              <li>
                Each member logs in once on their phone the first time they tap. After that, a tap checks them in
                instantly. iPhone XS and newer read stickers automatically; on Android, NFC must be on.
              </li>
            </ol>
            <NfcWriteButton url={url} label="Write the check-in sticker" />
            <CopyLink url={url} />
            <QrDownload png={(await qrFor(url)).png} name="check-in" />
            <p className="text-xs text-muted">
              Only members with an active membership get in — the tap is checked like a front-desk check-in, and every tap
              shows in your live check-in feed. Running Gymix on your own computer? Phones can only open this link once
              Gymix is online.
            </p>
          </div>
          <figure className="space-y-2 text-center">
            <div
              className="mx-auto w-[200px] rounded-lg border border-line bg-white p-2"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <figcaption className="text-xs text-muted">
              Backup for phones without NFC: print this next to the sticker.
            </figcaption>
          </figure>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <ActionButton
            action={rotateStickerLink}
            label="Replace link"
            variant="danger"
            confirm="Create a new link? Every existing sticker and printed code stops working until you rewrite it."
          />
          <span className="text-xs text-muted">Only needed if the link was shared outside the gym.</span>
        </div>
      </Card>
      )}

      {tab === "app" && (
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Tap simulator</h2>
            {gym?.tap_simulator ? <Badge tone="amber">On — testing mode</Badge> : <Badge tone="gray">Off</Badge>}
          </div>
          <p className="text-sm text-muted">
            For testing without stickers: in the member portal, pressing Space twice simulates tapping the entrance sticker to
            check in. Switch it off before members use Gymix for real, so nobody can check in from home.
          </p>
        </div>
        <ActionButton
          action={setTapSimulator.bind(null, !gym?.tap_simulator)}
          label={gym?.tap_simulator ? "Switch off" : "Switch on"}
          variant={gym?.tap_simulator ? "danger" : "secondary"}
        />
      </Card>
      )}
    </>
  );
}
