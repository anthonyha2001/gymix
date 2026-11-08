import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Kiosk } from "./kiosk";

// The self-service reception tablet. Open this link full screen on a tablet at the entrance.
export const metadata: Metadata = { title: "Gymix Reception", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#0d1117", maximumScale: 1 };

export default function KioskPage({ params }: PageProps<"/kiosk/[token]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-ink" />}>
      <KioskLoader params={params} />
    </Suspense>
  );
}

async function KioskLoader({ params }: { params: PageProps<"/kiosk/[token]">["params"] }) {
  const { token } = await params;
  return <Kiosk token={token} />;
}
