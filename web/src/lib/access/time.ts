// Device clocks run on the gym's local time. These convert between a local
// wall-clock time ("2026-11-07 08:12:33" in Asia/Beirut) and a real instant.

function offsetMinutes(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

// "2026-11-07 08:12:33" (or with a T) in `timeZone` → Date. Null if unreadable.
export function localToDate(local: string, timeZone: string): Date | null {
  const m = local.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // Two passes settle the offset even across a daylight-saving change.
  let at = new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60000);
  at = new Date(guess - offsetMinutes(at, timeZone) * 60000);
  return Number.isNaN(at.getTime()) ? null : at;
}

// Date → "2026-11-07T08:12:33" in `timeZone` (what Hikvision expects).
export function dateToLocal(at: Date, timeZone: string) {
  const shifted = new Date(at.getTime() + offsetMinutes(at, timeZone) * 60000);
  return shifted.toISOString().slice(0, 19);
}

// Whole hours east of UTC right now (ZKTeco's TimeZone option).
export function utcOffsetHours(timeZone: string, at = new Date()) {
  return Math.round(offsetMinutes(at, timeZone) / 60);
}
