import { supabaseAdmin } from "@/lib/supabase";
import { fillKoreanPronunciations, generateStudyWords } from "@/lib/generate-study-words";
import { buildFallbackWords } from "@/lib/fallback-words";
import { listProgress } from "@/lib/word-progress";
import type { WordRow } from "@/lib/app-state";

const GLOBAL_KEY = "global";
const pending = new Map<string, Promise<WordRow[]>>();

async function readStored(date: string): Promise<WordRow[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("daily_sets")
      .select("words")
      .eq("user_key", GLOBAL_KEY)
      .eq("study_date", date)
      .maybeSingle();
    if (error || !data || !Array.isArray(data.words) || data.words.length === 0) return null;
    return data.words as WordRow[];
  } catch {
    return null;
  }
}

// insert ... on conflict do nothing, then read back whichever set won.
async function storeAndReadBack(date: string, words: WordRow[]): Promise<WordRow[]> {
  try {
    const { error } = await supabaseAdmin
      .from("daily_sets")
      .upsert(
        { user_key: GLOBAL_KEY, study_date: date, words },
        { onConflict: "user_key,study_date", ignoreDuplicates: true },
      );
    if (error) return words;
    return (await readStored(date)) ?? words;
  } catch {
    return words;
  }
}

async function generate(date: string, exclude: string[], pastWords: WordRow[]): Promise<WordRow[]> {
  try {
    return await fillKoreanPronunciations(await generateStudyWords({ count: 3, exclude }));
  } catch {
    const progress = await listProgress();
    const fallback = buildFallbackWords({ count: 3, progress, pastWords, date });
    if (fallback.length === 0) throw new Error("오늘의 단어를 만들지 못했습니다.");
    return fallback;
  }
}

/** Creates (at most once per date, in-process and in the DB) the shared daily set. */
export function createDailySet(date: string, exclude: string[], pastWords: WordRow[]): Promise<WordRow[]> {
  const existing = pending.get(date);
  if (existing) return existing;
  const task = (async () => {
    const stored = await readStored(date);
    if (stored) return stored;
    return storeAndReadBack(date, await generate(date, exclude, pastWords));
  })().finally(() => pending.delete(date));
  pending.set(date, task);
  return task;
}
