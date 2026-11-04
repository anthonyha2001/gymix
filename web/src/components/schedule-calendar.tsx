"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { Modal } from "@/components/dialog";
import { showToast } from "@/components/toaster";
import { Badge, buttonClass } from "@/components/ui";
import { bookClass, cancelBooking } from "@/app/schedule-actions";
import { addDays } from "@/lib/format";
import { type CalEvent, type CalTone, datesBetween, weekStart } from "@/lib/calendar";

// Week, day and month calendar for class sessions, courses and personal
// training. Everything for the loaded window is already here, so moving
// between days, weeks and months is instant.

type View = "day" | "week" | "month";

const HOUR_PX = 56;

const TONES: Record<CalTone, string> = {
  class: "border-brand-strong bg-brand/35 text-ink",
  course: "border-sky-500 bg-sky-100 text-sky-950",
  pt: "border-violet-500 bg-violet-100 text-violet-950",
  mine: "border-success bg-success-soft text-success",
  full: "border-danger/60 bg-danger-soft text-danger",
  muted: "border-line bg-canvas text-muted",
};

const LEGEND: { tone: CalTone; label: string }[] = [
  { tone: "class", label: "Class" },
  { tone: "course", label: "Monthly course" },
  { tone: "pt", label: "Personal training" },
];

