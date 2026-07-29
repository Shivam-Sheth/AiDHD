const IG_REEL =
  /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;
const IG_SHARE =
  /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i;
const TT =
  /https?:\/\/(?:www\.)?(?:tiktok\.com)\/@[^/\s]+\/video\/(\d+)/i;
const TT_SHORT = /https?:\/\/(?:vm|vt)\.tiktok\.com\/[A-Za-z0-9]+/i;

export function extractReelUrl(text: string): string | null {
  const m =
    text.match(IG_REEL)?.[0] ||
    text.match(IG_SHARE)?.[0] ||
    text.match(TT)?.[0] ||
    text.match(TT_SHORT)?.[0];
  return m ?? null;
}

export function isReelMessage(text: string): boolean {
  if (extractReelUrl(text)) return true;
  return /^(reel|reels)\b/i.test(text.trim());
}

export function reelSourceFromUrl(url: string): "instagram" | "tiktok" | "other" {
  if (/instagram|instagr\.am/i.test(url)) return "instagram";
  if (/tiktok/i.test(url)) return "tiktok";
  return "other";
}
