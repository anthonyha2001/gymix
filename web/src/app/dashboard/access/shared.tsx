import { Badge } from "@/components/ui";
import type { Tone } from "@/lib/format";

// Small pieces shared by the Access pages. Server-safe.

export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

// Heard from within the last `ms` milliseconds.
export function isRecent(iso: string | null | undefined, ms: number) {
  return Boolean(iso) && Date.now() - new Date(iso as string).getTime() < ms;
}

type DeviceLike = { connection: string; last_seen_at: string | null; is_active: boolean; last_error: string | null };

// ZKTeco devices call in every few seconds and the bridge reports every
// minute, so a few minutes of silence means offline. Direct devices are only
// reached when there's something to send, so they show when last reached.
export function deviceStatus(d: DeviceLike, now = Date.now()): { label: string; tone: Tone } {
  if (!d.is_active) return { label: "Paused", tone: "gray" };
  if (!d.last_seen_at) return { label: "Waiting for the device", tone: "amber" };
  const quiet = now - new Date(d.last_seen_at).getTime();
  if (d.connection === "direct") return d.last_error ? { label: "Can't reach it", tone: "red" } : { label: "Reachable", tone: "green" };
  if (quiet < 3 * 60_000) return d.last_error ? { label: "Online, with a problem", tone: "amber" } : { label: "Online", tone: "green" };
  return { label: "Offline", tone: "red" };
}

export const VENDOR_LABEL = { zkteco: "ZKTeco", hikvision: "Hikvision" } as const;
export const DIRECTION_LABEL = { in: "Entrance", out: "Exit", both: "Both ways" } as const;
export const CONNECTION_LABEL = { push: "Calls Gymix", direct: "Direct", bridge: "Gymix Bridge" } as const;
export const METHOD_LABEL: Record<string, string> = { face: "Face", fingerprint: "Fingerprint", card: "Card", pin: "PIN", palm: "Palm", qr: "QR code", unknown: "" };

export function OutcomeBadge({ outcome, direction }: { outcome: string | null; direction: string }) {
  if (direction === "out") return <Badge tone="blue">Left</Badge>;
  switch (outcome) {
    case "checked_in":
      return <Badge tone="green">Checked in</Badge>;
    case "already_in":
      return <Badge tone="gray">Already in</Badge>;
    case "refused":
      return <Badge tone="red">Let in, not allowed</Badge>;
    case "denied_by_device":
      return <Badge tone="amber">Refused at the door</Badge>;
    case "unknown_member":
      return <Badge tone="gray">Unknown person</Badge>;
    default:
      return <Badge tone="gray">Recorded</Badge>;
  }
}
