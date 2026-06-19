import crypto from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

// Active encryption key version
export const ACTIVE_KEY_VERSION = "1";

// Registry mapping key versions to secrets
const KEY_REGISTRY: Record<string, string> = {
  "1": env.ENCRYPTION_KEY,
  // "2": env.ENCRYPTION_KEY_V2, // Add new keys here when rotating!
};

function getEncryptionKey(version: string): Buffer {
  const secret = KEY_REGISTRY[version];
  if (!secret || secret.length < KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY version "${version}" is missing or invalid. Must be at least ${KEY_BYTES} characters.`
    );
  }
  return Buffer.from(secret.substring(0, KEY_BYTES), "utf8");
}

/**
 * Encrypts a plaintext string using the current active key version of AES-256-GCM.
 * Returns both the ciphertext and the key version used.
 */
export function encryptToken(text: string): { ciphertext: string; version: string } {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(ACTIVE_KEY_VERSION), iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return {
    ciphertext: `${iv.toString("hex")}:${encrypted}:${authTag}`,
    version: ACTIVE_KEY_VERSION,
  };
}

/**
 * Decrypts a ciphertext string using the specified key version of AES-256-GCM.
 */
export function decryptToken(encryptedText: string, version: string = "1"): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format. Expected iv:ciphertext:authTag");
  }
  
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(version), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
