import { afterEach, describe, expect, it, vi } from "vitest";
import { fillKoreanPronunciations, isMissingPron } from "@/lib/generate-study-words";
import type { WordRow } from "@/lib/app-state";

describe("isMissingPron", () => {
  it("detects missing values", () => {
    for (const v of [null, undefined, "", "   ", "\n\t"]) expect(isMissingPron(v)).toBe(true);
    expect(isMissingPron("터치")).toBe(false);
  });
});

describe("fillKoreanPronunciations", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps existing values and normalizes missing ones without API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const rows = [
      { word: "a", korean_pronunciation: "에이" },
      { word: "b", korean_pronunciation: "  " },
      { word: "c", korean_pronunciation: null },
    ] as unknown as WordRow[];
    const out = await fillKoreanPronunciations(rows);
    expect(out.map((r) => r.korean_pronunciation)).toEqual(["에이", "", ""]);
  });

  it("returns rows unchanged when none missing", async () => {
    const rows = [{ word: "a", korean_pronunciation: "에이" }] as unknown as WordRow[];
    expect(await fillKoreanPronunciations(rows)).toBe(rows);
  });
});
