import { NextRequest, NextResponse } from "next/server";
import { removeSubscription, saveSubscription } from "@/lib/app-state";
import { detectPushPlatform, truncateUserAgent } from "@/lib/push-platform";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscription, client } = body ?? {};

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "유효하지 않은 구독 정보입니다." }, { status: 400 });
    }

    const userAgent = truncateUserAgent(req.headers.get("user-agent") ?? "");
    const platform = detectPushPlatform(userAgent, client);

    await saveSubscription({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      platform,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "푸시 구독이 저장되었습니다.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "구독 저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "구독 주소가 없습니다." }, { status: 400 });
    }

    await removeSubscription(endpoint);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "구독 해제에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
