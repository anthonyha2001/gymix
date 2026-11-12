// Vibration patterns, one place for the whole app. Client-only.
//
// In the iPhone / Android app the native Haptics plugin drives the real
// vibration motor (iPhone included). In a browser, navigator.vibrate works on
// Android once the person has touched the page; iPhone browsers don't vibrate.
// Every call is safe to make anywhere.
import { isNativeApp } from "@/lib/native";

type HapticsPlugin = typeof import("@capacitor/haptics");

let plugin: Promise<HapticsPlugin> | null = null;
const load = () => (plugin ??= import("@capacitor/haptics"));

function native(run: (h: HapticsPlugin) => Promise<unknown>) {
  load()
    .then(run)
    .catch(() => {});
}

function web(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not allowed yet (no touch on the page): nothing.
  }
}

export const haptics = {
  // A tiny tick: a drag crossing a line, a quarter of the door slider.
  tick() {
    if (isNativeApp()) native(({ Haptics }) => Haptics.selectionChanged());
    else web(6);
  },
  // "Got it": a tap or a card landing.
  tap() {
    if (isNativeApp()) native(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }));
    else web(18);
  },
  // One soft beat, in time with a wave.
  pulse() {
    if (isNativeApp()) native(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
    else web(10);
  },
  // Done: a door opened, a challenge joined.
  success() {
    if (isNativeApp()) {
      native(async ({ Haptics, NotificationType, ImpactStyle }) => {
        await Haptics.notification({ type: NotificationType.Success });
        await new Promise((r) => setTimeout(r, 120));
        await Haptics.impact({ style: ImpactStyle.Heavy });
      });
    } else web([40, 60, 80]);
  },
  // Refused or failed.
  error() {
    if (isNativeApp()) native(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Error }));
    else web([200]);
  },
  // A heavy thud (the door slider reaching the end).
  heavy() {
    if (isNativeApp()) native(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Heavy }));
    else web([30, 30, 60]);
  },
};
