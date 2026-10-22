import { describe, expect, it } from "vitest";
import { isDuplicatePush, sameQuiz } from "@/lib/push-entry";

describe("isDuplicatePush", () => {
  const previous = { slot: 2, word: null, at: 1000 };

  it("is false without a previous push", () => {
    expect(isDuplicatePush(null, { slot: 2, word: null }, 1000)).toBe(false);
  });

  it("detects the same slot and word within the window", () => {
    expect(isDuplicatePush(previous, { slot: 2, word: null }, 3000)).toBe(true);
    expect(isDuplicatePush(previous, { slot: 2, word: null }, 6000)).toBe(true);
  });

  it("allows the same push after the window", () => {
    expect(isDuplicatePush(previous, { slot: 2, word: null }, 6001)).toBe(false);
    expect(isDuplicatePush(previous, { slot: 2, word: null }, 1500, 100)).toBe(false);
  });

  it("allows a different slot or word", () => {
    expect(isDuplicatePush(previous, { slot: 3, word: null }, 1500)).toBe(false);
    expect(isDuplicatePush(previous, { slot: 2, word: "apple" }, 1500)).toBe(false);
  });
});

describe("sameQuiz", () => {
  const quiz = { aboutSlot: 1, destinationSlot: 2 };

  it("handles nulls", () => {
    expect(sameQuiz(null, null)).toBe(true);
    expect(sameQuiz(quiz, null)).toBe(false);
    expect(sameQuiz(null, quiz)).toBe(false);
  });

  it("compares fields", () => {
    expect(sameQuiz(quiz, { ...quiz })).toBe(true);
    expect(sameQuiz(quiz, { ...quiz, aboutSlot: 2 })).toBe(false);
    expect(sameQuiz(quiz, { ...quiz, destinationSlot: 3 })).toBe(false);
    expect(sameQuiz(quiz, { ...quiz, source: "yesterday-evening" })).toBe(false);
  });
});
