import clsx from "clsx";
import type { ChatMessage } from "@/lib/mock/types";

export function CollectChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-ink text-inverse" : "bg-subtle text-ink",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
