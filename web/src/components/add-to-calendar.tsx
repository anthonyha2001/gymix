"use client";

import { useState } from "react";
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { haptics } from "@/lib/haptics";

// "Add to calendar" for a booked class or PT session: a standard calendar
// file (.ics) the phone opens in its own calendar (iPhone Calendar, Google
// Calendar), with a reminder an hour before.
//   start: "2026-11-14T19:00" in the gym's time zone, or a full ISO time (UTC).
export function AddToCalendar({ title, start, minutes, timeZone, location, id }: { title: string; start: string; minutes: number; timeZone: string; location?: string | null; id: string }) {
  const [done, setDone] = useState(false);

  function download() {
    const isUtc = /Z$|[+-]\d\d:\d\d$/.test(start);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const local = (s: string) => s.replace(/[-:]/g, "").slice(0, 13) + "00";
    let dtStart: string;
    let dtEnd: string;
    if (isUtc) {
      const a = new Date(start);
      dtStart = `DTSTART:${fmt(a)}`;
      dtEnd = `DTEND:${fmt(new Date(a.getTime() + minutes * 60_000))}`;
    } else {
      const [d, t] = start.split("T");
      const [h, m] = t.split(":").map(Number);
      const endMin = h * 60 + m + minutes;
      const end = new Date(`${d}T00:00:00Z`);
      end.setUTCMinutes(endMin);
      const endLocal = `${end.toISOString().slice(0, 10)}T${end.toISOString().slice(11, 16)}`;
      dtStart = `DTSTART;TZID=${timeZone}:${local(start)}`;
      dtEnd = `DTEND;TZID=${timeZone}:${local(endLocal)}`;
    }
    // Calendar files escape backslashes, semicolons, commas and line breaks.
    const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Gymix//Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${id}@gymix`,
      `DTSTAMP:${fmt(new Date())}`,
      dtStart,
      dtEnd,
      `SUMMARY:${esc(title)}`,
      location ? `LOCATION:${esc(location)}` : "",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(title)}`,
      "TRIGGER:-PT1H",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w -]+/g, "").slice(0, 40) || "gymix"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    haptics.success();
    setDone(true);
  }

  return (
    <button
      type="button"
      onClick={download}
      aria-label={`Add ${title} to your calendar`}
      title="Add to my calendar"
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition active:scale-90 ${done ? "bg-brand/20 text-ink" : "text-muted hover:bg-canvas hover:text-ink"}`}
    >
      {done ? <CalendarCheck className="check-pop size-4" /> : <CalendarPlus className="size-4" />}
    </button>
  );
}
