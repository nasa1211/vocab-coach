import { NextRequest, NextResponse } from "next/server";
import { getTodayPlan, markFinished } from "@/lib/app-state";
import { parseDeviceId } from "@/lib/device-id";
import { getKSTDateString } from "@/lib/kst";
import { isDailySlotReleased } from "@/lib/study-plan";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { slot, device } = await req.json();
    const slotNumber = Number(slot);
    const deviceId = parseDeviceId(device);
    if (slotNumber !== 3) {
      return NextResponse.json({ error: "하루 완료는 저녁 카드에서 저장합니다." }, { status: 400 });
    }
    if (!deviceId) {
      return NextResponse.json({ error: "기기를 확인할 수 없습니다." }, { status: 400 });
    }
    const plan = await getTodayPlan();
    const item = plan.slots.find((entry) => entry.slot === slotNumber);
    if (!item || !isDailySlotReleased(slotNumber, item.sent)) {
      return NextResponse.json({ error: "아직 열리지 않은 회차입니다." }, { status: 403 });
    }

    await markFinished(getKSTDateString(), slotNumber, deviceId);
    return NextResponse.json({ success: true, slot: slotNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "완료 표시를 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
