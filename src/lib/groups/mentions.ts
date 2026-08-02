import { AIDHD_BOT_ID } from "./types";

const MENTION_RE =
  /(?:^|[\s([{])@(?:aidhd|ai[\s_-]?dhd|ai|bot|concierge)\b/i;

/** True when the message tags AiDHD (Meta-AI style) or is a slash command. */
export function mentionsAidhd(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (MENTION_RE.test(` ${t}`)) return true;
  if (/^(?:\/aidhd|hey aidhd|oi aidhd)\b/i.test(t)) return true;
  return false;
}

export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  if (mentionsAidhd(text)) found.add(AIDHD_BOT_ID);
  const named = text.matchAll(/@([a-zA-Z][\w.-]{1,32})/g);
  for (const m of named) {
    const handle = m[1]!.toLowerCase();
    if (["aidhd", "ai", "bot", "concierge"].includes(handle)) {
      found.add(AIDHD_BOT_ID);
    } else {
      found.add(handle);
    }
  }
  return [...found];
}

/** Strip @mention tokens so the agent sees the question cleanly. */
export function stripMentions(text: string): string {
  return text
    .replace(/@(?:aidhd|ai[\s_-]?dhd|ai|bot|concierge)\b/gi, "")
    .replace(/^\s*\/aidhd\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
