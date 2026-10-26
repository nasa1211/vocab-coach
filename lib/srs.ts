import { getKSTDateString, shiftIsoDate } from "@/lib/kst";
export const STAGE_DAYS = [1, 3, 7, 14] as const;
export const MAX_STAGE = STAGE_DAYS.length - 1;

export type ProgressRow = {
  user_key: string;
  word: string;
  correct_count: number;
  wrong_count: number;
  stage: number;
  last_seen_at: string | null;
  next_due_at: string | null;
};

export function normalizeProgressWord(word: string) {
  return word.trim().toLowerCase();
}

export function intervalDays(stage: number) {
  const clamped = Math.min(Math.max(Math.trunc(stage) || 0, 0), MAX_STAGE);
  return STAGE_DAYS[clamped];
}

function dueAt(stage: number, now: Date) {
  // 00:00 KST on the KST calendar date N days after now (KST = UTC+9, no DST).
  const kstDate = getKSTDateString(now);
  const target = shiftIsoDate(kstDate, intervalDays(stage));
  return new Date(`${target}T00:00:00+09:00`).toISOString();
}

/** Correct answers advance one stage (capped); a wrong answer resets to stage 0 (due next day). */
export function applyAnswer(
  previous: ProgressRow | null,
  key: { user_key: string; word: string },
  correct: boolean,
  now: Date,
): ProgressRow {
  const stage = correct ? Math.min((previous?.stage ?? 0) + 1, MAX_STAGE) : 0;
  return {
    user_key: key.user_key,
    word: key.word,
    correct_count: (previous?.correct_count ?? 0) + (correct ? 1 : 0),
    wrong_count: (previous?.wrong_count ?? 0) + (correct ? 0 : 1),
    stage,
    last_seen_at: now.toISOString(),
    next_due_at: dueAt(stage, now),
  };
}

/** Opening a word creates it at stage 0 (due next day); existing rows only get last_seen_at refreshed. */
export function applyOpened(
  previous: ProgressRow | null,
  key: { user_key: string; word: string },
  now: Date,
): ProgressRow {
  if (previous) return { ...previous, last_seen_at: now.toISOString() };
  return {
    user_key: key.user_key,
    word: key.word,
    correct_count: 0,
    wrong_count: 0,
    stage: 0,
    last_seen_at: now.toISOString(),
    next_due_at: dueAt(0, now),
  };
}

export function isDue(row: ProgressRow, now: Date) {
  return Boolean(row.next_due_at) && Date.parse(row.next_due_at as string) <= now.getTime();
}
