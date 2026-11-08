import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { ScreenPlayer } from "./player";

// A gym TV: open this link full screen on the TV's browser, a TV stick or a tablet.
export const metadata: Metadata = { title: "Gymix Screen", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#0d1117" };

export default function ScreenPage({ params }: PageProps<"/screen/[token]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-ink" />}>
      <Player params={params} />
    </Suspense>
  );
}

async function Player({ params }: { params: PageProps<"/screen/[token]">["params"] }) {
  const { token } = await params;
  return <ScreenPlayer token={token} />;
}
