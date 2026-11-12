"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, SkipForward } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { isNativeApp } from "@/lib/native";

export type Rest = { endsAt: number; total: number; label: string };

const NOTIFY_ID = 4242;

// The rest timer between sets: a ring that drains, ±15 s, skip. The last three
// seconds tick on the phone; at zero it chimes, buzzes and says go.
// It reaches the lock screen too: the app schedules a real notification for
// the end of the rest (so it arrives with the phone locked); the web app shows
// one if the page is in the background when time's up.
export function RestTimer({ rest, onChange, onDone }: { rest: Rest; onChange: (r: Rest) => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const ticked = useRef<number>(-1);
  const finished = useRef(false);
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const progress = rest.total ? Math.min(1, Math.max(0, (rest.endsAt - now) / (rest.total * 1000))) : 0;
  const over = left === 0;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Lock screen: (re)schedule whenever the end time changes.
  useEffect(() => {
    finished.current = false;
    scheduleLockScreen(rest);
    return () => {
      cancelLockScreen();
    };
  }, [rest]);

  // 3-2-1 ticks, then the finish.
  useEffect(() => {
    if (left > 0 && left <= 3 && ticked.current !== left) {
      ticked.current = left;
      haptics.tick();
    }
    if (over && !finished.current) {
      finished.current = true;
      haptics.success();
      chime();
      if (document.visibilityState === "hidden" && !isNativeApp()) showWebNotification(rest.label);
      const t = setTimeout(onDone, 6000);
      return () => clearTimeout(t);
    }
  }, [left, over, onDone, rest.label]);

  const add = (s: number) => {
    const endsAt = Math.max(Date.now() + 5000, rest.endsAt + s * 1000);
    haptics.tap();
    onChange({ ...rest, endsAt, total: Math.max(rest.total, Math.ceil((endsAt - Date.now()) / 1000)) });
  };

  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <div className={`rest-pill mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 ${over ? "is-over" : ""}`}>
      <span className="relative grid size-14 shrink-0 place-items-center">
        <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={R} fill="none" strokeWidth="4" className="stroke-white/10" />
          <circle
            cx="28"
            cy="28"
            r={R}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="stroke-brand transition-[stroke-dashoffset] duration-200 ease-linear"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
        <span className={`relative text-sm font-black tabular-nums ${left <= 3 && !over ? "rest-beat text-brand" : ""}`}>
          {over ? "GO" : left >= 60 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : left}
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{over ? "Rest over" : "Resting"}</span>
        <span className={`block truncate font-semibold ${over ? "rest-go text-brand" : "text-white"}`}>{over ? `Next set: ${rest.label}` : rest.label}</span>
      </span>

      {!over && (
        <>
          <RoundButton label="15 seconds less" onClick={() => add(-15)}>
            <Minus className="size-4" />
          </RoundButton>
          <RoundButton label="15 seconds more" onClick={() => add(15)}>
            <Plus className="size-4" />
          </RoundButton>
        </>
      )}
      <RoundButton label={over ? "Close" : "Skip rest"} onClick={onDone} wide>
        {over ? "Close" : <SkipForward className="size-4" />}
      </RoundButton>
    </div>
  );
}

function RoundButton({ label, onClick, children, wide = false }: { label: string; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-10 shrink-0 place-items-center rounded-full bg-white/[0.08] text-sm font-semibold text-white ring-1 ring-white/10 transition active:scale-90 hover:bg-white/[0.14] ${wide ? "min-w-10 px-3" : "w-10"}`}
    >
      {children}
    </button>
  );
}

let ctx: AudioContext | null = null;
function chime() {
  try {
    ctx ??= new AudioContext();
    [659.25, 987.77, 1318.5].forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx!.currentTime + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {}
}

async function scheduleLockScreen(rest: Rest) {
  if (!isNativeApp()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted" && (await LocalNotifications.requestPermissions()).display !== "granted") return;
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFY_ID }] }).catch(() => {});
    if (rest.endsAt <= Date.now() + 1000) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFY_ID,
          title: "Rest over",
          body: `Next set: ${rest.label}`,
          schedule: { at: new Date(rest.endsAt), allowWhileIdle: true },
          channelId: "gymix",
          extra: { link: location.pathname },
        },
      ],
    });
  } catch {}
}

async function cancelLockScreen() {
  if (!isNativeApp()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFY_ID }] });
  } catch {}
}

async function showWebNotification(label: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.showNotification("Rest over", { body: `Next set: ${label}`, icon: "/icons/192", badge: "/icons/badge", tag: "gymix-rest", data: { link: location.pathname } });
  } catch {}
}
