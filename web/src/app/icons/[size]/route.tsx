import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

// App icons for the home screen: the Gymix "G" on the brand green, with room
// around it so "maskable" crops (circles, squircles) keep it whole.
export async function GET(_request: Request, { params }: RouteContext<"/icons/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#c8f135" }}>
        <div style={{ fontSize: size * 0.5, fontWeight: 900, color: "#0d1117", lineHeight: 1 }}>G</div>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
