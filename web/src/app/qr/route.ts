import QRCode from "qrcode";
import type { NextRequest } from "next/server";

// A print-quality QR code PNG for a sticker link, made only when someone
// downloads it. ?text= is the link, ?name= the file name.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const text = searchParams.get("text") ?? "";
  if (!text || text.length > 500) return new Response("Missing link", { status: 400 });
  const name = (searchParams.get("name") ?? "gymix").replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "gymix";
  const png = await QRCode.toBuffer(text, { margin: 2, width: 1000 });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${name}-qr.png"`,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
