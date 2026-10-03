/** datamuse, the word list behind wordle and spelling bee, keyless. it knows how common each word
 * is (occurrences per million), which is how an answer stays a word people actually know */

import { z } from "zod";

import { getJson, ttlCache } from "../http";

const URL_BASE = "https://api.datamuse.com/words";

const Words = z.array(z.object({ word: z.string(), tags: z.array(z.string()).optional() }));

const frequency = (tags?: string[]) => Number(tags?.find((t) => t.startsWith("f:"))?.slice(2) ?? 0);

// plain lowercase letters only: no "u.s.", no "o'er", no proper nouns
const plain = (w: string) => /^[a-z]+$/.test(w);

const listCache = ttlCache<{ word: string; freq: number }[]>(24 * 60 * 60_000);

/** up to 1000 words of exactly `length` letters, most common first */
export async function wordsOfLength(length: number, signal: AbortSignal) {
  const key = String(length);
  const hit = listCache.get(key);
  if (hit) return hit;
  const url = new URL(URL_BASE);
  url.searchParams.set("sp", "?".repeat(length));
  url.searchParams.set("md", "f");
  url.searchParams.set("max", "1000");
  const rows = Words.parse(await getJson(url, { signal, what: "datamuse" }));
  const words = rows
    .filter((r) => plain(r.word) && r.word.length === length)
    .map((r) => ({ word: r.word, freq: frequency(r.tags) }));
  listCache.set(key, words);
  return words;
}

const wordCache = ttlCache<number>(24 * 60 * 60_000, 5000);

/** how common `word` is, 0 when datamuse doesnt know it. datamuse matches loosely ("zzzzz" comes
 * back as "zzzz"), so only an exact match counts */
export async function wordFrequency(word: string, signal: AbortSignal) {
  const hit = wordCache.get(word);
  if (hit !== undefined) return hit;
  const url = new URL(URL_BASE);
  url.searchParams.set("sp", word);
  url.searchParams.set("md", "f");
  url.searchParams.set("max", "1");
  const rows = Words.parse(await getJson(url, { signal, what: "datamuse" }));
  const exact = rows.find((r) => r.word === word);
  const freq = exact ? frequency(exact.tags) : 0;
  wordCache.set(word, freq);
  return freq;
}
