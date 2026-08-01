"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useEvents } from "@/lib/mock/EventContext";
import { EventNotFound } from "@/components/flow/EventNotFound";
import { CollectSidebar } from "@/components/flow/steps/CollectSidebar";
import { CollectMobileTabs } from "@/components/flow/steps/CollectMobileTabs";
import { CollectChatPanel } from "@/components/flow/steps/CollectChatPanel";

export default function CollectPage() {
  const { slug } = useParams<{ slug: string }>();
  const { getEvent, sendMessage } = useEvents();
  const event = getEvent(slug);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!event) return <EventNotFound />;

  const activeId = selectedId ?? event.invitees[0]?.id;
  const invitee = event.invitees.find((i) => i.id === activeId);

  return (
    <div>
      <div className="sm:hidden">
        <CollectMobileTabs
          invitees={event.invitees}
          selectedId={activeId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="flex gap-6">
        <div className="hidden sm:block">
          <CollectSidebar invitees={event.invitees} selectedId={activeId} onSelect={setSelectedId} />
        </div>
        <div className="min-w-0 flex-1">
          {invitee && (
            <CollectChatPanel
              key={invitee.id}
              invitee={invitee}
              onSend={(text) => sendMessage(slug, invitee.id, text)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
