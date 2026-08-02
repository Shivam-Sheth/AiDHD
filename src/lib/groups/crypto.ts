/**
 * Group chat encryption — AES-256-GCM per message.
 *
 * Model: AiDHD is a group participant (like Meta AI). The server holds a
 * per-group key wrapped by AIDHD_VAULT_KEY so the bot can read context when
 * tagged. This is encrypted-at-rest + bot-visible, not peer-only E2E that
 * would make the agent blind.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { vaultConfigured } from "@/lib/vault/pii";

function masterKey(): Buffer | null {
  const raw = process.env.AIDHD_VAULT_KEY || "";
  if (!raw || raw.length < 16) return null;
  return createHash("sha256").update(`aidhd-chat:${raw}`).digest();
}

export function chatCryptoConfigured(): boolean {
  return vaultConfigured() && Boolean(masterKey());
}

/** Fresh random group key, wrapped for DB storage. */
export function mintGroupChatKey(): { raw: Buffer; wrapped: string } {
  const raw = randomBytes(32);
  const master = masterKey();
  if (!master) {
    // Dev fallback: store key itself (still base64). Prod should set AIDHD_VAULT_KEY.
    return { raw, wrapped: raw.toString("base64url") };
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", master, iv);
  const enc = Buffer.concat([cipher.update(raw), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    raw,
    wrapped: Buffer.concat([iv, tag, enc]).toString("base64url"),
  };
}

export function unwrapGroupChatKey(wrapped: string): Buffer | null {
  const master = masterKey();
  if (!master) {
    try {
      return Buffer.from(wrapped, "base64url");
    } catch {
      return null;
    }
  }
  try {
    const buf = Buffer.from(wrapped, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", master, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch {
    return null;
  }
}

export function encryptMessageBody(groupKey: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", groupKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptMessageBody(
  groupKey: Buffer,
  ciphertext: string,
): string | null {
  try {
    const buf = Buffer.from(ciphertext, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", groupKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}
