import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---- mocked Supabase (in-memory, optionally "table missing") ----
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  missing: new Set<string>(),
  inserts: 0,
}));

vi.mock("@/lib/supabase", () => {
  function from(name: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    let max = Infinity;
    const run = () => {
      if (db.missing.has(name)) return { data: null, error: { message: "relation does not exist" } };
      let rows = (db.tables[name] ??= []).filter((r) => filters.every((f) => f(r)));
      if (order) {
        const { col, asc } = order;
        rows = [...rows].sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (asc ? 1 : -1));
      }
      return { data: rows.slice(0, max), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), q),
      order: (col: string, o: { ascending: boolean }) => ((order = { col, asc: o.ascending }), q),
      limit: (n: number) => ((max = n), q),
      maybeSingle: async () => {
        const res = run();
        return { data: res.data?.[0] ?? null, error: res.error };
      },
      upsert: async (value: Row, opts: { onConflict: string; ignoreDuplicates?: boolean }) => {
        if (db.missing.has(name)) return { error: { message: "relation does not exist" } };
        const keys = opts.onConflict.split(",");
        const rows = (db.tables[name] ??= []);
        const idx = rows.findIndex((r) => keys.every((k) => r[k] === value[k]));
        db.inserts += 1;
        if (idx >= 0) {
          if (!opts.ignoreDuplicates) rows[idx] = { ...rows[idx], ...value };
        } else rows.push({ ...value });
        return { error: null };
      },
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return q;
  }
  return { supabaseAdmin: { from } };
});

// ---- mocked Gemini ----
const generate = vi.hoisted(() => ({ calls: 0, fail: true, text: "" }));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => {
          generate.calls += 1;
          if (generate.fail) throw new Error("gemini down");
          return { response: { text: () => generate.text } };
        },
      };
    }
  },
}));

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));
vi.mock("@/lib/env-config", () => ({
  getVapidConfig: () => ({ email: "a@b.c", publicKey: "pub", privateKey: "priv" }),
}));

import { applyAnswer, applyOpened, intervalDays, isDue, type ProgressRow } from "@/lib/srs";
import { buildFallbackWords, orderProgress } from "@/lib/fallback-words";
import { generateStudyWords } from "@/lib/generate-study-words";
import { createDailySet } from "@/lib/daily-set";
import { getDueWords, recordAnswer, recordOpened } from "@/lib/word-progress";
import type { WordRow } from "@/lib/app-state";

const DAY = 86_400_000;
const now = new Date("2026-10-26T00:00:00Z");
const key = { user_key: "dev", word: "apple" };

function prog(word: string, extra: Partial<ProgressRow> = {}): ProgressRow {
  return {
    user_key: "dev",
    word,
    correct_count: 0,
    wrong_count: 0,
    stage: 0,
    last_seen_at: null,
    next_due_at: null,
    ...extra,
  };
}

