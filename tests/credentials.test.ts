/** #17: the encryption behind the users' own api keys. pure node:crypto, no db needed */

import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { credentialsKey, hintOf, open, seal } from "@/server/credentials";

const key = randomBytes(32);
const context = "user-1:market";
const secret = "pk_live_1234567890abcdef";

describe("credential encryption", () => {
  it("opens what it sealed", () => {
    expect(open(seal(secret, context, key), context, key)).toBe(secret);
  });

  it("never stores the key in clear", () => {
    const sealed = seal(secret, context, key);
    expect(Buffer.from(sealed.ciphertext).toString("utf8")).not.toContain(secret);
  });

  it("uses a fresh iv every call, so the same key never encrypts the same way twice", () => {
    const a = seal(secret, context, key);
    const b = seal(secret, context, key);
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it("throws on a tampered ciphertext", () => {
    const sealed = seal(secret, context, key);
    sealed.ciphertext[0] ^= 0xff;
    expect(() => open(sealed, context, key)).toThrow();
  });

  it("throws on a tampered auth tag", () => {
    const sealed = seal(secret, context, key);
    sealed.tag[0] ^= 0xff;
    expect(() => open(sealed, context, key)).toThrow();
  });

  it("throws w/ the wrong master key", () => {
    const sealed = seal(secret, context, key);
    expect(() => open(sealed, context, randomBytes(32))).toThrow();
  });

  it("throws when the row is copied onto another user or service", () => {
    const sealed = seal(secret, context, key);
    expect(() => open(sealed, "user-2:market", key)).toThrow();
    expect(() => open(sealed, "user-1:other", key)).toThrow();
  });

  it("only ever gives back the last 4 characters as a hint", () => {
    expect(hintOf(secret)).toBe("cdef");
  });
});

describe("CREDENTIALS_KEY validation at boot", () => {
  it("accepts 32 bytes in base64", () => {
    expect(credentialsKey(randomBytes(32).toString("base64"))).toHaveLength(32);
  });

  it("refuses a missing key", () => {
    expect(() => credentialsKey("")).toThrow(/not set/);
    expect(() => credentialsKey(undefined)).toThrow(/not set/);
  });

  it("refuses a key of the wrong size, like the output of openssl rand -hex 32", () => {
    expect(() => credentialsKey(randomBytes(32).toString("hex"))).toThrow(/32 bytes/);
    expect(() => credentialsKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});
