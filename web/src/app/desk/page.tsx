import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/session";
import { BILLING_ROLES } from "@/lib/roles";
import { FrontDesk } from "./front-desk";
import { deskSnapshot } from "./actions";

export const metadata: Metadata = { title: "Front desk" };
export const viewport: Viewport = { themeColor: "#0d1117" };

// Front-desk tablet mode: a full-screen check-in station for a tablet on the
// reception counter. Scan member codes with the camera or a USB/Bluetooth
// barcode reader, or search by name.
export default function DeskPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <Desk />
    </Suspense>
  );
}

async function Desk() {
  const { membership } = await requireStaff(BILLING_ROLES);
  return <FrontDesk gymName={membership.gymName} timeZone={membership.timezone} initial={await deskSnapshot()} />;
}
