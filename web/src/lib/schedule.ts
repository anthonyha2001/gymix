// Client-safe schedule helpers.

import { addDays } from "@/lib/format";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Weekday (0 = Sunday) of a YYYY-MM-DD calendar date.
export function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function nextDays(from: string, count: number) {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

// "19:00:00" -> "19:00"
export function hhmm(time: string) {
  return time.slice(0, 5);
}

export function endTime(start: string, minutes: number) {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

// A wall-clock time at the gym ("2026-11-05" + "18:30") as an ISO instant.
// Works out the gym timezone's offset at that moment.
export function gymTimeToIso(date: string, time: string, timeZone: string) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const offset = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offset).toISOString();
}

export const BOOKING_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" }> = {
  booked: { label: "Booked", tone: "green" },
  waitlist: { label: "Waitlist", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "gray" },
  attended: { label: "Attended", tone: "blue" },
  no_show: { label: "No-show", tone: "red" },
};

export const PT_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" }> = {
  requested: { label: "Requested", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  declined: { label: "Declined", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
  done: { label: "Done", tone: "blue" },
};
