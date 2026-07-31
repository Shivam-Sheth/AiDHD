/**
 * Read on-screen itinerary text from reel cover frames / short video clips.
 * Many travel reels put day-by-day plans in the video overlays, not the caption.
 */

import {
  createPartFromBase64,
  createPartFromText,
  GoogleGenAI,
} from "@google/genai";
import { hasGemini } from "../integrations/config";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_IMAGE_BYTES = 4_500_000;
const MAX_VIDEO_BYTES = 12_000_000;

async function downloadBytes(
  url: string,
  maxBytes: number,
): Promise<{ base64: string; mime: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "image/*,video/*,*/*",
        Referer: "https://www.instagram.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > maxBytes) return null;
    const ct = (res.headers.get("content-type") || "").split(";")[0]!.trim();
    let mime = ct;
    if (!mime || mime === "application/octet-stream") {
      if (/\.mp4(\?|$)/i.test(url)) mime = "video/mp4";
      else if (/\.webp(\?|$)/i.test(url)) mime = "image/webp";
      else if (/\.png(\?|$)/i.test(url)) mime = "image/png";
      else mime = "image/jpeg";
    }
    return { base64: buf.toString("base64"), mime };
  } catch {
    return null;
  }
}

/**
 * OCR / describe on-screen text from reel media. Returns plain text or null.
 */
export async function extractVisualTextFromReel(input: {
  image_urls?: string[];
  video_urls?: string[];
}): Promise<string | null> {
  if (!hasGemini()) return null;

  const imageUrls = (input.image_urls || []).slice(
    0,
    // Prefer cover + video when we have mp4 (itinerary overlays live in motion)
    (input.video_urls || []).length ? 1 : 3,
  );
  const videoUrls = (input.video_urls || []).slice(0, 1);
  if (!imageUrls.length && !videoUrls.length) return null;

  const parts: ReturnType<typeof createPartFromBase64>[] = [];

  for (const url of imageUrls) {
    const file = await downloadBytes(url, MAX_IMAGE_BYTES);
    if (file) parts.push(createPartFromBase64(file.base64, file.mime));
  }

  if (videoUrls[0]) {
    const file = await downloadBytes(videoUrls[0], MAX_VIDEO_BYTES);
    if (file) parts.push(createPartFromBase64(file.base64, file.mime));
  }

  if (!parts.length) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            createPartFromText(
              `You are reading Instagram/TikTok reel MEDIA (cover image and/or video frames).
Extract ALL on-screen text useful for travel planning: day-by-day itineraries, place names, activities, times, budgets, hotel tips, day labels (Day 1 / Day 2), and any list overlays.
Ignore watermarks, usernames, like counts, and UI chrome.
If multiple frames show the same itinerary, merge into one clean list.
Return plain text only (no markdown fences). If there is no useful on-screen itinerary text, return exactly: NONE`,
            ),
            ...parts,
          ],
        },
      ],
    });
    const text = (response.text || "").trim();
    if (!text || /^NONE$/i.test(text) || text.length < 20) return null;
    return text.slice(0, 8000);
  } catch {
    return null;
  }
}
