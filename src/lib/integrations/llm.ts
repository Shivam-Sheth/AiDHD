import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { hasGemini, hasOpenAI } from "./config";

export type LlmProvider = "gemini" | "openai" | "none";

export function activeLlmProvider(): LlmProvider {
  // Gemini preferred while OpenAI credits are pending.
  if (hasGemini()) return "gemini";
  if (hasOpenAI()) return "openai";
  return "none";
}

/**
 * Prefer Gemini. OpenAI stays wired as fallback for when credits arrive.
 */
export async function completeJson(input: {
  system: string;
  user: string;
}): Promise<{ text: string; provider: LlmProvider } | null> {
  if (hasGemini()) {
    const gemini = await completeWithGemini(input);
    if (gemini) return gemini;
  }

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
      return null;
    }
  }

  return null;
}

async function completeWithGemini(input: {
  system: string;
  user: string;
}): Promise<{ text: string; provider: "gemini" } | null> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = `${input.system}\n\n${input.user}`;

  // Newer Google GenAI SDK (preferred for AI Studio auth keys).
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
    // try legacy SDK
  }

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
    return null;
  }

  return null;
}
