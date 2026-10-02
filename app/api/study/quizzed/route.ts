import { NextRequest, NextResponse } from "next/server";
import { markQuizzed } from "@/lib/app-state";
import { getKSTDateString } from "@/lib/kst";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { slot } = await req.json();
    const slotNumber = Number(slot);
    if (![1, 2, 3].includes(slotNumber)) {
      return NextResponse.json({ error: "slot은 1, 2, 3 중 하나여야 합니다." }, { status: 400 });
    }

    await markQuizzed(getKSTDateString(), slotNumber);
    return NextResponse.json({ success: true, slot: slotNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "퀴즈 기록을 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