function fmt(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
function addMonths(date: string, n: number) {
  const d = new Date(`${monthStart(date)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

const subscribeMedia = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// Lays out overlapping events side by side within one day.
function columns(events: CalEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const placed: { ev: CalEvent; col: number; cols: number }[] = [];
  let group: { ev: CalEvent; col: number }[] = [];
  let groupEnd = "";
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    for (const g of group) placed.push({ ...g, cols });
    group = [];
  };
  for (const ev of sorted) {
    if (group.length && ev.start >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.ev.end > ev.start).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ ev, col });
    // The group runs until its latest-ending event.
    if (group.length === 1 || ev.end > groupEnd) groupEnd = ev.end;
  }
  if (group.length) flush();
  return placed;
}

export function ScheduleCalendar({
  events,
  today,
  windowFrom,
  windowTo,
  mode,
  emptyHint,
}: {
  events: CalEvent[];
  today: string;
  windowFrom: string;
  windowTo: string;
  mode: "staff" | "member";
  emptyHint?: string;
}) {
  const router = useRouter();
  const isPhone = useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const [chosenView, setView] = useState<View | null>(null);
  const view: View = chosenView ?? (isPhone ? "day" : "week");
  const [anchor, setAnchor] = useState(today);
  const [open, setOpen] = useState<CalEvent | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) map.set(ev.date, [...(map.get(ev.date) ?? []), ev]);
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [events]);

  const week = datesBetween(weekStart(anchor), addDays(weekStart(anchor), 6));
  const shownDays = view === "day" ? [anchor] : week;

  // Hours shown: 6:00 to 22:00, widened to fit any earlier or later session.
  const [fromHour, toHour] = useMemo(() => {
    let lo = 6 * 60;
    let hi = 22 * 60;
    for (const ev of events) {
      lo = Math.min(lo, toMinutes(ev.start));
      hi = Math.max(hi, toMinutes(ev.end) || 24 * 60);
    }
    return [Math.floor(lo / 60), Math.min(24, Math.ceil(hi / 60))];
  }, [events]);

  function step(dir: -1 | 1) {
    setAnchor((a) => {
      const next = view === "day" ? addDays(a, dir) : view === "week" ? addDays(a, 7 * dir) : addMonths(a, dir);
      if (next < windowFrom) return windowFrom;
      if (next > windowTo) return windowTo;
      return next;
    });
  }
  const canPrev = view === "month" ? monthStart(anchor) > windowFrom : (view === "day" ? anchor : week[0]) > windowFrom;
  const canNext = view === "month" ? addMonths(anchor, 1) <= windowTo : (view === "day" ? anchor : week[6]) < windowTo;

  const title =
    view === "day"
      ? fmt(anchor, { weekday: "long", day: "numeric", month: "long" })
      : view === "week"
        ? `${fmt(week[0], { day: "numeric", month: "short" })} – ${fmt(week[6], { day: "numeric", month: "short", year: "numeric" })}`
        : fmt(anchor, { month: "long", year: "numeric" });

  function openEvent(ev: CalEvent) {
    if (mode === "staff" && ev.href) router.push(ev.href, { scroll: false });
    else setOpen(ev);
  }

  const hours = Array.from({ length: toHour - fromHour }, (_, i) => fromHour + i);

  // Open the time grid at the first session of the days shown (or 08:00),
  // so evening classes aren't hidden below the fold.
  const gridRef = useRef<HTMLDivElement>(null);
  const firstStart = shownDays
    .flatMap((d) => byDate.get(d) ?? [])
    .reduce((min, ev) => Math.min(min, toMinutes(ev.start)), 24 * 60);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const target = firstStart < 24 * 60 ? firstStart - 30 : 8 * 60;
    el.scrollTo({ top: Math.max(0, ((target - fromHour * 60) / 60) * HOUR_PX), behavior: "smooth" });
  }, [firstStart, fromHour, view, anchor]);
  const nowMinutes = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  })();

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <button type="button" onClick={() => setAnchor(today)} className={buttonClass("secondary", "h-9 px-3")}>
          Today
        </button>
        <div className="flex items-center">
          <button type="button" aria-label="Previous" disabled={!canPrev} onClick={() => step(-1)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next" disabled={!canNext} onClick={() => step(1)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <h2 className="min-w-0 flex-1 truncate font-semibold" aria-live="polite">
          {title}
        </h2>
        <div role="group" aria-label="Calendar view" className="flex rounded-lg bg-canvas p-0.5">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`h-8 rounded-md px-3 text-sm font-medium capitalize transition ${view === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Day strip (day view): jump between the days of the week */}
      {view === "day" && (
        <div className="grid grid-cols-7 gap-1 border-b border-line p-2">
          {week.map((d) => {
            const on = d === anchor;
            const count = byDate.get(d)?.length ?? 0;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setAnchor(d)}
                disabled={d < windowFrom || d > windowTo}
                className={`flex flex-col items-center rounded-xl py-1.5 text-xs transition disabled:opacity-30 ${on ? "bg-ink text-white" : d === today ? "bg-brand/30" : "hover:bg-canvas"}`}
              >
                <span className={on ? "text-white/70" : "text-muted"}>{fmt(d, { weekday: "narrow" })}</span>
                <span className="text-base font-semibold tabular-nums">{Number(d.slice(8))}</span>
                <span className={`mt-0.5 size-1.5 rounded-full ${count ? (on ? "bg-brand" : "bg-ink/40") : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      )}

      {view === "month" ? (
        <MonthGrid anchor={anchor} today={today} byDate={byDate} windowFrom={windowFrom} windowTo={windowTo} onPickDay={(d) => {
          setAnchor(d);
          setView("day");
        }} onOpen={openEvent} />
      ) : (
        <div ref={gridRef} className="max-h-[70vh] overflow-auto">
          <div className="grid min-w-0" style={{ gridTemplateColumns: `3.25rem repeat(${shownDays.length}, minmax(${view === "week" ? "7.5rem" : "0"}, 1fr))` }}>
            {/* Day headers (week view) */}
            {view === "week" && (
              <>
                <div className="sticky top-0 z-20 border-b border-line bg-surface" />
                {shownDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setAnchor(d);
                      setView("day");
                    }}
                    className={`sticky top-0 z-20 border-b border-l border-line px-2 py-2 text-left text-xs hover:bg-canvas ${d === today ? "bg-brand/25" : "bg-surface"}`}
                  >
                    <span className="block text-muted">{fmt(d, { weekday: "short" })}</span>
                    <span className="text-lg font-semibold tabular-nums">{Number(d.slice(8))}</span>
                  </button>
                ))}
              </>
            )}

            {/* Hour labels */}
            <div className="relative" style={{ height: hours.length * HOUR_PX }}>
              {hours.map((h, i) => (
                <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted tabular-nums" style={{ top: i * HOUR_PX }}>
                  {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>

            {shownDays.map((d) => (
              <div key={d} className="relative border-l border-line" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
                ))}
                {d === today && nowMinutes >= fromHour * 60 && nowMinutes <= toHour * 60 && (
                  <div className="absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMinutes - fromHour * 60) / 60) * HOUR_PX }}>
                    <span className="-ml-1 size-2 rounded-full bg-danger" />
                    <span className="h-px flex-1 bg-danger" />
                  </div>
                )}
                {columns(byDate.get(d) ?? []).map(({ ev, col, cols }) => {
                  const top = ((toMinutes(ev.start) - fromHour * 60) / 60) * HOUR_PX;
                  const height = Math.max(26, (((toMinutes(ev.end) || 24 * 60) - toMinutes(ev.start)) / 60) * HOUR_PX - 2);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => openEvent(ev)}
                      className={`absolute overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-xs shadow-sm transition hover:z-10 hover:shadow-md ${TONES[ev.tone]}`}
                      style={{ top: top + 1, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                    >
                      <span className="block truncate font-semibold">{ev.title}</span>
                      <span className="block truncate opacity-80 tabular-nums">
                        {ev.start}–{ev.end}
                        {ev.status ? ` · ${ev.status}` : ""}
                      </span>
                      {height > 52 && ev.subtitle && <span className="block truncate opacity-70">{ev.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {shownDays.every((d) => !(byDate.get(d)?.length)) && (
            <p className="border-t border-line px-4 py-3 text-center text-sm text-muted">{emptyHint ?? "Nothing scheduled."}</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-xs text-muted">
        {LEGEND.map((l) => (
          <span key={l.tone} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm border-l-4 ${TONES[l.tone]}`} /> {l.label}
          </span>
        ))}
        {mode === "member" && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm border-l-4 ${TONES.mine}`} /> Booked by you
          </span>
        )}
      </div>

      {open && <EventDialog ev={open} today={today} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MonthGrid({
  anchor,
  today,
  byDate,
  windowFrom,
  windowTo,
  onPickDay,
  onOpen,
}: {
  anchor: string;
  today: string;
  byDate: Map<string, CalEvent[]>;
  windowFrom: string;
  windowTo: string;
  onPickDay: (d: string) => void;
  onOpen: (ev: CalEvent) => void;
}) {
  const first = monthStart(anchor);
  const start = weekStart(first);
  const days = datesBetween(start, addDays(start, 41));
  const month = anchor.slice(0, 7);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line text-center text-xs text-muted">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDate.get(d) ?? [];
          const inMonth = d.slice(0, 7) === month;
          const outside = d < windowFrom || d > windowTo;
          return (
            <div key={d} className={`min-h-24 border-b border-l border-line p-1 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${inMonth ? "" : "bg-canvas/60"}`}>
              <button
                type="button"
                onClick={() => onPickDay(d)}
                disabled={outside}
                className={`mb-1 grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums disabled:opacity-40 ${d === today ? "bg-ink text-white" : inMonth ? "hover:bg-canvas" : "text-muted"}`}
              >
                {Number(d.slice(8))}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onOpen(ev)}
                    className={`block w-full truncate rounded border-l-2 px-1 py-0.5 text-left text-[11px] ${TONES[ev.tone]}`}
                  >
                    <span className="tabular-nums">{ev.start}</span> {ev.title}
                  </button>
                ))}
                {list.length > 3 && (
                  <button type="button" onClick={() => onPickDay(d)} className="w-full px-1 text-left text-[11px] font-medium text-muted hover:text-ink">
                    +{list.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Details of one event; members book or cancel from here.
function EventDialog({ ev, today, onClose }: { ev: CalEvent; today: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const past = ev.date < today;
  const run = (fn: () => Promise<{ error?: string; success?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) showToast(r.error, "error");
      else {
        showToast(r.success ?? "Done.");
        onClose();
      }
    });

  return (
    <Modal open onClose={onClose} title={ev.title} sheet>
      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted" /> {fmt(ev.date, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-muted" /> {ev.start}–{ev.end}
          </p>
          {ev.subtitle && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-muted" /> {ev.subtitle}
            </p>
          )}
          {ev.status && (
            <p>
              <Badge tone={ev.tone === "mine" ? "green" : ev.tone === "full" ? "red" : "gray"}>{ev.status}</Badge>
            </p>
          )}
          {ev.courseNote && <p className="rounded-lg bg-sky-50 p-3 text-sky-950">{ev.courseNote}</p>}
        </div>

        {ev.classId && !ev.courseNote && !past && (
          <div className="flex flex-wrap gap-2">
            {ev.bookingId && (ev.bookingStatus === "booked" || ev.bookingStatus === "waitlist") ? (
              <button type="button" disabled={pending} onClick={() => run(() => cancelBooking(ev.bookingId!))} className={buttonClass("secondary", "h-11 flex-1")}>
                {pending ? "Cancelling…" : ev.bookingStatus === "waitlist" ? "Leave the waitlist" : "Cancel my spot"}
              </button>
            ) : !ev.bookingId ? (
              <button type="button" disabled={pending} onClick={() => run(() => bookClass(ev.classId!, ev.date))} className={buttonClass("primary", "h-11 flex-1")}>
                {pending ? "Booking…" : (ev.spotsLeft ?? 1) > 0 ? "Book my spot" : "Join the waitlist"}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
