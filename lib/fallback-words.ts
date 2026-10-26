import seedWords from "@/data/words.json";
import type { WordRow } from "@/lib/app-state";
import { normalizeProgressWord, type ProgressRow } from "@/lib/srs";

type SeedWord = {
  word: string;
  phonetic?: string;
  meaning?: string;
  category?: string;
  example_sentence?: string;
  example_translation?: string;
};

export const SEED_WORDS = seedWords as SeedWord[];

function hash(text: string) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Wrong-answered words first (most wrong first), then the stalest (never seen / oldest last_seen_at). */
export function orderProgress(rows: ProgressRow[]): ProgressRow[] {
  const seen = (row: ProgressRow) => (row.last_seen_at ? Date.parse(row.last_seen_at) : 0);
  return [...rows].sort((a, b) => {
    const aWrong = a.wrong_count > 0 ? 1 : 0;
    const bWrong = b.wrong_count > 0 ? 1 : 0;
    if (aWrong !== bWrong) return bWrong - aWrong;
    if (aWrong && a.wrong_count !== b.wrong_count) return b.wrong_count - a.wrong_count;
    return seen(a) - seen(b);
  });
}

/** Deterministic Korean-meaning quiz: the same word always yields the same quiz. */
export function buildMeaningQuiz(word: string, meaning: string, meaningPool: string[]): NonNullable<WordRow["quick_quiz"]> {
  const key = hash(normalizeProgressWord(word));
  const others = [...new Set(meaningPool)].filter((item) => item && item !== meaning);
  const distractors: string[] = [];
  for (let i = 0; i < Math.min(2, others.length); i += 1) {
    distractors.push(others[(key + i) % others.length]);
  }
  const answerIndex = key % 3;
  const options = [...distractors];
  options.splice(Math.min(answerIndex, options.length), 0, meaning);
  return {
    question: `"${word}"의 뜻은?`,
    options,
    answer_index: options.indexOf(meaning),
    explanation: `"${word}"은(는) "${meaning}"라는 뜻입니다.`,
  };
}

function seedToRow(seed: SeedWord): WordRow {
  return {
    id: `seed-${normalizeProgressWord(seed.word)}`,
    word: seed.word,
    phonetic: seed.phonetic ?? "",
    meaning: seed.meaning ?? "",
    category: seed.category ?? "English",
    nuance: "",
    example_sentence: seed.example_sentence ?? "",
    example_translation: seed.example_translation ?? "",
    speaking_tip: "",
    korean_pronunciation: "",
    quick_quiz: null,
    created_at: new Date(0).toISOString(),
  };
}

export function meaningPool(rows: WordRow[], seed: SeedWord[] = SEED_WORDS) {
  return [...rows.map((row) => row.meaning ?? ""), ...seed.map((item) => item.meaning ?? "")].filter(Boolean);
}

export function withQuiz(row: WordRow, pool: string[]): WordRow {
  const options = row.quick_quiz?.options;
  if (Array.isArray(options) && options.length > 0) return row;
  if (!row.meaning) return row;
  return { ...row, quick_quiz: buildMeaningQuiz(row.word, row.meaning, pool) };
}

export function findSeedRow(word: string, seed: SeedWord[] = SEED_WORDS): WordRow | null {
  const key = normalizeProgressWord(word);
  const found = seed.find((item) => normalizeProgressWord(item.word) === key);
  return found ? seedToRow(found) : null;
}

/**
 * Fallback daily set used when Gemini fails: progress words (wrong first, then stalest),
 * then past daily words (oldest first), then data/words.json only if still short.
 */
export function buildFallbackWords({
  count,
  progress,
  pastWords,
  date,
  seed = SEED_WORDS,
}: {
  count: number;
  progress: ProgressRow[];
  pastWords: WordRow[];
  date: string;
  seed?: SeedWord[];
}): WordRow[] {
  const known = new Map<string, WordRow>();
  for (const row of pastWords) known.set(normalizeProgressWord(row.word), row);

  const picked: WordRow[] = [];
  const used = new Set<string>();
  const take = (row: WordRow | undefined | null) => {
    if (!row || picked.length >= count) return;
    const key = normalizeProgressWord(row.word);
    if (!key || used.has(key)) return;
    used.add(key);
    picked.push(row);
  };

  for (const item of orderProgress(progress)) {
    const key = normalizeProgressWord(item.word);
    take(known.get(key) ?? findSeedRow(key, seed));
  }
  for (const row of pastWords) take(row);

  if (picked.length < count && seed.length > 0) {
    const start = hash(date) % seed.length;
    for (let i = 0; i < seed.length && picked.length < count; i += 1) {
      take(seedToRow(seed[(start + i) % seed.length]));
    }
  }

  const pool = meaningPool([...pastWords, ...picked], seed);
  return picked.map((row) => withQuiz({ ...row, korean_pronunciation: row.korean_pronunciation ?? "" }, pool));
}
