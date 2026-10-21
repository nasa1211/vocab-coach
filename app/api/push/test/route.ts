import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getClientIp } from "@/lib/api-auth";
import { listSubscriptions } from "@/lib/app-state";
import { getVapidConfig } from "@/lib/env-config";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const TEST_PUSH_RATE_LIMIT = { requests: 3, window: 60 * 1000 };

const TEST_PAYLOAD = {
  title: "학습 알림이 켜졌습니다",
  body: "아침 8시, 낮 1시, 저녁 6시에 단어와 예문이 도착합니다.",
  icon: "/icons/icon-192x192.png",
  data: { url: "/?tab=today" },
};

let vapidInitialized = false;
function ensureVapidInit() {
  if (vapidInitialized) return;
  const config = getVapidConfig();
  webpush.setVapidDetails(`mailto:${config.email}`, config.publicKey, config.privateKey);
  vapidInitialized = true;
}

/**
 * 구독 직후 확인 알림 전용. 이미 저장된 구독에만, 서버에 고정된 문구로만 보낸다.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`push-test:${ip}`, TEST_PUSH_RATE_LIMIT).success) {
      return NextResponse.json({ error: "요청이 너무 많습니다." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const endpoint = body?.subscription?.endpoint;
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "유효하지 않은 구독 정보입니다." }, { status: 400 });
    }

    const saved = (await listSubscriptions()).find((s) => s.endpoint === endpoint);
    if (!saved) {
      return NextResponse.json({ error: "등록되지 않은 구독입니다." }, { status: 404 });
    }

    ensureVapidInit();
    await webpush.sendNotification(
      { endpoint: saved.endpoint, keys: { p256dh: saved.p256dh, auth: saved.auth } },
      JSON.stringify(TEST_PAYLOAD)
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "푸시 발송 실패";
    return NextResponse.json({ error: "푸시 발송 실패", details: message }, { status: 500 });
  }
}
