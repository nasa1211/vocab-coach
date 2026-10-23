// app/api/push/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { verifyServerSecret } from "@/lib/api-auth";
import { getVapidConfig } from "@/lib/env-config";

let vapidInitialized = false;

function ensureVapidInit() {
  if (vapidInitialized) return;
  const config = getVapidConfig();
  webpush.setVapidDetails(`mailto:${config.email}`, config.publicKey, config.privateKey);
  vapidInitialized = true;
}

export async function POST(req: NextRequest) {
  try {
    // Require server secret authentication
    if (!verifyServerSecret(req)) {
      return NextResponse.json(
        { error: "인증 실패. 서버 시크릿이 필요합니다." },
        { status: 401 }
      );
    }

    ensureVapidInit();

    const { subscription, title, body, url } = await req.json();

    if (!subscription) {
      return NextResponse.json(
        { error: "구독 정보(Subscription)가 없습니다." },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: title || "☕ 출근길 3분 단어 코치",
      body: body || "오늘의 쉬운 실전 영어 단어를 확인해보세요!",
      icon: "/icons/icon-192x192.png",
      data: {
        url: url || "/",
      },
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true, message: "푸시 알림 전송 성공" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "푸시 발송 실패";
    return NextResponse.json(
      { error: "푸시 발송 실패", details: message },
      { status: 500 }
    );
  }
}