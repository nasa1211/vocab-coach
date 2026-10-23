import { describe, expect, it } from "vitest";
import { buildStudyWordsPrompt, takeNewWords } from "@/lib/generate-study-words";

describe("buildStudyWordsPrompt", () => {
  const base = { need: 3, category: "English" };

  it("includes level, sentence limit and quiz rules", () => {
    const p = buildStudyWordsPrompt(base);
    expect(p).toContain("A2-B1");
    expect(p).toContain("12단어 이하");
    expect(p).toContain("한국어 뜻으로 된 보기 정확히 3개");
    expect(p).toContain("의 뜻은?");
  });

  it("includes need count", () => {
    expect(buildStudyWordsPrompt({ ...base, need: 2 })).toContain("2개");
    expect(buildStudyWordsPrompt({ ...base, need: 2 })).toContain("words 배열 길이는 2개");
  });

  it("includes exclude list only when given", () => {
    expect(buildStudyWordsPrompt(base)).not.toContain("이미 학습한 단어");
    expect(buildStudyWordsPrompt({ ...base, excludeList: [] })).not.toContain("이미 학습한 단어");
    const p = buildStudyWordsPrompt({ ...base, excludeList: ["apple", "book"] });
    expect(p).toContain("이미 학습한 단어는 제외하세요: apple, book");
  });

  it("handles requested word branch", () => {
    const p = buildStudyWordsPrompt({ ...base, requestedWord: "reply" });
    expect(p).toContain('요청된 단어("reply")');
    expect(p).not.toContain("서로 겹치지 않게 고르세요");
    expect(p).toContain("12단어 이하");
  });
});

describe("takeNewWords", () => {
  it("skips blocked and duplicate words, respects limit", () => {
    const blocked = new Set(["apple"]);
    const out = takeNewWords(
      [{ word: "Apple" }, { word: "book" }, { word: " BOOK " }, { word: "" }, { word: "cat" }, { word: "dog" }],
      blocked,
      2
    );
    expect(out.map((w) => w.word)).toEqual(["book", "cat"]);
    expect(blocked.has("book")).toBe(true);
  });
});
