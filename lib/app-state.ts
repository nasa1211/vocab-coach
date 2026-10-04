import { supabaseAdmin } from "@/lib/supabase";
import { DAILY_SLOTS, STATE_WORD } from "@/lib/study-plan";
import { getKSTDateString, shiftIsoDate } from "@/lib/kst";
import { fillKoreanPronunciations, generateStudyWords } from "@/lib/generate-study-words";
import { parseDeviceId } from "@/lib/device-id";
import {
  claimLegacyProgress,
  emptyProgress,
  hasProgress,
  markDeviceSlot,
  quizForSlot,
  saveDeviceQuiz,
  slotOpened,
  type DeviceProgress,
  type QuizResult,
} from "@/lib/device-progress";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type { QuizResult };

type AppState = {
  subscriptions: PushSubscriptionRecord[];
  opened: Record<string, number[]>;
  sent: Record<string, number[]>;
  quizzed: Record<string, number[]>;
  finished: Record<string, number[]>;
  quizResults: Record<string, QuizResult[]>;
  dailyWords: Record<string, WordRow[]>;
  devices: Record<string, DeviceProgress>;
  legacyClaimed: boolean;
};

export type WordRow = {
  id: string;
  word: string;
  phonetic: string | null;
  meaning: string | null;
  category: string | null;
  nuance: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  speaking_tip: string | null;
  korean_pronunciation?: string | null;
  quick_quiz: {
    question?: string;
    options?: string[];
    answer_index?: number;
    explanation?: string;
  } | null;
  created_at: string;
};

function emptyState(): AppState {
  return {
    subscriptions: [],
    opened: {},
    sent: {},
    quizzed: {},
    finished: {},
    quizResults: {},
    dailyWords: {},
    devices: {},
    legacyClaimed: false,
  };
}

function dateRecord<T>(value: unknown, accept: (item: unknown) => T | null): Record<string, T> {
  if (!value || typeof value !== "object") return {};
  const record: Record<string, T> = {};
  for (const [date, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const parsed = accept(entry);
    if (parsed) record[date] = parsed;
  }
  return record;
}

function slotList(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is number => item === 1 || item === 2 || item === 3);
}

function quizList(value: unknown): QuizResult[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const slot = Number((item as QuizResult).slot);
    const selected = (item as QuizResult).selected;
    if (![1, 2, 3].includes(slot) || !Number.isInteger(selected) || typeof (item as QuizResult).correct !== "boolean") {
      return [];
    }
    return [{ slot, selected, correct: (item as QuizResult).correct }];
  });
}

function parseProgress(value: unknown): DeviceProgress {
  const record = value && typeof value === "object" ? (value as Partial<DeviceProgress>) : {};
  return {
    opened: dateRecord(record.opened, slotList),
    quizzed: dateRecord(record.quizzed, slotList),
    finished: dateRecord(record.finished, slotList),
    quizResults: dateRecord(record.quizResults, quizList),
  };
}

function parseDevices(value: unknown) {
  if (!value || typeof value !== "object") return {};
  const devices: Record<string, DeviceProgress> = {};
  for (const [id, progress] of Object.entries(value as Record<string, unknown>)) {
    const deviceId = parseDeviceId(id);
    if (!deviceId) continue;
    devices[deviceId] = parseProgress(progress);
  }
  return devices;
}

function parseState(nuance: string | null): AppState {
  if (!nuance) return emptyState();
  try {
    const parsed = JSON.parse(nuance) as Partial<AppState>;
    return {
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      opened: dateRecord(parsed.opened, slotList),
      sent: dateRecord(parsed.sent, slotList),
      quizzed: dateRecord(parsed.quizzed, slotList),
      finished: dateRecord(parsed.finished, slotList),
      quizResults: dateRecord(parsed.quizResults, quizList),
      dailyWords: parsed.dailyWords && typeof parsed.dailyWords === "object" ? parsed.dailyWords : {},
      devices: parseDevices(parsed.devices),
      legacyClaimed: parsed.legacyClaimed === true,
    };
  } catch {
    return emptyState();
  }
}

function legacyProgress(state: AppState): DeviceProgress {
  return {
    opened: state.opened,
    quizzed: state.quizzed,
    finished: state.finished,
    quizResults: state.quizResults,
  };
}

function applyClaim(state: AppState, deviceId: string) {
  const claimed = claimLegacyProgress(state.devices, legacyProgress(state), state.legacyClaimed, deviceId);
  state.devices = claimed.devices;
  state.opened = claimed.legacy.opened;
  state.quizzed = claimed.legacy.quizzed;
  state.finished = claimed.legacy.finished;
  state.quizResults = claimed.legacy.quizResults;
  state.legacyClaimed = claimed.legacyClaimed;
  return claimed.changed;
}

