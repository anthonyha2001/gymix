import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConversationList } from "@/components/conversation-list";
import { Card, SectionTitle, Skeleton } from "@/components/ui";
import { loadConversations } from "@/lib/chat";
import { requirePortalPage } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { openChatAsMember } from "@/app/chat-actions";
import { ActionButton } from "../../dashboard/members/action-button";
import { ChatModal } from "@/components/chat-modal";

export const metadata: Metadata = { title: "Messages" };

export default function MemberMessagesPage({ searchParams }: PageProps<"/portal/messages">) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Inbox({ searchParams }: { searchParams: PageProps<"/portal/messages">["searchParams"] }) {
  const { c } = await searchParams;
  const { viewer, membership } = await requirePortalPage("messages");
  const supabase = await createClient();
  const [items, { data: coaches }] = await Promise.all([
    loadConversations(supabase, viewer.id, "member", membership.gymId),
    supabase.rpc("gym_coaches", { p_gym_id: membership.gymId }),
  ]);
  const talkingTo = new Set(items.map((i) => i.otherName));

  return (
    <>
      <AutoRefresh seconds={10} />
      {typeof c === "string" && <ChatModal conversationId={c} viewerId={viewer.id} timeZone={membership.timezone} as="member" />}
      {items.length > 0 && (
        <Card className="overflow-hidden">
          <ConversationList items={items} basePath="/portal/messages" timeZone={membership.timezone} />
        </Card>
      )}
      <Card>
        <SectionTitle>Message a trainer</SectionTitle>
        {!coaches?.length ? (
          <p className="border-t border-line px-5 py-4 text-sm text-muted">No trainers yet.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {coaches.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="font-medium">{c.full_name || "Trainer"}</span>
                <ActionButton
                  action={openChatAsMember.bind(null, c.id)}
                  label={talkingTo.has(c.full_name) ? "Open chat" : "Message"}
                  variant="secondary"
                  className="h-8 px-3"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
