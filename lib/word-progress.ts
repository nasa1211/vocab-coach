import { supabaseAdmin } from "@/lib/supabase";
import {
  applyAnswer,
  applyOpened,
  isDue,
  normalizeProgressWord,
  type ProgressRow,
} from "@/lib/srs";

// Every function degrades gracefully: if the word_progress table is missing (or any
// query fails), it behaves as if SRS did not exist.

async function readRow(userKey: string, word: string): Promise<ProgressRow | null> {
  const { data, error } = await supabaseAdmin
    .from("word_progress")
    .select("*")
    .eq("user_key", userKey)
    .eq("word", word)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProgressRow | null) ?? null;
}

async function writeRow(row: ProgressRow) {
  const { error } = await supabaseAdmin
    .from("word_progress")
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "user_key,word" });
  if (error) throw new Error(error.message);
}

export async function recordOpened(userKey: string, rawWord: string, now = new Date()) {
  try {
    const word = normalizeProgressWord(rawWord);
    if (!word) return;
    await writeRow(applyOpened(await readRow(userKey, word), { user_key: userKey, word }, now));
  } catch {
    /* table missing or unavailable */
  }
}

export async function recordAnswer(
  userKey: string,
  rawWord: string,
  correct: boolean,
  options: { onlyIfDue?: boolean; now?: Date } = {},
): Promise<boolean> {
  try {
    const now = options.now ?? new Date();
    const word = normalizeProgressWord(rawWord);
    if (!word) return false;
    const previous = await readRow(userKey, word);
    if (options.onlyIfDue && (!previous || !isDue(previous, now))) return false;
    await writeRow(applyAnswer(previous, { user_key: userKey, word }, correct, now));
    return true;
  } catch {
    return false;
  }
}

export async function getDueWords(userKey: string, limit: number, now = new Date()): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("word_progress")
      .select("word")
      .eq("user_key", userKey)
      .lte("next_due_at", now.toISOString())
      .order("next_due_at", { ascending: true })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map((item: { word: string }) => item.word);
  } catch {
    return [];
  }
}

export async function isWordDue(userKey: string, rawWord: string, now = new Date()) {
  try {
    const row = await readRow(userKey, normalizeProgressWord(rawWord));
    return Boolean(row && isDue(row, now));
  } catch {
    return false;
  }
}

export async function listProgress(limit = 200): Promise<ProgressRow[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("word_progress")
      .select("*")
      .order("last_seen_at", { ascending: true })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data as ProgressRow[];
  } catch {
    return [];
  }
}
