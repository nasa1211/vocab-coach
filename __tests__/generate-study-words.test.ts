import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const getGenerativeModel = vi.fn(() => ({ generateContent }));
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModel;
  },
}));

import { EXTRA_CANDIDATES, buildStudyWordsPrompt, generateStudyWords, takeNewWords } from "@/lib/generate-study-words";

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
    expect(p).toContain("이미 학습한 단어는 제외하세요: apple,book");
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

describe("generateStudyWords", () => {
  const reply = (words: string[]) => ({
    response: { text: () => JSON.stringify({ words: words.map((word) => ({ word })) }) },
  });

  beforeEach(() => {
    generateContent.mockReset();
    getGenerativeModel.mockClear();
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("sends full compact exclude list and requests extra candidates", async () => {
    const exclude = Array.from({ length: 200 }, (_, i) => `word${i}`);
    generateContent.mockResolvedValue(reply(["alpha", "beta", "gamma"]));
    await generateStudyWords({ count: 3, exclude });
    const prompt = generateContent.mock.calls[0][0] as string;
    expect(prompt).toContain(exclude.join(","));
    expect(prompt).toContain(`words 배열 길이는 ${3 + EXTRA_CANDIDATES}개`);
    expect(prompt).toContain("다양성 규칙");
    const cfg = (getGenerativeModel.mock.calls[0] as unknown[])[0] as { generationConfig: { temperature: number } };
    expect(cfg.generationConfig.temperature).toBe(0.8);
  });

  it("picks the first candidates that pass the filter, exactly count", async () => {
    generateContent.mockResolvedValue(reply(["old1", "new1", "old2", "new2", "new3", "new4"]));
    const rows = await generateStudyWords({ count: 3, exclude: ["old1", "old2"] });
    expect(rows.map((r) => r.word)).toEqual(["new1", "new2", "new3"]);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("keeps requested word path at 1 candidate without diversity rule", async () => {
    generateContent.mockResolvedValue(reply(["reply"]));
    const rows = await generateStudyWords({ count: 1, word: "reply" });
    expect(rows.map((r) => r.word)).toEqual(["reply"]);
    const prompt = generateContent.mock.calls[0][0] as string;
    expect(prompt).toContain("words 배열 길이는 1개");
    expect(prompt).not.toContain("다양성 규칙");
  });
});
