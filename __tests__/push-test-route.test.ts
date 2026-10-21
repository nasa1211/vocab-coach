import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) },
}));
vi.mock("@/lib/env-config", () => ({
  getVapidConfig: () => ({ email: "a@b.c", publicKey: "pub", privateKey: "priv" }),
}));
vi.mock("@/lib/app-state", () => ({
  listSubscriptions: async () => [{ endpoint: "https://push/known", p256dh: "p", auth: "a" }],
}));

import { POST } from "@/app/api/push/test/route";

let ipCounter = 0;
function req(body: unknown, ip = `10.0.0.${++ipCounter}`) {
  return new NextRequest("http://localhost/api/push/test", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/push/test", () => {
  beforeEach(() => sendNotification.mockReset());

  it("저장된 구독에 고정 문구를 보낸다", async () => {
    const res = await POST(req({ subscription: { endpoint: "https://push/known" }, title: "hack" }));
    expect(res.status).toBe(200);
    const [sub, payload] = sendNotification.mock.calls[0];
    expect(sub).toEqual({ endpoint: "https://push/known", keys: { p256dh: "p", auth: "a" } });
    const parsed = JSON.parse(payload);
    expect(parsed.title).toBe("학습 알림이 켜졌습니다");
    expect(parsed.data.url).toBe("/?tab=today");
  });

  it("등록되지 않은 구독은 404", async () => {
    const res = await POST(req({ subscription: { endpoint: "https://evil" } }));
    expect(res.status).toBe(404);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("구독 정보가 없으면 400", async () => {
    expect((await POST(req({}))).status).toBe(400);
  });

  it("레이트 리밋 초과 시 429", async () => {
    const ip = "192.168.1.1";
    for (let i = 0; i < 3; i++) await POST(req({}, ip));
    expect((await POST(req({}, ip))).status).toBe(429);
  });
});