function prune(days: Record<string, unknown>) {
  const keys = Object.keys(days).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - 60))) {
    delete days[key];
  }
}

async function loadState(): Promise<AppState> {
  const { data, error } = await supabaseAdmin
    .from("words")
    .select("nuance")
    .eq("word", STATE_WORD)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parseState(data?.nuance ?? null);
}

function unionSlots(left: Record<string, number[]>, right: Record<string, number[]>) {
  const dates = new Set([...Object.keys(left), ...Object.keys(right)]);
  const merged: Record<string, number[]> = {};
  for (const date of dates) {
    merged[date] = [...new Set([...(left[date] ?? []), ...(right[date] ?? [])])];
  }
  return merged;
}

async function saveState(state: AppState) {
  const current = await loadState();
  state.devices = { ...current.devices, ...state.devices };
  state.sent = unionSlots(current.sent, state.sent);
  state.dailyWords = { ...current.dailyWords, ...state.dailyWords };
  if (current.legacyClaimed) {
    state.legacyClaimed = true;
    state.opened = {};
    state.quizzed = {};
    state.finished = {};
    state.quizResults = {};
  }
  prune(state.opened);
  prune(state.sent);
  prune(state.quizzed);
  prune(state.finished);
  prune(state.quizResults);
  prune(state.dailyWords);
  for (const progress of Object.values(state.devices)) {
    prune(progress.opened);
    prune(progress.quizzed);
    prune(progress.finished);
    prune(progress.quizResults);
  }
  const spare = Object.entries(state.devices).filter(([, progress]) => !hasProgress(progress));
  if (Object.keys(state.devices).length > 200) {
    for (const [id] of spare) delete state.devices[id];
  }
  const nuance = JSON.stringify(state);

  const { data, error } = await supabaseAdmin
    .from("words")
    .update({ nuance })
    .eq("word", STATE_WORD)
    .select("id");

  if (error) throw new Error(error.message);
  if (data && data.length > 0) return;

  const { error: insertError } = await supabaseAdmin.from("words").insert({
    word: STATE_WORD,
    category: "system",
    meaning: "앱 내부 상태",
    example_sentence: "-",
    example_translation: "-",
    nuance,
  });
  if (!insertError) return;
  if (insertError.code !== "23505") throw new Error(insertError.message);

  const { error: retryError } = await supabaseAdmin
    .from("words")
    .update({ nuance })
    .eq("word", STATE_WORD);
  if (retryError) throw new Error(retryError.message);
}

export async function loadStudyWords(): Promise<WordRow[]> {
  const { data, error } = await supabaseAdmin
    .from("words")
    .select("*")
    .neq("word", STATE_WORD)
    .neq("category", "system")
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) throw new Error(error.message);
  return (data ?? []) as WordRow[];
}

export async function findStudyWord(word: string): Promise<WordRow | null> {
  const words = await loadStudyWords();
  return words.find((item) => item.word.toLowerCase() === word.toLowerCase()) ?? null;
}

export async function findCachedWord(word: string): Promise<WordRow | null> {
  const state = await loadState();
  const cached = Object.values(state.dailyWords).flat();
  return cached.find((item) => item.word.toLowerCase() === word.toLowerCase()) ?? null;
}

type TodaySlot = {
  slot: number;
  row: WordRow;
  opened: boolean;
  sent: boolean;
};

function toTodaySlots(state: AppState, date: string, picked: WordRow[], deviceId?: string): TodaySlot[] {
  const progress = deviceId ? state.devices[deviceId] ?? emptyProgress() : emptyProgress();
  const sent = new Set(state.sent[date] ?? []);
  return picked.map((row, index) => {
    const slot = index + 1;
    return {
      slot,
      row,
      opened: slotOpened(progress, date, slot),
      sent: sent.has(slot),
    };
  });
}

async function ensureTodayWords(state: AppState, date: string) {
  let picked = state.dailyWords[date] ?? [];
  let dirty = false;

  if (picked.length === 0) {
    const exclude = Object.values(state.dailyWords)
      .flat()
      .map((item) => item.word);
    picked = await generateStudyWords({ count: 3, exclude });
    dirty = true;
  }

  if (picked.some((row) => row.korean_pronunciation == null)) {
    picked = await fillKoreanPronunciations(picked);
    dirty = true;
  }

  if (dirty) state.dailyWords[date] = picked;
  return { picked, dirty };
}

export async function getTodayPlan(date = getKSTDateString()) {
  const state = await loadState();
  const { picked, dirty } = await ensureTodayWords(state, date);
  if (dirty) await saveState(state);
  return { date, slots: toTodaySlots(state, date, picked) };
}

