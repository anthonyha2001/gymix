import { ImageResponse } from "next/og";
import { markSvg } from "@/components/logo-mark";

const SIZES = new Set([180, 192, 512]);

// App icons for the home screen: the Gymix mark on the brand lime, with room
// around it so "maskable" crops (circles, squircles) keep it whole.
export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const name = (await params).size;
  // "badge": the small one-colour mark Android shows in the status bar.
  const badge = name === "badge";
  const size = badge ? 96 : Number(name);
  if (!badge && !SIZES.has(size)) return new Response("Not found", { status: 404 });
  const svg = badge
    ? markSvg({ background: "transparent", color: "#ffffff", radius: 0, scale: 0.9 })
    : markSvg({ background: "#c8f135", color: "#0d1117", radius: 0, scale: 0.78 });
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt="" width={size} height={size} src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} />
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
