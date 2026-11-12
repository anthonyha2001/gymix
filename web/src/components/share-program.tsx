"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Share2, Smartphone } from "lucide-react";
import { Modal } from "@/components/dialog";
import { buttonClass } from "@/components/ui";
import { showToast } from "@/components/toaster";
import { haptics } from "@/lib/haptics";
import { shareProgram } from "@/app/share-actions";

// "Share" on a program: a big QR code for the friend's camera, the phone's
// own share sheet (AirDrop: hold two iPhones together), or a copied link.
export function ShareProgramButton({ programId, name }: { programId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; svg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy(true);
    haptics.tap();
    const r = await shareProgram(programId);
    setBusy(false);
    if (r.error || !r.url || !r.svg) return showToast(r.error ?? "Couldn't share this program.", "error");
    setLink({ url: r.url, svg: r.svg });
    setOpen(true);
  }

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <>
      <button type="button" onClick={start} disabled={busy} aria-label="Share program" title="Share with a friend" className={buttonClass("secondary", "h-10 gap-2")}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        Share
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Share ${name}`} description="Your friend scans the code, or you send the link." sheet>
        {link && (
          <div className="space-y-5">
            <div className="share-qr relative mx-auto w-full max-w-[17rem]">
              <span aria-hidden className="share-qr-glow" />
              <div className="relative rounded-[1.75rem] bg-white p-5 shadow-xl ring-1 ring-line">
                <div className="share-qr-code [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: link.svg }} />
                <span aria-hidden className="absolute top-1/2 left-1/2 grid size-12 -translate-1/2 place-items-center rounded-xl bg-brand ring-4 ring-white">
                  <Share2 className="size-5 text-ink" strokeWidth={2.5} />
                </span>
              </div>
            </div>
            <p className="flex items-center justify-center gap-2 text-center text-sm text-muted">
              <Smartphone className="size-4" /> Friend opens their camera and points it here
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {canShare && (
                <button
                  type="button"
                  onClick={async () => {
                    haptics.tap();
                    try {
                      await navigator.share({ title: name, text: `My program "${name}" on Gymix`, url: link.url });
                    } catch {}
                  }}
                  className={buttonClass("primary", "h-12")}
                >
                  <Share2 className="size-4" /> Share… <span className="text-white/60">(AirDrop)</span>
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(link.url);
                  haptics.success();
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={buttonClass("secondary", `h-12 ${canShare ? "" : "sm:col-span-2"}`)}
              >
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                {copied ? "Link copied" : "Copy link"}
              </button>
            </div>
            <p className="text-center text-xs text-muted">The link works for 30 days. Your friend gets their own copy; your sets and weights stay private.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
