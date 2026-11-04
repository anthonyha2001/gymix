import Link from "next/link";
import { RouteModal } from "@/components/route-modal";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { todayIn } from "@/lib/format";
import { BOOKING_STATUS, dayLabel, endTime, hhmm, weekdayOf } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { cancelBooking, markAttendance } from "@/app/schedule-actions";
import { ActionButton } from "../members/action-button";

// One class on one date (?session=<classId>_<date>): who booked, attendance, waitlist.
export async function SessionModal({ session, membership }: { session: string; membership: { gymId: string; timezone: string } }) {
  const [classId, date] = session.split("_");
  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const supabase = await createClient();
  const [{ data: cls }, { data: bookings }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, name, weekday, start_time, duration_min, capacity, location, trainer:profiles(full_name)")
      .eq("id", classId)
      .eq("gym_id", membership.gymId)
      .maybeSingle(),
    supabase
      .from("class_bookings")
      .select("id, status, created_at, member_id, members(full_name, phone)")
      .eq("class_id", classId)
      .eq("session_date", date)
      .neq("status", "cancelled")
      .order("created_at"),
  ]);
  if (!cls || cls.weekday !== weekdayOf(date)) return null;

  const inClass = (bookings ?? []).filter((b) => b.status !== "waitlist");
  const waitlist = (bookings ?? []).filter((b) => b.status === "waitlist");
  const today = todayIn(membership.timezone);
  const started = date <= today;

  return (
    <RouteModal param="session" title={cls.name} size="lg">
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-muted">{dayLabel(date, today)}</p>
                <p className="text-sm text-muted">
          {hhmm(cls.start_time)}–{endTime(cls.start_time, cls.duration_min)}
          {cls.trainer?.full_name ? ` · ${cls.trainer.full_name}` : ""}
          {cls.location ? ` · ${cls.location}` : ""} · {inClass.length}/{cls.capacity} booked
        </p>
      </Card>

      <Card>
        <SectionTitle>Booked ({inClass.length})</SectionTitle>
        {!inClass.length ? (
          <EmptyState>Nobody has booked yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {inClass.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <Link href={`/dashboard/members/${b.member_id}`} className="font-medium hover:underline">
                    {b.members?.full_name}
                  </Link>
                  {b.members?.phone && <span className="block text-xs text-muted">{b.members.phone}</span>}
                </span>
                <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
                {started && (
                  <>
                    <ActionButton action={markAttendance.bind(null, b.id, true)} label="Came" variant={b.status === "attended" ? "primary" : "secondary"} className="h-8 px-3" />
                    <ActionButton action={markAttendance.bind(null, b.id, false)} label="No-show" variant="ghost" className="h-8 px-3" />
                  </>
                )}
                {b.status === "booked" && !started && (
                  <ActionButton action={cancelBooking.bind(null, b.id)} label="Cancel" variant="ghost" className="h-8 px-3" confirm="Cancel this booking? The first person on the waitlist gets the spot." />
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {waitlist.length > 0 && (
        <Card>
          <SectionTitle>Waitlist ({waitlist.length})</SectionTitle>
          <ol className="divide-y divide-line border-t border-line">
            {waitlist.map((b, i) => (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-6 text-muted">{i + 1}.</span>
                <Link href={`/dashboard/members/${b.member_id}`} className="flex-1 font-medium hover:underline">
                  {b.members?.full_name}
                </Link>
                <ActionButton action={cancelBooking.bind(null, b.id)} label="Remove" variant="ghost" className="h-8 px-3" />
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
    </RouteModal>
  );
}
