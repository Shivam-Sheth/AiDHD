/**
 * Best-effort public metadata for a reel URL (caption / title).
 * Instagram often blocks scraping; oEmbed / OpenGraph are best-effort.
 * Callers should accept partial caption and still run Gemini decode.
 */
export async function fetchReelCaption(url: string): Promise<{
  caption: string;
  title?: string;
  author?: string;
}> {
  // Instagram oEmbed (may require app token in production; try public first)
  if (/instagram\.com|instagr\.am/i.test(url)) {
    try {
      const oembed = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembed, {
        headers: { "User-Agent": "AiDHD/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          title?: string;
          author_name?: string;
        };
        if (data.title?.trim()) {
          return {
            caption: data.title.trim(),
            title: data.title.trim(),
            author: data.author_name,
          };
        }
      }
    } catch {
      /* ignore */
    }
  }

  // Generic Open Graph scrape
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AiDHDBot/1.0; +https://aidhd-omega.vercel.app)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      const og =
        html.match(
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        )?.[1] ||
        html.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        )?.[1];
      const title =
        html.match(
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        )?.[1] ||
        html.match(/<title>([^<]+)<\/title>/i)?.[1];
      if (og || title) {
        return {
          caption: decodeHtml(og || title || ""),
          title: title ? decodeHtml(title) : undefined,
        };
      }
    }
  } catch {
    /* ignore */
  }

  return { caption: "" };
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
