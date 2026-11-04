import QRCode from "qrcode";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui";

// QR code for a sticker link, as inline SVG plus a PNG to download and print.
export async function qrFor(url: string, size = 160) {
  const [svg, png] = await Promise.all([
    QRCode.toString(url, { type: "svg", margin: 1, width: size }),
    QRCode.toDataURL(url, { margin: 2, width: 1000 }),
  ]);
  return { svg, png };
}

export function fileSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gymix";
}

export function QrDownload({ png, name, className = "" }: { png: string; name: string; className?: string }) {
  return (
    <a href={png} download={`${fileSlug(name)}-qr.png`} className={buttonClass("secondary", `h-10 ${className}`)}>
      <Download className="size-4" /> Download QR
    </a>
  );
}
