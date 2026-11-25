import { describe, expect, it } from "vitest";
import {
  buildCronPushPayload,
  buildPushSummary,
  parsePushSummary,
  pushHost,
  pushSendOptions,
  pushTag,
  pushTopic,
  topicFromPushUrl,
} from "@/lib/push-message";

describe("push summary", () => {
  it("extracts host only", () => {
    expect(pushHost("https://web.push.apple.com/secret-token")).toBe("web.push.apple.com");
    expect(pushHost("bad")).toBe("unknown");
  });
  it("topic and tag follow web-push limits", () => {
    expect(pushTopic("2026-11-25", 1)).toBe("vocab-2026-11-25-s1");
    expect(pushTag("2026-11-25", 2)).toBe("vocab-2026-11-25-slot-2");
    expect(pushSendOptions(pushTopic("2026-11-25", 1))).toEqual({
      urgency: "high",
      topic: "vocab-2026-11-25-s1",
    });
    const payload = JSON.parse(buildCronPushPayload("word", "body", "/?date=2026-11-25&slot=1", "2026-11-25", 1));
    expect(payload.tag).toBe("vocab-2026-11-25-slot-1");
    expect(payload.data.tag).toBe(payload.tag);
    expect(topicFromPushUrl("/?tab=today&slot=2&date=2026-11-25")).toBe("vocab-2026-11-25-s2");
    expect(topicFromPushUrl("/")).toBe("vocab-manual-send");
  });

  it("builds and parses without extra fields", () => {
    const s = buildPushSummary("2026-11-02", 1, [{ host: "h", statusCode: 201 }], 1, 0, "t");
    expect(parsePushSummary(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parsePushSummary({ date: 1 })).toBeNull();
  });
});
