import { describe, expect, it } from "vitest";
import {
  buildDailyPushMessage,
  buildPushSummary,
  parsePushSummary,
  pushHost,
  PUSH_FALLBACK_BODY,
  PUSH_TITLE,
} from "@/lib/push-message";

const emoji = /\p{Extended_Pictographic}/u;

describe("buildDailyPushMessage", () => {
  it("lists all words with short meanings", () => {
    const msg = buildDailyPushMessage([
      { word: "validity", meaning: "타당성, 유효성" },
      { word: "thorough", meaning: "철저한" },
      { word: "infrastructure", meaning: "기반 시설" },
    ]);
    expect(msg.title).toBe(PUSH_TITLE);
    expect(msg.body).toBe("오늘의 단어: validity, 타당성. thorough, 철저한. infrastructure, 기반 시설.");
    expect(emoji.test(msg.title + msg.body)).toBe(false);
  });
  it("handles missing meaning", () => {
    expect(buildDailyPushMessage([{ word: "a", meaning: null }]).body).toBe("오늘의 단어: a.");
  });
  it("falls back without emoji", () => {
    for (const input of [null, undefined, [], [{ word: " " }]]) {
      const msg = buildDailyPushMessage(input);
      expect(msg.body).toBe(PUSH_FALLBACK_BODY);
      expect(emoji.test(msg.title + msg.body)).toBe(false);
    }
  });
});

describe("push summary", () => {
  it("extracts host only", () => {
    expect(pushHost("https://web.push.apple.com/secret-token")).toBe("web.push.apple.com");
    expect(pushHost("bad")).toBe("unknown");
  });
  it("builds and parses without extra fields", () => {
    const s = buildPushSummary("2026-11-02", 1, [{ host: "h", statusCode: 201 }], 1, 0, "t");
    expect(parsePushSummary(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parsePushSummary({ date: 1 })).toBeNull();
  });
});
