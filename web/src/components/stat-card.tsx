import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui";
import { CountUp } from "@/components/count-up";

// A headline number for the staff dashboard: a lime icon tile, the number
// counting up, its label, and (when it opens a page) an arrow on hover.
// `alert` turns it red, for money owed and the like.
export function StatCard({ label, value, icon: Icon, href, alert = false, hint }: { label: string; value: string; icon: LucideIcon; href?: string; alert?: boolean; hint?: string }) {
  const body = (
    <Card className="owner-tile group relative h-full overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <span className={`grid size-10 place-items-center rounded-xl ${alert ? "bg-danger/10 text-danger" : "bg-brand/90 text-ink"}`}>
          <Icon className="size-5" />
        </span>
        {href && <ArrowUpRight className="size-4 text-muted opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />}
      </div>
      <p className={`mt-4 text-[1.75rem] leading-none font-bold tracking-tight tabular-nums ${alert ? "text-danger" : ""}`}>
        <CountUp value={value} />
      </p>
      <p className="mt-1.5 text-[13px] text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted/80">{hint}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
