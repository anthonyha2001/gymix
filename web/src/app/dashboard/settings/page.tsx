import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import QRCode from "qrcode";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ActionButton } from "../members/action-button";
import { rotateStickerLink } from "./actions";
import { CopyLink, SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" />
      <Suspense fallback={<Skeleton className="h-[500px]" />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const { membership } = await requireStaff(["owner"]);
  const supabase = await createClient();
  const { data: token } = await supabase.rpc("get_checkin_token", { p_gym_id: membership.gymId });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const url = `${proto}://${host}/c/${token}`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, width: 200 });

  return (
    <>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold">Gym</h2>
        <SettingsForm name={membership.gymName} lbpRate={membership.lbpRate} />
      </Card>

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
            <CopyLink url={url} />
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
    </>
  );
}
