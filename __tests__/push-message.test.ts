import { describe, expect, it } from "vitest";
import { buildPushSummary, parsePushSummary, pushHost } from "@/lib/push-message";

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
