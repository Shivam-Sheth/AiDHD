import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { hasGemini, hasOpenAI } from "./config";

export type LlmProvider = "gemini" | "openai" | "none";

export function activeLlmProvider(): LlmProvider {
  // OpenAI preferred when credits are configured; Gemini remains fallback.
  if (hasOpenAI()) return "openai";
  if (hasGemini()) return "gemini";
  return "none";
}

/**
 * Prefer Gemini. OpenAI stays wired as fallback for when credits arrive.
 */
/** Plain-text completion — prefers OpenAI when set (group chat credits), else Gemini. */
export async function completeText(input: {
  system: string;
  user: string;
}): Promise<{ text: string; provider: LlmProvider } | null> {
  if (hasOpenAI()) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        temperature: 0.4,
      });
      const text = res.choices[0]?.message?.content;
      if (text?.trim()) return { text, provider: "openai" };
    } catch {
      // fall through
    }
  }

  if (hasGemini()) {
    const apiKey = process.env.GEMINI_API_KEY!;
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: `${input.system}\n\n${input.user}`,
      });
      const text = response.text;
      if (text?.trim()) return { text, provider: "gemini" };
    } catch {
      // none
    }
  }

  return null;
}

export async function completeJson(input: {
  system: string;
  user: string;
}): Promise<{ text: string; provider: LlmProvider } | null> {
  if (hasOpenAI()) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      });
      const text = res.choices[0]?.message?.content;
      if (text?.trim()) return { text, provider: "openai" };
    } catch {
      // fall through to Gemini
    }
  }

  if (hasGemini()) {
    const gemini = await completeWithGemini(input);
    if (gemini) return gemini;
  }

  return null;
}

async function completeWithGemini(input: {
  system: string;
  user: string;
}): Promise<{ text: string; provider: "gemini" } | null> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const preferred = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const models = [
    preferred,
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-flash-latest",
  ].filter((m, i, arr) => arr.indexOf(m) === i);
  const prompt = `${input.system}\n\n${input.user}`;

  // Newer Google GenAI SDK (preferred for AI Studio auth keys).
  for (const model of models) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      const text = response.text;
      if (text?.trim()) return { text, provider: "gemini" };
    } catch {
      // try next model / SDK
    }
  }

  for (const model of models) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const legacy = genAI.getGenerativeModel({
        model,
        generationConfig: { responseMimeType: "application/json" },
      });
      const result = await legacy.generateContent(prompt);
      const text = result.response.text();
      if (text?.trim()) return { text, provider: "gemini" };
    } catch {
      // try next
    }
  }

  return null;
}
