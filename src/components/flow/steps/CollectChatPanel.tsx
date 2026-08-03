"use client";

import { useEffect, useRef, useState } from "react";
import type { MockInvitee } from "@/lib/mock/types";
import { CollectChatBubble } from "./CollectChatBubble";

export function CollectChatPanel({
  invitee,
  onSend,
}: {
  invitee: MockInvitee;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [invitee.messages.length, invitee.agentTyping]);

  function submit() {
    const text = draft.trim();
    if (!text || invitee.agentTyping) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="flex h-[26rem] flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {invitee.messages.map((m) => (
          <CollectChatBubble key={m.id} message={m} />
        ))}
        {invitee.agentTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-line/40 px-4 py-2.5 text-sm text-faint">···</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={invitee.agentTyping}
          placeholder="Type a reply…"
          aria-label={`Reply as ${invitee.name}`}
          className="focus-ring flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink transition focus:border-ink disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || invitee.agentTyping}
          className="shrink-0 rounded-lg bg-ink px-5 py-2.5 text-sm font-bold text-inverse transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
