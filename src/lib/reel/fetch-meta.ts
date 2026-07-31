/**
 * Auto-fetch reel caption/description from a link alone.
 * Strategies: Meta oEmbed → imginn mirror → TikTok oEmbed → Gemini Search/URL tools.
 */

import { GoogleGenAI } from "@google/genai";
import { hasGemini } from "../integrations/config";

export type ReelMeta = {
  caption: string;
  title?: string;
  author?: string;
  source: string;
  /** Cover / frame images for vision OCR */
  image_urls?: string[];
  /** Direct mp4 if available */
  video_urls?: string[];
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\\n/g, "\n")
    .replace(/\\u0026/g, "&")
    .trim();
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractMediaFromHtml(html: string): {
  image_urls: string[];
  video_urls: string[];
} {
  const images = new Set<string>();
  const videos = new Set<string>();

  const ogImage =
    html.match(
      /property=["']og:image["']\s+content=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /content=["']([^"']+)["']\s+property=["']og:image["']/i,
    )?.[1];
  if (ogImage) images.add(decodeHtml(ogImage));

  for (const m of html.matchAll(
    /https?:\/\/(?:s\d+\.imginn\.com|scontent[^"'>\s]+cdninstagram\.com)\/[^"'>\s]+/gi,
  )) {
    const u = decodeHtml(m[0].replace(/&amp;/g, "&"));
    if (/\.mp4(\?|$)/i.test(u) || /\/v\/t\d+\/.*\.mp4/i.test(u)) {
      videos.add(u);
    } else if (
      /\.(jpe?g|png|webp)(\?|$)/i.test(u) ||
      /stp=dst-jpg/i.test(u)
    ) {
      // Prefer larger frames; skip tiny profile thumbs
      if (!/s150x150|s320x320|profile/i.test(u)) images.add(u);
    }
  }

  for (const m of html.matchAll(/https?:\/\/[^"'>\s]+\.mp4[^"'>\s]*/gi)) {
    videos.add(decodeHtml(m[0].replace(/&amp;/g, "&")));
  }

  return {
    image_urls: [...images].slice(0, 6),
    video_urls: [...videos].slice(0, 2),
  };
}

/** Fetch imginn HTML once for media assets (images/video). */
export async function fetchReelMedia(url: string): Promise<{
  image_urls: string[];
  video_urls: string[];
}> {
  const code = extractShortcode(url);
  if (!code) return { image_urls: [], video_urls: [] };
  for (const path of [`reel/${code}`, `p/${code}`]) {
    try {
      const html = await fetchText(`https://imginn.com/${path}/`);
      const media = extractMediaFromHtml(html);
      if (media.image_urls.length || media.video_urls.length) return media;
    } catch {
      /* try next */
    }
  }
  return { image_urls: [], video_urls: [] };
}

export function extractShortcode(url: string): string | null {
  const m =
    url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i) ||
    url.match(/instagr\.am\/(?:p|reel)\/([A-Za-z0-9_-]+)/i);
  return m?.[1] ?? null;
}

function normalizeInstagramUrl(url: string): string {
  const code = extractShortcode(url);
  if (!code) return url.split("?")[0]!;
  const isReel = /\/reel|\/reels\//i.test(url);
  return isReel
    ? `https://www.instagram.com/reel/${code}/`
    : `https://www.instagram.com/p/${code}/`;
}

async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/json,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function metaFromHtml(html: string): Partial<ReelMeta> {
  const ogDesc =
    html.match(
      /property=["']og:description["']\s+content=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /content=["']([^"']+)["']\s+property=["']og:description["']/i,
    )?.[1] ||
    html.match(/name=["']description["']\s+content=["']([^"']+)["']/i)?.[1];
  const ogTitle =
    html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:title["']/i)?.[1];
  const captionJson = html.match(
    /"caption"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/,
  )?.[1];
  const caption =
    (captionJson ? decodeHtml(captionJson) : "") ||
    (ogDesc ? decodeHtml(ogDesc) : "");
  return {
    caption,
    title: ogTitle ? decodeHtml(ogTitle) : undefined,
  };
}

/** Meta Graph Instagram oEmbed (tokenless for public media). */
async function fromMetaOEmbed(url: string): Promise<ReelMeta | null> {
  try {
    const endpoint = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(url)}&omitscript=true`;
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      html?: string;
      error?: unknown;
    };
    if (data.error) return null;
    const fromHtml = data.html ? stripTags(data.html) : "";
    // Skeleton embeds are mostly CSS placeholders — ignore short garbage
    const caption =
      (data.title && data.title.trim()) ||
      (fromHtml.length > 80 && !/padding:19%/.test(data.html || "")
        ? fromHtml
        : "");
    if (!caption && !data.author_name) return null;
    if (!caption) return null;
    return {
      caption,
      title: data.title,
      author: data.author_name,
      source: "meta_oembed",
    };
  } catch {
    return null;
  }
}

/** imginn mirror — prefer full caption from share intents; OG is often truncated. */
async function fromImginn(shortcode: string): Promise<ReelMeta | null> {
  for (const path of [`reel/${shortcode}`, `p/${shortcode}`]) {
    try {
      const html = await fetchText(`https://imginn.com/${path}/`);
      const shareCaptions: string[] = [];
      const weakCaptions: string[] = [];

      // Full caption lives in x.com/share?text=… (href may contain newlines)
      for (const m of html.matchAll(
        /href=["']((?:https?:)?\/\/(?:twitter|x)\.com\/share\?[^"']+)["']/gi,
      )) {
        try {
          const href = decodeHtml(m[1]).replace(/&amp;/g, "&");
          const qIndex = href.indexOf("?");
          const qs = qIndex >= 0 ? href.slice(qIndex + 1) : "";
          // Manual parse: text= may include & as &#38; / literal &
          const textMatch = /(?:^|&)text=([\s\S]*?)(?:&(?:url|via|related|hashtags)=|$)/i.exec(
            qs.replace(/&#38;/g, "&"),
          );
          let text = textMatch?.[1];
          if (!text && qs.includes("text=")) {
            text = qs.slice(qs.indexOf("text=") + 5);
          }
          if (text?.trim()) {
            shareCaptions.push(
              decodeHtml(decodeURIComponent(text.replace(/\+/g, " ").trim())),
            );
          }
        } catch {
          /* ignore */
        }
      }
      for (const m of html.matchAll(
        /href=["']((?:https?:)?\/\/social-plugins\.line\.me\/lineit\/share\?[^"']+)["']/gi,
      )) {
        try {
          const href = decodeHtml(m[1]).replace(/&amp;/g, "&");
          const textMatch = /(?:^|&)text=([\s\S]*?)(?:&(?:url|via)=|$)/i.exec(href);
          const text = textMatch?.[1];
          if (text?.trim()) {
            shareCaptions.push(
              decodeHtml(decodeURIComponent(text.replace(/\+/g, " ").trim())),
            );
          }
        } catch {
          /* ignore */
        }
      }

      const meta = metaFromHtml(html);
      if (meta.caption) weakCaptions.push(meta.caption);

      const isJunk = (t: string) =>
        /@font-face|font-family:|unicode-range:|cf-fonts|imginn|instagram post download|function\s*\(|^\s*\{/.test(
          t,
        );

      // Prefer share captions (full), else longest non-junk weak caption
      const bestShare = shareCaptions
        .filter((c) => c.length > 40 && !isJunk(c))
        .sort((a, b) => b.length - a.length)[0];
      const bestWeak = weakCaptions
        .filter((c) => c.length > 12 && !isJunk(c))
        .sort((a, b) => b.length - a.length)[0];
      const best = bestShare || bestWeak;

      if (best) {
        const authorMatch = /^(@?[\w.]+)\s*:/.exec(best);
        const author =
          authorMatch?.[1] || meta.title?.match(/@([\w.]+)/)?.[1];
        const media = extractMediaFromHtml(html);
        return {
          caption: best.replace(/^@?[\w.]+\s*:\s*/, ""),
          title: meta.title,
          author: author?.replace(/^@/, ""),
          source: "imginn",
          image_urls: media.image_urls,
          video_urls: media.video_urls,
        };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fromTikTokOEmbed(url: string): Promise<ReelMeta | null> {
  if (!/tiktok\.com/i.test(url)) return null;
  try {
    const res = await fetch(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      author_unique_id?: string;
    };
    if (!data.title?.trim()) return null;
    return {
      caption: data.title.trim(),
      author: data.author_name || data.author_unique_id,
      source: "tiktok_oembed",
    };
  } catch {
    return null;
  }
}

async function fromDirectOg(url: string): Promise<ReelMeta | null> {
  try {
    const html = await fetchText(url);
    const meta = metaFromHtml(html);
    if (meta.caption && meta.caption.length > 20 && meta.caption !== "Instagram") {
      return { caption: meta.caption, title: meta.title, source: "og_scrape" };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Last resort: Gemini Search / URL context (no JSON mime — tools require plain text). */
async function fromGeminiTools(url: string): Promise<ReelMeta | null> {
  if (!hasGemini()) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    // Prefer reading the imginn mirror via urlContext when we have a shortcode
    const code = extractShortcode(url);
    const mirrors = code
      ? [
          `https://imginn.com/reel/${code}/`,
          `https://imginn.com/p/${code}/`,
          url,
        ]
      : [url];

    const response = await ai.models.generateContent({
      model,
      contents: `Open these URLs (try each) and extract the FULL Instagram/TikTok caption or post description text. Use Google Search if needed for this exact post URL.
Return ONLY JSON (no markdown): {"caption":"...","author":"...","ok":true}
URLs:
${mirrors.map((u) => `- ${u}`).join("\n")}`,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
      },
    });
    const text = response.text?.trim() || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      caption?: string;
      author?: string;
      ok?: boolean;
    };
    if (!parsed.ok || !parsed.caption || parsed.caption.length < 12) return null;
    return {
      caption: parsed.caption,
      author: parsed.author,
      source: "gemini_tools",
    };
  } catch {
    return null;
  }
}

/**
 * Resolve caption for a reel/post URL. Throws if nothing usable found.
 */
export async function fetchReelCaption(url: string): Promise<ReelMeta> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { caption: "", source: "none" };
  }

  const isIg = /instagram\.com|instagr\.am/i.test(trimmed);
  const isTt = /tiktok\.com/i.test(trimmed);
  const igUrl = isIg ? normalizeInstagramUrl(trimmed) : trimmed;
  const shortcode = extractShortcode(trimmed);

  const attempts: Array<Promise<ReelMeta | null>> = [];
  if (isIg) {
    attempts.push(fromMetaOEmbed(igUrl));
    if (shortcode) attempts.push(fromImginn(shortcode));
    attempts.push(fromDirectOg(igUrl));
  }
  if (isTt) {
    attempts.push(fromTikTokOEmbed(trimmed));
    attempts.push(fromDirectOg(trimmed));
  }
  if (!isIg && !isTt) {
    attempts.push(fromDirectOg(trimmed));
  }

  // Prefer the longest usable caption across strategies
  const primary = (await Promise.all(attempts)).filter(
    (r): r is ReelMeta => Boolean(r && r.caption && r.caption.length > 12),
  );
  primary.sort((a, b) => b.caption.length - a.caption.length);

  let best: ReelMeta | null =
    primary[0] && primary[0].caption.length >= 80 ? primary[0] : null;

  if (!best) {
    // Gemini last (slower) — may recover more than truncated OG
    const gem = await fromGeminiTools(igUrl);
    const pool = [...primary, ...(gem ? [gem] : [])].sort(
      (a, b) => b.caption.length - a.caption.length,
    );
    best = pool[0] ?? null;
  }

  if (!best) {
    // Still try media so vision OCR can recover itinerary-only reels
    try {
      const media = isIg ? await fetchReelMedia(trimmed) : null;
      return {
        caption: "",
        source: "none",
        image_urls: media?.image_urls,
        video_urls: media?.video_urls,
      };
    } catch {
      return { caption: "", source: "none" };
    }
  }

  // Always try to attach cover/frames/video for vision OCR
  if (
    isIg &&
    !(best.image_urls?.length || best.video_urls?.length)
  ) {
    try {
      const media = await fetchReelMedia(trimmed);
      best = {
        ...best,
        image_urls: media.image_urls,
        video_urls: media.video_urls,
      };
    } catch {
      /* vision is best-effort */
    }
  }

  return best;
}
