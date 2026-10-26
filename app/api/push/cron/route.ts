import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { getTodayPlan, listSubscriptions, markSent, removeSubscription } from "@/lib/app-state";
import { getVapidConfig } from "@/lib/env-config";

export const dynamic = "force-dynamic";

let vapidInitialized = false;

function ensureVapidInit() {
  if (vapidInitialized) return;
  const config = getVapidConfig();
  webpush.setVapidDetails(`mailto:${config.email}`, config.publicKey, config.privateKey);
  vapidInitialized = true;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "인증 실패" }, { status: 401 });
    }

    const slot = Number(req.nextUrl.searchParams.get("slot") || "");
    if (![1, 2, 3].includes(slot)) {
      return NextResponse.json({ error: "slot은 1, 2, 3 중 하나여야 합니다." }, { status: 400 });
    }

    ensureVapidInit();

    const plan = await getTodayPlan();
    const item = plan.slots.find((entry) => entry.slot === slot);
    if (!item) {
      return NextResponse.json({ error: "이 회차에 보낼 단어가 없습니다." }, { status: 404 });
    }

    const subscriptions = await listSubscriptions();
    if (subscriptions.length === 0) {
      return NextResponse.json({
        message: "저장된 푸시 구독이 없습니다.",
        slot,
        word: item.row.word,
      });
    }

    const payload = JSON.stringify({
      title: item.row.word,
      body: (item.row.example_sentence || item.row.meaning || "").slice(0, 180),
      data: {
        url: `${req.nextUrl.origin}/?tab=today&slot=${slot}&date=${plan.date}`,
      },
    });

    let sent = 0;
    let failed = 0;
    const expired: string[] = [];

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = typeof error === "object" && error && "statusCode" in error ? error.statusCode : 0;
        if (statusCode === 404 || statusCode === 410) expired.push(subscription.endpoint);
      }
    }

    for (const endpoint of expired) {
      await removeSubscription(endpoint);
    }
    if (sent > 0) {
      await markSent(plan.date, slot);
    }

    return NextResponse.json({
      success: sent > 0,
      slot,
      word: item.row.word,
      sent,
      failed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "푸시 발송에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
