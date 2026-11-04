import QRCode from "qrcode";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui";

// QR code for a sticker link, as inline SVG (cheap). The large PNG for
// printing is only made when someone downloads it (see app/qr/route.ts).
export async function qrFor(url: string, size = 160) {
  return { svg: await QRCode.toString(url, { type: "svg", margin: 1, width: size }) };
}

export function fileSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gymix";
}

export function QrDownload({ text, name, className = "" }: { text: string; name: string; className?: string }) {
  const href = `/qr?${new URLSearchParams({ text, name: fileSlug(name) })}`;
  return (
    <a href={href} download={`${fileSlug(name)}-qr.png`} className={buttonClass("secondary", `h-10 ${className}`)}>
      <Download className="size-4" /> Download QR
    </a>
  );
}