export async function getTodayStudy(
  deviceId: string,
  chooseSlot: (slots: TodaySlot[]) => number | null,
  date = getKSTDateString()
) {
  const state = await loadState();
  const claimed = applyClaim(state, deviceId);
  const { picked, dirty } = await ensureTodayWords(state, date);
  const slots = toTodaySlots(state, date, picked, deviceId);
  const slot = chooseSlot(slots);
  if (dirty || claimed) await saveState(state);
  const progress = state.devices[deviceId] ?? emptyProgress();
  const yesterday = shiftIsoDate(date, -1);
  const eveningRow = state.dailyWords[yesterday]?.[2] ?? null;
  return {
    date,
    slots,
    currentSlot: slot,
    quizzed: progress.quizzed[date] ?? [],
    finished: progress.finished[date] ?? [],
    previousEvening: eveningRow
      ? {
          date: yesterday,
          opened: slotOpened(progress, yesterday, 3),
          finished: (progress.finished[yesterday] ?? []).includes(3),
          quizzed: (progress.quizzed[yesterday] ?? []).includes(3),
          row: eveningRow,
        }
      : null,
  };
}

export async function markSent(date: string, slot: number) {
  const state = await loadState();
  const marks = new Set(state.sent[date] ?? []);
  if (marks.has(slot)) return;
  marks.add(slot);
  state.sent[date] = [...marks];
  await saveState(state);
}

async function markDevice(deviceId: string, date: string, slot: number, field: "opened" | "finished") {
  const state = await loadState();
  const claimed = applyClaim(state, deviceId);
  const progress = state.devices[deviceId] ?? emptyProgress();
  state.devices[deviceId] = progress;
  const changed = markDeviceSlot(progress, field, date, slot);
  if (claimed || changed) await saveState(state);
}

export function markOpened(date: string, slot: number, deviceId: string) {
  return markDevice(deviceId, date, slot, "opened");
}

export async function markQuizAnswer(date: string, slot: number, selected: number, deviceId: string) {
  const state = await loadState();
  const row = state.dailyWords[date]?.[slot - 1];
  const options = row?.quick_quiz?.options;
  if (!Array.isArray(options)) return null;

  const claimed = applyClaim(state, deviceId);
  const progress = state.devices[deviceId] ?? emptyProgress();
  state.devices[deviceId] = progress;
  const saved = saveDeviceQuiz(progress, date, slot, selected, options.length, Number(row?.quick_quiz?.answer_index));
  if (!saved) return null;
  if (claimed || saved.changed) await saveState(state);
  return saved.result;
}

export function markFinished(date: string, slot: number, deviceId: string) {
  return markDevice(deviceId, date, slot, "finished");
}

export async function listSubscriptions() {
  const state = await loadState();
  return state.subscriptions;
}

function historyQuiz(progress: DeviceProgress, date: string, slot: number, row: WordRow) {
  const result = quizForSlot(progress, date, slot);
  const quiz = row.quick_quiz;
  const options = quiz?.options;
  if (!result || !quiz || !Array.isArray(options) || options.length === 0) return null;
  return {
    question: quiz.question ?? "",
    options,
    answerIndex: Number(quiz.answer_index ?? 0),
    explanation: quiz.explanation ?? "",
    selected: result.selected,
    correct: result.correct,
  };
}

export async function listPastDays(deviceId: string, today = getKSTDateString()) {
  const state = await loadState();
  const claimed = applyClaim(state, deviceId);
  if (claimed) await saveState(state);
  const progress = state.devices[deviceId] ?? emptyProgress();

  return Object.entries(state.dailyWords)
    .filter((entry): entry is [string, WordRow[]] => {
      const [date, rows] = entry;
      return date < today && Array.isArray(rows) && rows.length > 0;
    })
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, rows]) => ({
      date,
      slots: rows.map((row, index) => {
        const meta = DAILY_SLOTS[index];
        return {
          slot: index + 1,
          label: meta?.label ?? `${index + 1}회`,
          time: meta?.time ?? "",
          word: row.word,
          meaning: row.meaning ?? "",
          exampleSentence: row.example_sentence ?? "",
          exampleTranslation: row.example_translation ?? "",
          quiz: historyQuiz(progress, date, index + 1, row),
        };
      }),
    }));
}

export async function saveSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const state = await loadState();
  state.subscriptions = [
    ...state.subscriptions.filter((item) => item.endpoint !== subscription.endpoint),
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  ];
  await saveState(state);
}

export async function removeSubscription(endpoint: string) {
  const state = await loadState();
  state.subscriptions = state.subscriptions.filter((item) => item.endpoint !== endpoint);
  await saveState(state);
}

export async function replaceSubscriptions(subscriptions: PushSubscriptionRecord[]) {
  const state = await loadState();
  state.subscriptions = subscriptions;
  await saveState(state);
}
