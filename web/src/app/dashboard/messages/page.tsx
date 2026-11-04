import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConversationList } from "@/components/conversation-list";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { loadConversations } from "@/lib/chat";
import { requireStaff } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ChatModal } from "@/components/chat-modal";

export const metadata: Metadata = { title: "Messages" };

export default function StaffMessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Messages"
        description="Your conversations with members. Private to you and the member. Start one from a member's page."
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/dashboard/messages">["searchParams"] }) {
  const { c } = await searchParams;
  const { viewer, membership } = await requireStaff();
  const supabase = await createClient();
  const items = await loadConversations(supabase, viewer.id, "staff", membership.gymId);
  return (
    <Card className="overflow-hidden">
      <AutoRefresh seconds={10} />
      {typeof c === "string" && <ChatModal conversationId={c} viewerId={viewer.id} timeZone={membership.timezone} as="staff" />}
      {!items.length ? (
        <p className="p-5 text-sm text-muted">No conversations yet. Members can message you from their portal.</p>
      ) : (
        <ConversationList items={items} basePath="/dashboard/messages" timeZone={membership.timezone} />
      )}
    </Card>
  );
}
