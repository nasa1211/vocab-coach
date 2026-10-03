import { supabaseAdmin } from "@/lib/supabase";
import { DAILY_SLOTS, STATE_WORD } from "@/lib/study-plan";
import { getKSTDateString, shiftIsoDate } from "@/lib/kst";
import { fillKoreanPronunciations, generateStudyWords } from "@/lib/generate-study-words";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type AppState = {
  subscriptions: PushSubscriptionRecord[];
  opened: Record<string, number[]>;
  sent: Record<string, number[]>;
  quizzed: Record<string, number[]>;
  finished: Record<string, number[]>;
  dailyWords: Record<string, WordRow[]>;
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
  return { subscriptions: [], opened: {}, sent: {}, quizzed: {}, finished: {}, dailyWords: {} };
}

function parseState(nuance: string | null): AppState {
  if (!nuance) return emptyState();
  try {
    const parsed = JSON.parse(nuance) as Partial<AppState>;
    return {
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      opened: parsed.opened && typeof parsed.opened === "object" ? parsed.opened : {},
      sent: parsed.sent && typeof parsed.sent === "object" ? parsed.sent : {},
      quizzed: parsed.quizzed && typeof parsed.quizzed === "object" ? parsed.quizzed : {},
      finished: parsed.finished && typeof parsed.finished === "object" ? parsed.finished : {},
      dailyWords: parsed.dailyWords && typeof parsed.dailyWords === "object" ? parsed.dailyWords : {},
    };
  } catch {
    return emptyState();
  }
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

async function saveState(state: AppState) {
  prune(state.opened);
  prune(state.sent);
  prune(state.quizzed);
  prune(state.finished);
  prune(state.dailyWords);
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

function toTodaySlots(state: AppState, date: string, picked: WordRow[]): TodaySlot[] {
  const opened = new Set(state.opened[date] ?? []);
  const sent = new Set(state.sent[date] ?? []);
  return picked.map((row, index) => {
    const slot = index + 1;
    return {
      slot,
      row,
      opened: opened.has(slot),
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
  chooseSlot: (slots: TodaySlot[]) => number | null,
  date = getKSTDateString()
) {
  const state = await loadState();
  const { picked, dirty } = await ensureTodayWords(state, date);
  const slots = toTodaySlots(state, date, picked);
  const slot = chooseSlot(slots);
  if (dirty) await saveState(state);
  const yesterday = shiftIsoDate(date, -1);
  const eveningRow = state.dailyWords[yesterday]?.[2] ?? null;
  return {
    date,
    slots,
    currentSlot: slot,
    quizzed: state.quizzed[date] ?? [],
    finished: state.finished[date] ?? [],
    previousEvening: eveningRow
      ? {
          date: yesterday,
          opened: (state.opened[yesterday] ?? []).includes(3),
          finished: (state.finished[yesterday] ?? []).includes(3),
          quizzed: (state.quizzed[yesterday] ?? []).includes(3),
          row: eveningRow,
        }
      : null,
  };
}

async function mark(date: string, slot: number, field: "opened" | "sent" | "quizzed" | "finished") {
  const state = await loadState();
  const marks = new Set(state[field][date] ?? []);
  if (marks.has(slot)) return;
  marks.add(slot);
  state[field][date] = [...marks];
  await saveState(state);
}

export function markOpened(date: string, slot: number) {
  return mark(date, slot, "opened");
}

export function markSent(date: string, slot: number) {
  return mark(date, slot, "sent");
}

export function markQuizzed(date: string, slot: number) {
  return mark(date, slot, "quizzed");
}

export function markFinished(date: string, slot: number) {
  return mark(date, slot, "finished");
}

export async function listSubscriptions() {
  const state = await loadState();
  return state.subscriptions;
}

export async function listPastDays(today = getKSTDateString()) {
  const state = await loadState();

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
