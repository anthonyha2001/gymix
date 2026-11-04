import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { ChatThread } from "@/components/chat-thread";
import { RouteModal } from "@/components/route-modal";
import { loadThread } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";

// A conversation, opened as a dialog (?c=<id>) over the page the person is on.
export async function ChatModal({
  conversationId,
  viewerId,
  timeZone,
  as,
}: {
  conversationId: string;
  viewerId: string;
  timeZone: string;
  as: "staff" | "member";
}) {
  const supabase = await createClient();
  const thread = await loadThread(supabase, conversationId);
  if (!thread) return null;
  const name = as === "staff" ? (thread.conv.members?.full_name ?? "Member") : thread.staffName || "Trainer";

  return (
    <RouteModal param="c" title={name} size="lg">
      <AutoRefresh seconds={5} />
      {as === "staff" && (
        <Link href={`/dashboard/members/${thread.conv.member_id}`} className="mb-3 inline-block text-sm underline underline-offset-4">
          Member profile
        </Link>
      )}
      <ChatThread conversationId={conversationId} messages={thread.messages} meId={viewerId} otherName={name} timeZone={timeZone} />
    </RouteModal>
  );
}
