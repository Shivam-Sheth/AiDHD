/**
 * PII vault — encrypt at rest; agent tools only ever see vault refs.
 * Passport plaintext never enters ElevenLabs / Gemini tool payloads.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyBytes(): Buffer | null {
  const raw = process.env.AIDHD_VAULT_KEY || "";
  if (!raw || raw.length < 16) return null;
  return createHash("sha256").update(raw).digest();
}

export function vaultConfigured(): boolean {
  return Boolean(keyBytes());
}

export function encryptSecret(plaintext: string): string | null {
  const key = keyBytes();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptSecret(ciphertext: string): string | null {
  const key = keyBytes();
  if (!key) return null;
  try {
    const buf = Buffer.from(ciphertext, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

/** What tools/LLM may see — never the secret itself. */
export type VaultRef = {
  kind: "passport" | "legal_name";
  user_id: string;
  present: boolean;
  hint?: string; // e.g. last 4 of passport if we ever store one — prefer none
};

export function passportVaultRef(
  user_id: string,
  hasCiphertext: boolean,
): VaultRef {
  return {
    kind: "passport",
    user_id,
    present: hasCiphertext,
  };
}
