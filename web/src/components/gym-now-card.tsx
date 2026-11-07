import { Activity } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { hasFeature } from "@/lib/features";
import { LEVELS, gymClock, loadOccupancy } from "@/lib/occupancy";
import { hourLabel } from "@/lib/hours";

// "Right now at the gym" on the member's Home: how busy it is, and the usual
// pattern for today so they can pick a quiet time.
export async function GymNowCard({ gymId, gymName, timeZone }: { gymId: string; gymName: string; timeZone: string }) {
  if (!(await hasFeature(gymId, "live_occupancy"))) return null;
  const data = await loadOccupancy(gymId).catch(() => null);
  if (!data) return null;
  const { now, busy } = data;
  const clock = gymClock(timeZone);
  const level = LEVELS[now.level];
  const todays = busy.filter((b) => b.weekday === clock.weekday && b.hour >= 5);
  const max = Math.max(1, ...todays.map((b) => b.people));
  const upcoming = todays.filter((b) => b.hour > clock.hour && b.hour <= 22);
  const quietest = upcoming.length ? upcoming.reduce((a, b) => (b.people < a.people ? b : a)) : null;
  const busiest = todays.length ? todays.reduce((a, b) => (b.people > a.people ? b : a)) : null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Activity className="size-4" /> Right now at {gymName}
          </p>
          <p className="mt-1 text-xl font-semibold">
            {now.people} {now.people === 1 ? "person" : "people"}
            {now.capacity ? <span className="text-base font-normal text-muted"> of {now.capacity}</span> : null}
          </p>
        </div>
        <Badge tone={level.tone}>{level.label}</Badge>
      </div>
      {todays.some((b) => b.people > 0) && (
        <>
          <div className="mt-4 flex h-14 items-end gap-[2px]" aria-hidden>
            {todays.map((b) => (
              <span
                key={b.hour}
                title={`${hourLabel(b.hour)}: usually ${Math.round(b.people)}`}
                className={`flex-1 rounded-t-[3px] ${b.hour === clock.hour ? "bg-brand-strong" : b.hour < clock.hour ? "bg-ink/20" : "bg-ink/60"}`}
                style={{ height: `${Math.max(6, (b.people / max) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            {busiest && busiest.people > 0 && <>Usually busiest around {hourLabel(busiest.hour)}. </>}
            {quietest && <>Quieter around {hourLabel(quietest.hour)}.</>}
          </p>
        </>
      )}
    </Card>
  );
}
