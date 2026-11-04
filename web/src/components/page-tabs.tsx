import Link from "next/link";

// In-page tabs. Each tab is a ?tab= link on the same page (so the choice
// survives a refresh and the back button), never a different page.
export function PageTabs({
  tabs,
  active,
  base,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  // Path of the page, plus any query to keep (e.g. "/dashboard/programs").
  base: string;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {tabs.map((t) => {
        const on = t.id === active;
        const sep = base.includes("?") ? "&" : "?";
        return (
          <Link
            key={t.id}
            role="tab"
            aria-selected={on}
            href={`${base}${sep}tab=${t.id}`}
            scroll={false}
            replace
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap ${
              on ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`grid min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold ${on ? "bg-brand text-ink" : "bg-canvas text-ink"}`}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// Reads ?tab= against the allowed ids, falling back to the first.
export function activeTab<T extends string>(value: string | string[] | undefined, ids: readonly T[]): T {
  return (ids as readonly string[]).includes(String(value)) ? (value as T) : ids[0];
}
