// Client-safe calendar shapes and helpers, shared by the staff and member
// schedule calendars. Dates are gym-local "YYYY-MM-DD", times "HH:MM".

import { addDays } from "@/lib/format";
import { endTime, hhmm, weekdayOf } from "@/lib/schedule";

export type CalTone = "class" | "course" | "pt" | "mine" | "full" | "muted";

export type CalEvent = {
  id: string;
  kind: "class" | "course" | "pt";
  date: string;
  start: string;
  end: string;
  title: string;
  // Trainer, room, member...
  subtitle?: string;
  // Small status shown on the event: "3/10", "Booked", "Requested"...
  status?: string;
  tone: CalTone;
  // Staff: where clicking the event goes (a dialog on the same page, or a profile).
  href?: string;
  // Member booking (class sessions only).
  classId?: string;
  bookingId?: string;
  bookingStatus?: string;
  spotsLeft?: number;
  // Monthly course: booked through a subscription, not session by session.
  courseNote?: string;
};

// Monday of the week containing `date`.
export function weekStart(date: string) {
  const dow = weekdayOf(date);
  return addDays(date, -((dow + 6) % 7));
}

// The range the calendar loads at once: from last week to eight weeks ahead,
// so moving between weeks and months needs no server round trip.
export function calendarWindow(today: string) {
  const from = addDays(weekStart(today), -7);
  return { from, to: addDays(from, 7 * 10 - 1) };
}

export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

type ClassDef = {
  id: string;
  name: string;
  weekday: number;
  start_time: string;
  duration_min: number;
};

// One event per class session in the window.
export function classSessions<C extends ClassDef>(
  classes: C[],
  from: string,
  to: string,
  make: (c: C, date: string, base: Pick<CalEvent, "id" | "date" | "start" | "end" | "title">) => CalEvent | null,
) {
  const events: CalEvent[] = [];
  for (const date of datesBetween(from, to)) {
    const dow = weekdayOf(date);
    for (const c of classes) {
      if (c.weekday !== dow) continue;
      const ev = make(c, date, {
        id: `${c.id}_${date}`,
        date,
        start: hhmm(c.start_time),
        end: endTime(c.start_time, c.duration_min),
        title: c.name,
      });
      if (ev) events.push(ev);
    }
  }
  return events;
}

// "2026-11-05T16:30:00Z" -> gym-local date and time.
export function localDateTime(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export function addMinutes(time: string, minutes: number) {
  return endTime(`${time}:00`, minutes);
}
