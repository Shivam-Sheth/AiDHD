import type { DemoUser, ResponseData } from "@/lib/types-client";

const CHANNEL_LABEL: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  imessage: "iMessage",
};

export function GroupResponseCard({ response, user }: { response: ResponseData; user?: DemoUser }) {
  return (
    <div className="rounded-xl border border-line bg-canvas px-3.5 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-ink">{user?.name ?? "Friend"}</span>
        <span className="text-sm font-semibold text-ink">${response.budget_cap}</span>
      </div>
      <p className="mt-0.5 text-[10px] font-semibold tracking-wide text-faint uppercase">
        via {CHANNEL_LABEL[response.channel] ?? response.channel}
      </p>
      <p className="mt-1.5 line-clamp-2 text-xs text-muted">{response.preferences.free_text}</p>
    </div>
  );
}