function row(word: string, extra: Partial<WordRow> = {}): WordRow {
  return {
    id: word,
    word,
    phonetic: "",
    meaning: `${word}-뜻`,
    category: "English",
    nuance: "",
    example_sentence: "",
    example_translation: "",
    speaking_tip: "",
    quick_quiz: null,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

beforeEach(() => {
  db.tables = {};
  db.missing = new Set();
  db.inserts = 0;
  generate.calls = 0;
  generate.fail = true;
  sendNotification.mockReset();
  process.env.GEMINI_API_KEY = "test";
});

describe("SRS interval math", () => {
  it("uses 1,3,7,14 day intervals", () => {
    expect([0, 1, 2, 3].map(intervalDays)).toEqual([1, 3, 7, 14]);
  });

  it("advances stages on correct answers and caps at 14 days", () => {
    let r = applyOpened(null, key, now);
    expect(r.stage).toBe(0);
    // now = 09:00 KST Oct 26 -> 00:00 KST Oct 27
    expect(r.next_due_at).toBe("2026-10-26T15:00:00.000Z");
    const due: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      r = applyAnswer(r, key, true, now);
      due.push(r.next_due_at!);
    }
    expect(due).toEqual([
      "2026-10-28T15:00:00.000Z", // +3 days
      "2026-11-01T15:00:00.000Z", // +7 days
      "2026-11-08T15:00:00.000Z", // +14 days
      "2026-11-08T15:00:00.000Z",
      "2026-11-08T15:00:00.000Z",
    ]);
    expect(r.correct_count).toBe(5);
  });

  it("resets to stage 0 (due 00:00 KST next day) on a wrong answer", () => {
    const r = applyAnswer(prog("apple", { stage: 3, correct_count: 4 }), key, false, now);
    expect(r.stage).toBe(0);
    expect(r.wrong_count).toBe(1);
    expect(r.next_due_at).toBe("2026-10-26T15:00:00.000Z");
  });

  it("opening an existing word keeps its stage and due date", () => {
    const prev = prog("apple", { stage: 2, next_due_at: "2026-11-01T00:00:00Z" });
    const r = applyOpened(prev, key, now);
    expect(r.stage).toBe(2);
    expect(r.next_due_at).toBe(prev.next_due_at);
  });

  it("persists through the db and returns due words", async () => {
    await recordOpened("dev", "Apple", now);
    expect(await getDueWords("dev", 2, now)).toEqual([]);
    const later = new Date(now.getTime() + 2 * DAY);
    expect(await getDueWords("dev", 2, later)).toEqual(["apple"]);
    expect(await recordAnswer("dev", "apple", true, { onlyIfDue: true, now: later })).toBe(true);
    expect(await recordAnswer("dev", "apple", true, { onlyIfDue: true, now: later })).toBe(false);
  });

  it("behaves as before when the table is missing", async () => {
    db.missing.add("word_progress");
    await expect(recordOpened("dev", "apple")).resolves.toBeUndefined();
    expect(await recordAnswer("dev", "apple", true)).toBe(false);
    expect(await getDueWords("dev", 2)).toEqual([]);
  });
});

describe("SRS due at 00:00 KST", () => {
  const at = (iso: string) => new Date(iso);

  it("wrong answer at 18:05 KST is due 00:00 KST next day and due by 18:00 KST that day", () => {
    const answered = at("2026-10-26T09:05:00Z"); // 18:05 KST
    const r = applyAnswer(prog("apple", { stage: 2 }), key, false, answered);
    expect(r.next_due_at).toBe("2026-10-26T15:00:00.000Z");
    expect(isDue(r, at("2026-10-26T14:59:59Z"))).toBe(false);
    expect(isDue(r, at("2026-10-26T15:00:00Z"))).toBe(true);
    expect(isDue(r, at("2026-10-27T09:00:00Z"))).toBe(true); // 18:00 KST next day
  });

  it("23:59 KST and 00:00 KST fall on different KST dates", () => {
    const late = applyAnswer(null, key, false, at("2026-10-26T14:59:00Z")); // 23:59 KST Oct 26
    expect(late.next_due_at).toBe("2026-10-26T15:00:00.000Z"); // 00:00 KST Oct 27
    const midnight = applyAnswer(null, key, false, at("2026-10-26T15:00:00Z")); // 00:00 KST Oct 27
    expect(midnight.next_due_at).toBe("2026-10-27T15:00:00.000Z"); // 00:00 KST Oct 28
  });

  it("14:59Z vs 15:00Z crossing for opened words", () => {
    expect(applyOpened(null, key, at("2026-10-26T14:59:59Z")).next_due_at).toBe("2026-10-26T15:00:00.000Z");
    expect(applyOpened(null, key, at("2026-10-26T15:00:00Z")).next_due_at).toBe("2026-10-27T15:00:00.000Z");
  });

  it("uses 1,3,7,14 calendar-day intervals for each stage", () => {
    const base = at("2026-10-26T09:05:00Z");
    const expected = ["2026-10-26T15:00:00.000Z", "2026-10-28T15:00:00.000Z", "2026-11-01T15:00:00.000Z", "2026-11-08T15:00:00.000Z"];
    expect([0, 1, 2, 3].map((stage) => applyAnswer(prog("apple", { stage: stage - 1 }), key, stage > 0, base).next_due_at)).toEqual(
      expected,
    );
  });

  it("isDue is false without a due date", () => {
    expect(isDue(prog("apple"), now)).toBe(false);
  });
});

describe("fallback ordering", () => {
  it("puts wrong words first, then stalest, then past words, then seed top-up without duplicates", () => {
    const past = [row("alpha"), row("beta"), row("gamma"), row("delta")];
    const progress = [
      prog("alpha", { last_seen_at: "2026-10-01T00:00:00Z" }),
      prog("gamma", { last_seen_at: "2026-10-20T00:00:00Z", wrong_count: 1 }),
      prog("beta", { last_seen_at: "2026-09-01T00:00:00Z" }),
    ];
    expect(orderProgress(progress).map((p) => p.word)).toEqual(["gamma", "beta", "alpha"]);

    const out = buildFallbackWords({ count: 3, progress, pastWords: past, date: "2026-10-26" });
    expect(out.map((w) => w.word)).toEqual(["gamma", "beta", "alpha"]);
    for (const w of out) {
      const options = w.quick_quiz?.options ?? [];
      expect(options).toHaveLength(3);
      expect(options[w.quick_quiz?.answer_index ?? -1]).toBe(w.meaning);
    }

    const topUp = buildFallbackWords({ count: 3, progress: [], pastWords: [row("alpha")], date: "2026-10-26" });
    expect(topUp).toHaveLength(3);
    expect(topUp[0].word).toBe("alpha");
    expect(new Set(topUp.map((w) => w.word.toLowerCase())).size).toBe(3);
  });
});

describe("Gemini single retry", () => {
  it("calls generate at most twice and then throws", async () => {
    await expect(generateStudyWords({ count: 3 })).rejects.toThrow();
    expect(generate.calls).toBeLessThanOrEqual(2);
    expect(generate.calls).toBe(2);
  });

  it("falls back to progress/past words without more Gemini calls", async () => {
    db.tables.word_progress = [prog("beta", { wrong_count: 2 })];
    const out = await createDailySet("2026-10-26", [], [row("alpha"), row("beta")]);
    expect(generate.calls).toBe(2); // 2 attempts only; no extra pronunciation call on fallback
    expect(out).toHaveLength(3);
    expect(out[0].word).toBe("beta");
  });
});

describe("daily set dedupe", () => {
  it("creates one set for concurrent callers and reuses the stored one", async () => {
    const [a, b] = await Promise.all([
      createDailySet("2026-10-27", [], [row("alpha")]),
      createDailySet("2026-10-27", [], [row("alpha")]),
    ]);
    expect(a).toEqual(b);
    expect(generate.calls).toBe(2); // one generation (2 attempts), not two
    const calls = generate.calls;
    const again = await createDailySet("2026-10-27", [], []);
    expect(again).toEqual(a);
    expect(generate.calls).toBe(calls);
    expect(db.tables.daily_sets).toHaveLength(1);
  });

  it("works as before when daily_sets is missing", async () => {
    db.missing.add("daily_sets");
    const out = await createDailySet("2026-10-28", [], [row("alpha")]);
    expect(out).toHaveLength(3);
  });
});

describe("push 410 removal", () => {
  it("removes only the expired subscription", async () => {
    const subs = [
      { endpoint: "https://push/ok", p256dh: "p", auth: "a" },
      { endpoint: "https://push/gone", p256dh: "p", auth: "a" },
    ];
    const removeSubscription = vi.fn();
    vi.resetModules();
    vi.doMock("@/lib/app-state", () => ({
      getTodayPlan: async () => ({ date: "2026-10-26", slots: [{ slot: 1, row: row("alpha"), opened: false, sent: false }] }),
      listSubscriptions: async () => subs,
      markSent: vi.fn(),
      removeSubscription,
    }));
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    });
    const { GET } = await import("@/app/api/push/cron/route");
    const res = await GET(new NextRequest("http://localhost/api/push/cron?slot=1"));
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(removeSubscription).toHaveBeenCalledTimes(1);
    expect(removeSubscription).toHaveBeenCalledWith("https://push/gone");
    vi.doUnmock("@/lib/app-state");
  });
});
