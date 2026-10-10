/** encryption for the api keys users paste (#17): AES-256-GCM w/ node:crypto. the master key comes
 * from CREDENTIALS_KEY (32 random bytes, base64), a fresh iv for every encryption, and the auth tag
 * makes any change to the stored bytes fail on decrypt instead of giving garbage back. the row's
 * user and service go in as additional data, so a ciphertext copied onto another row wont open */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
// 12 bytes is the size gcm is designed for
const IV_BYTES = 12;

// plain Uint8Arrays, the type prisma reads and writes for a Bytes column
export type Sealed = {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  tag: Uint8Array<ArrayBuffer>;
};

/** the master key, checked: 32 bytes once decoded, anything else is a misconfigured server */
export function credentialsKey(raw = process.env.CREDENTIALS_KEY): Buffer {
  if (!raw)
    throw new Error("CREDENTIALS_KEY is not set, generate one w/ `openssl rand -base64 32`.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_KEY must be 32 bytes in base64, `openssl rand -base64 32`.");
  }
  return key;
}

export function seal(plain: string, context: string, key = credentialsKey()): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext: bytes(ciphertext), iv: bytes(iv), tag: bytes(cipher.getAuthTag()) };
}

/** throws if the bytes, the context or the key arent the ones it was sealed w/ */
export function open(sealed: Sealed, context: string, key = credentialsKey()): string {
  const decipher = createDecipheriv(ALGO, key, sealed.iv);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(sealed.tag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
}

const bytes = (b: Buffer) => new Uint8Array(b);

/** the only part of a key the api ever sends back */
export const hintOf = (key: string) => key.slice(-4);
