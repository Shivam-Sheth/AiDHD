/** Linear canned agent script, replayed independently per invitee. */
export const CHAT_SCRIPT = [
  "Hey! Quick one — what's your budget cap for this?",
  "Got it. Any preferences? (vibe, must-haves, dealbreakers)",
  "Perfect, you're locked in. I'll ping you when the group's plan is ready.",
] as const;

export function extractBudget(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Math.round(parseFloat(match[0])) : null;
}

const TAG_KEYWORDS: [RegExp, string][] = [
  [/beach/i, "beachfront"],
  [/quiet|chill|relax|low.?key/i, "low-key"],
  [/veg(etarian|an)/i, "vegetarian"],
  [/flex/i, "flexible dates"],
  [/party|wild|loud/i, "party mode"],
  [/budget|cheap|save/i, "budget-conscious"],
  [/luxury|splurge|nice|treat/i, "treat yourself"],
  [/walk/i, "minimal walking"],
];

export function deriveTag(text: string): string {
  for (const [re, tag] of TAG_KEYWORDS) {
    if (re.test(text)) return tag;
  }
  return "flexible";
}
