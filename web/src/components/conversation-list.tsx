import Link from "next/link";
import type { ConversationSummary } from "@/lib/chat";
import { formatDateTime } from "@/lib/format";

export function ConversationList({ items, basePath, timeZone }: { items: ConversationSummary[]; basePath: string; timeZone: string }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`${basePath}?c=${c.id}`} scroll={false} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/50">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-canvas text-sm font-semibold">
              {c.otherName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate ${c.unread ? "font-semibold" : "font-medium"}`}>{c.otherName}</span>
              <span className="block truncate text-sm text-muted">{c.lastMessage ?? "No messages yet"}</span>
            </span>
            <span className="flex flex-col items-end gap-1">
              {c.lastMessageAt && <span className="text-xs text-muted">{formatDateTime(c.lastMessageAt, timeZone)}</span>}
              {c.unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold">{c.unread}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
