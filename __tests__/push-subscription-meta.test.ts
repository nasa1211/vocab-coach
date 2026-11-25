import { describe, expect, it } from "vitest";
import { SUBSCRIPTION_META_REFRESH_MS, subscriptionNeedsMetaRefresh, type PushSubscriptionRecord } from "@/lib/app-state";
import { detectPushPlatform, truncateUserAgent } from "@/lib/push-platform";

describe("push subscription meta", () => {
  const base: PushSubscriptionRecord = {
    endpoint: "https://push/x",
    p256dh: "p",
    auth: "a",
    platform: "ios-safari",
    userAgent: "Safari",
    lastSeenAt: new Date().toISOString(),
  };

  it("detects client platforms", () => {
    expect(detectPushPlatform("Mozilla/5.0 (iPhone)", { standalone: true })).toBe("ios-pwa");
    expect(detectPushPlatform("Mozilla/5.0 (iPhone)", null)).toBe("ios-safari");
    expect(detectPushPlatform("Mozilla/5.0 (Android)", { standalone: true })).toBe("android-pwa");
    expect(detectPushPlatform("Mozilla/5.0 (Macintosh)", null)).toBe("macos");
  });

  it("truncates user agent", () => {
    expect(truncateUserAgent("x".repeat(600)).length).toBe(512);
  });

  it("refreshes meta when stale or changed", () => {
    const now = Date.parse("2026-11-25T12:00:00.000Z");
    expect(subscriptionNeedsMetaRefresh({ ...base, lastSeenAt: undefined }, {}, now)).toBe(true);
    expect(
      subscriptionNeedsMetaRefresh(base, { platform: "ios-pwa" }, now)
    ).toBe(true);
    const fresh = new Date(now - SUBSCRIPTION_META_REFRESH_MS + 1000).toISOString();
    expect(subscriptionNeedsMetaRefresh({ ...base, lastSeenAt: fresh }, {}, now)).toBe(false);
    const stale = new Date(now - SUBSCRIPTION_META_REFRESH_MS - 1).toISOString();
    expect(subscriptionNeedsMetaRefresh({ ...base, lastSeenAt: stale }, {}, now)).toBe(true);
  });
});