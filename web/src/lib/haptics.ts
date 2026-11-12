// Vibration patterns, one place for the whole app. Client-only.
//
// In the iPhone / Android app (Capacitor) the native Haptics plugin drives the
// real vibration motor, including on iPhone. In a browser, navigator.vibrate
// works on Android once the person has touched the page; iPhone browsers
// don't vibrate at all. Every call is safe to make anywhere.

type NativeHaptics = {
  impact: (o: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>;
  notification: (o: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void>;
  vibrate?: (o: { duration: number }) => Promise<void>;
};

function native(): NativeHaptics | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: NativeHaptics } } }).Capacitor;
  return cap?.isNativePlatform?.() ? (cap.Plugins?.Haptics ?? null) : null;
}

function web(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not allowed yet (no touch on the page): silently nothing.
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const haptics = {
  // A tiny tick: a drag crossing a line, a quarter of the door slider.
  tick() {
    const n = native();
    if (n) n.impact({ style: "LIGHT" }).catch(() => {});
    else web(6);
  },
  // "Got it": a tap or a card landing.
  tap() {
    const n = native();
    if (n) n.impact({ style: "MEDIUM" }).catch(() => {});
    else web(18);
  },
  // One soft beat, in time with a wave.
  pulse() {
    const n = native();
    if (n) n.impact({ style: "LIGHT" }).catch(() => {});
    else web(10);
  },
  // Done: a door opened, a challenge joined.
  async success() {
    const n = native();
    if (n) {
      await n.notification({ type: "SUCCESS" }).catch(() => {});
      await sleep(120);
      await n.impact({ style: "HEAVY" }).catch(() => {});
    } else web([40, 60, 80]);
  },
  // Refused or failed.
  error() {
    const n = native();
    if (n) n.notification({ type: "ERROR" }).catch(() => {});
    else web([200]);
  },
  // A heavy thud (the door slider reaching the end).
  heavy() {
    const n = native();
    if (n) n.impact({ style: "HEAVY" }).catch(() => {});
    else web([30, 30, 60]);
  },
};
