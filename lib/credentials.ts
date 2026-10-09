// The AES256GCM encryption for the api keys of the users.
// The keys won't be readable except from their last 4 characters.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_HEX = process.env.CREDENTIALS_KEY;

if (!KEY_HEX) {
  throw new Error("CREDENTIALS_KEY is not set. Generate one with: openssl rand -hex 32");
}
if (KEY_HEX.length !== 64) {
  throw new Error(
    "CREDENTIALS_KEY must be a 64-character hex string (32 bytes). Generate one with: openssl rand -hex 32",
  );
}

const KEY = Buffer.from(KEY_HEX, "hex");
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits, the recommended size for GCM

export type EncryptedCredential = {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
  hint: string;
};

export function encryptCredential(plaintext: string): EncryptedCredential {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv); //will set up the encryption operation
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: Uint8Array.from(ciphertext),
    iv: Uint8Array.from(iv),
    tag: Uint8Array.from(tag),
    hint: plaintext.slice(-4),
  };
}

export function decryptCredential(encrypted: {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
}): string {
  const decipher = createDecipheriv(ALGORITHM, KEY, encrypted.iv);
  decipher.setAuthTag(encrypted.tag);

  const plaintext = Buffer.concat([
    decipher.update(encrypted.ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
