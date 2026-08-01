import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { hasGemini, hasOpenAI } from "./config";

export type ChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Conversational completion for the in-group Meta-AI style agent.
 * Prefers OpenAI when available (product requirement); Gemini is fallback.
 */
export async function completeChat(input: {
  messages: ChatTurn[];
  json?: boolean;
}): Promise<{ text: string; provider: "openai" | "gemini" } | null> {
  if (hasOpenAI()) {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: input.json ? { type: "json_object" } : undefined,
        temperature: 0.4,
        messages: input.messages,
      });
      const text = res.choices[0]?.message?.content;
      if (text?.trim()) return { text, provider: "openai" };
    } catch (err) {
      console.error("[chat-llm] openai failed", err);
    }
  }

  if (hasGemini()) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const system = input.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n");
      const rest = input.messages
        .filter((m) => m.role !== "system")
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: `${system}\n\n${rest}\n\nASSISTANT:`,
        config: input.json
          ? { responseMimeType: "application/json" }
          : undefined,
      });
      const text = response.text;
      if (text?.trim()) return { text, provider: "gemini" };
    } catch (err) {
      console.error("[chat-llm] gemini failed", err);
    }
  }

  return null;
}
