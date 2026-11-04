import { Printer } from "lucide-react";
import { NfcWriteButton } from "@/components/nfc-write";
import { QrDownload, qrFor } from "@/components/qr-tools";
import { buttonClass } from "@/components/ui";
import { requestOrigin } from "@/lib/origin";

// Every machine's sticker in one place: write the NFC stickers one after the
// other from a phone, download each QR, or print them all on one sheet.
export async function MachineStickers({ machines }: { machines: { id: string; name: string }[] }) {
  const origin = await requestOrigin();
  const rows = await Promise.all(
    machines.map(async (m) => {
      const url = `${origin}/m/${m.id}`;
      return { ...m, url, qr: await qrFor(url, 112) };
    }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-4 text-sm">
        <p className="max-w-md text-muted">
          Print the QR codes and stick each one next to its machine, for members whose phone can&apos;t read NFC. They
          scan it from the scan button in their app.
        </p>
        <a href="/print/machines" target="_blank" rel="noopener" className={buttonClass("primary", "h-10")}>
          <Printer className="size-4" /> Print all QR codes
        </a>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {rows.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="w-[112px] shrink-0 rounded-lg border border-line bg-white p-1" dangerouslySetInnerHTML={{ __html: m.qr.svg }} />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-semibold">{m.name}</p>
              <p className="truncate font-mono text-xs text-muted">{m.url}</p>
              <div className="flex flex-wrap items-start gap-2">
                <NfcWriteButton url={m.url} label={`Write ${m.name} sticker`} />
                <QrDownload text={m.url} name={m.name} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
