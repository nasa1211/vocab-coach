import { supabaseAdmin } from "@/lib/supabase";
import { STATE_WORD, pickDailyWords } from "@/lib/study-plan";
import { getKSTDateString } from "@/lib/kst";

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type AppState = {
  subscriptions: PushSubscriptionRecord[];
  opened: Record<string, number[]>;
  sent: Record<string, number[]>;
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
  quick_quiz: {
    question?: string;
    options?: string[];
    answer_index?: number;
    explanation?: string;
  } | null;
  created_at: string;
};

function emptyState(): AppState {
  return { subscriptions: [], opened: {}, sent: {} };
}

function parseState(nuance: string | null): AppState {
  if (!nuance) return emptyState();
  try {
    const parsed = JSON.parse(nuance) as Partial<AppState>;
    return {
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      opened: parsed.opened && typeof parsed.opened === "object" ? parsed.opened : {},
      sent: parsed.sent && typeof parsed.sent === "object" ? parsed.sent : {},
    };
  } catch {
    return emptyState();
  }
}

function prune(days: Record<string, number[]>) {
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
  const nuance = JSON.stringify(state);

  const { data: existing, error: readError } = await supabaseAdmin
    .from("words")
    .select("id")
    .eq("word", STATE_WORD)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  if (!existing) {
    const { error } = await supabaseAdmin.from("words").insert({
      word: STATE_WORD,
      category: "system",
      meaning: "앱 내부 상태",
      example_sentence: "-",
      example_translation: "-",
      nuance,
    });
    if (!error) return;
    if (error.code !== "23505") throw new Error(error.message);
  }

  const { error } = await supabaseAdmin.from("words").update({ nuance }).eq("word", STATE_WORD);
  if (error) throw new Error(error.message);
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

export async function getTodayPlan(date = getKSTDateString()) {
  const [words, state] = await Promise.all([loadStudyWords(), loadState()]);
  const picked = pickDailyWords(words, date, 3);
  const opened = new Set(state.opened[date] ?? []);
  const sent = new Set(state.sent[date] ?? []);

  return {
    date,
    slots: picked.map((row, index) => {
      const slot = index + 1;
      return {
        slot,
        row,
        opened: opened.has(slot),
        sent: sent.has(slot),
      };
    }),
  };
}

async function mark(date: string, slot: number, field: "opened" | "sent") {
  const state = await loadState();
  const marks = new Set(state[field][date] ?? []);
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

export async function listSubscriptions() {
  const state = await loadState();
  return state.subscriptions;
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

export async function replaceSubscriptions(subscriptions: PushSubscriptionRecord[]) {
  const state = await loadState();
  state.subscriptions = subscriptions;
  await saveState(state);
}
