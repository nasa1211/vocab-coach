import { NextRequest, NextResponse } from "next/server";
import { getTodayPlan, markOpened } from "@/lib/app-state";
import { getKSTDateString } from "@/lib/kst";
import { isDailySlotReleased } from "@/lib/study-plan";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { slot } = await req.json();
    const slotNumber = Number(slot);
    if (![1, 2, 3].includes(slotNumber)) {
      return NextResponse.json({ error: "slot은 1, 2, 3 중 하나여야 합니다." }, { status: 400 });
    }
    const plan = await getTodayPlan();
    const item = plan.slots.find((entry) => entry.slot === slotNumber);
    if (!item || !isDailySlotReleased(slotNumber, item.sent)) {
      return NextResponse.json({ error: "아직 열리지 않은 회차입니다." }, { status: 403 });
    }

    await markOpened(getKSTDateString(), slotNumber);
    return NextResponse.json({ success: true, slot: slotNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "학습 표시를 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
