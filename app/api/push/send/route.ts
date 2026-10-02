// app/api/push/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

// VAPID 키 설정 (환경변수 관리)
const vapidDetails = {
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
  subject: "mailto:admin@example.com",
};

if (vapidDetails.publicKey && vapidDetails.privateKey) {
  webpush.setVapidDetails(
    vapidDetails.subject,
    vapidDetails.publicKey,
    vapidDetails.privateKey
  );
}

export async function POST(req: NextRequest) {
  try {
    const { subscription, title, body, url } = await req.json();

    if (!subscription) {
      return NextResponse.json(
        { error: "구독 정보(Subscription)가 없습니다." },
        { status: 400 }
      );
    }

    const payload = JSON.stringify({
      title: title || "☕ 출근길 3분 단어 코치",
      body: body || "오늘 미팅에서 바로 쓰는 비즈니스 단어 3개를 확인해보세요!",
      icon: "/icons/icon-192x192.png",
      data: {
        url: url || "/",
      },
    });

    await webpush.sendNotification(subscription, payload);

    return NextResponse.json({ success: true, message: "푸시 알림 전송 성공" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "푸시 발송 실패", details: error?.message },
      { status: 500 }
    );
  }
}