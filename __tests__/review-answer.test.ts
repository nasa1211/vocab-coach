import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  missing: new Set<string>(),
  stateWrites: 0,
}));
const gemini = vi.hoisted(() => ({ calls: 0 }));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => {
          gemini.calls += 1;
          throw new Error("gemini must not be called");
        },
      };
    }
  },
}));

vi.mock("@/lib/supabase", () => {
  function from(name: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let updateValue: Row | null = null;
    const missingError = { message: "relation does not exist" };
    const run = () => {
      if (db.missing.has(name)) return { data: null, error: missingError };
      const rows = (db.tables[name] ??= []).filter((r) => filters.every((f) => f(r)));
      if (updateValue) {
        if (name === "words") db.stateWrites += 1;
        for (const r of rows) Object.assign(r, updateValue);
      }
      return { data: rows, error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      update: (value: Row) => ((updateValue = value), q),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), q),
      order: () => q,
      limit: () => q,
      maybeSingle: async () => {
        const res = run();
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      insert: async (value: Row) => {
        if (name === "words") db.stateWrites += 1;
        (db.tables[name] ??= []).push({ ...value });
        return { error: null };
      },
      upsert: async (value: Row, opts: { onConflict: string }) => {
        if (db.missing.has(name)) return { error: missingError };
        const keys = opts.onConflict.split(",");
        const rows = (db.tables[name] ??= []);
        const idx = rows.findIndex((r) => keys.every((k) => r[k] === value[k]));
        if (idx >= 0) rows[idx] = { ...rows[idx], ...value };
        else rows.push({ ...value });
        return { error: null };
      },
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return q;
  }
  return { supabaseAdmin: { from } };
});

import { markReviewAnswer } from "@/lib/app-state";
import { POST } from "@/app/api/study/quizzed/route";
import { STATE_WORD } from "@/lib/study-plan";

const DEVICE = "11111111-2222-4333-8444-555555555555";
const PAST_DUE = "2020-01-01T00:00:00.000Z";

const reviewWord = {
  id: "w1",
  word: "apple",
  phonetic: "",
  meaning: "사과",
  category: "English",
  nuance: "",
  example_sentence: "",
  example_translation: "",
  speaking_tip: "",
  quick_quiz: { question: "apple의 뜻은?", options: ["사과", "책", "개"], answer_index: 0, explanation: "" },
  created_at: "2026-01-01T00:00:00Z",
};

function seedState() {
  const state = {
    subscriptions: [],
    opened: {},
    sent: {},
    quizzed: {},
    finished: {},
    quizResults: {},
    dailyWords: { "2026-10-01": [reviewWord] },
    devices: {
      [DEVICE]: {
        opened: { "2026-10-26": [1] },
        quizzed: { "2026-10-26": [1] },
        finished: {},
        quizResults: { "2026-10-26": [{ slot: 1, selected: 2, correct: false }] },
      },
    },
    legacyClaimed: true,
  };
  db.tables.words = [{ word: STATE_WORD, nuance: JSON.stringify(state) }];
  return JSON.stringify(state);
}

function progressRow(extra: Row = {}) {
  return {
    user_key: DEVICE,
    word: "apple",
    correct_count: 1,
    wrong_count: 0,
    stage: 1,
    last_seen_at: PAST_DUE,
    next_due_at: PAST_DUE,
    ...extra,
  };
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/study/quizzed", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

beforeEach(() => {
  db.tables = {};
  db.missing = new Set();
  db.stateWrites = 0;
  gemini.calls = 0;
});

describe("markReviewAnswer", () => {
  it("correct answer advances stage and reschedules; main quiz state is untouched", async () => {
    const before = seedState();
    db.tables.word_progress = [progressRow()];

    const result = await markReviewAnswer("apple", 0, DEVICE);

    expect(result).toEqual({ correct: true, recorded: true });
    const [row] = db.tables.word_progress;
    expect(row.stage).toBe(2);
    expect(row.correct_count).toBe(2);
    expect(row.wrong_count).toBe(0);
    expect(Date.parse(row.next_due_at as string)).toBeGreaterThan(Date.now());
    expect(db.tables.words[0].nuance).toBe(before);
    expect(db.stateWrites).toBe(0);
  });

  it("wrong answer resets to stage 0 and counts a miss; main quiz state is untouched", async () => {
    const before = seedState();
    db.tables.word_progress = [progressRow({ stage: 3, correct_count: 4 })];

    const result = await markReviewAnswer("Apple", 1, DEVICE);

    expect(result).toEqual({ correct: false, recorded: true });
    const [row] = db.tables.word_progress;
    expect(row.stage).toBe(0);
    expect(row.wrong_count).toBe(1);
    expect(row.correct_count).toBe(4);
    expect(Date.parse(row.next_due_at as string)).toBeGreaterThan(Date.now());
    expect(db.tables.words[0].nuance).toBe(before);
    expect(db.stateWrites).toBe(0);
  });

  it("does not record when the word is not yet due", async () => {
    seedState();
    const future = "2999-01-01T00:00:00.000Z";
    db.tables.word_progress = [progressRow({ next_due_at: future })];
    const result = await markReviewAnswer("apple", 0, DEVICE);
    expect(result).toEqual({ correct: true, recorded: false });
    expect(db.tables.word_progress[0].stage).toBe(1);
    expect(db.tables.word_progress[0].next_due_at).toBe(future);
  });

  it("returns null for invalid selections and unknown words", async () => {
    seedState();
    db.tables.word_progress = [progressRow()];
    expect(await markReviewAnswer("apple", 3, DEVICE)).toBeNull();
    expect(await markReviewAnswer("apple", -1, DEVICE)).toBeNull();
    expect(await markReviewAnswer("apple", 0.5, DEVICE)).toBeNull();
    expect(await markReviewAnswer("zzz-not-a-word-zzz", 0, DEVICE)).toBeNull();
    expect(db.tables.word_progress[0].stage).toBe(1);
  });

  it("still returns the correctness when word_progress table is missing", async () => {
    const before = seedState();
    db.missing.add("word_progress");
    await expect(markReviewAnswer("apple", 0, DEVICE)).resolves.toEqual({ correct: true, recorded: false });
    await expect(markReviewAnswer("apple", 2, DEVICE)).resolves.toEqual({ correct: false, recorded: false });
    expect(db.tables.words[0].nuance).toBe(before);
  });
});

describe("POST /api/study/quizzed (review path)", () => {
  it("records a correct review and leaves slot quiz state alone", async () => {
    const before = seedState();
    db.tables.word_progress = [progressRow()];
    const res = await post({ review: "apple", selected: 0, device: DEVICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, review: "apple", correct: true });
    expect(db.tables.word_progress[0].stage).toBe(2);
    expect(db.tables.words[0].nuance).toBe(before);
    expect(gemini.calls).toBe(0);
  });

  it("records a wrong review", async () => {
    const before = seedState();
    db.tables.word_progress = [progressRow({ stage: 2 })];
    const res = await post({ review: "apple", selected: 2, device: DEVICE });
    expect(await res.json()).toEqual({ success: true, review: "apple", correct: false });
    expect(db.tables.word_progress[0].stage).toBe(0);
    expect(db.tables.word_progress[0].wrong_count).toBe(1);
    expect(db.tables.words[0].nuance).toBe(before);
  });

  it("succeeds gracefully when word_progress is missing", async () => {
    seedState();
    db.missing.add("word_progress");
    const res = await post({ review: "apple", selected: 0, device: DEVICE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, review: "apple", correct: true });
  });

  it("returns 400 for an invalid selection", async () => {
    seedState();
    const res = await post({ review: "apple", selected: 9, device: DEVICE });
    expect(res.status).toBe(400);
  });

  it("does not take the review path without a valid device (falls to slot validation)", async () => {
    seedState();
    db.tables.word_progress = [progressRow()];
    const res = await post({ review: "apple", selected: 0, device: "bad" });
    expect(res.status).toBe(400);
    expect(db.tables.word_progress[0].stage).toBe(1);
  });
});
