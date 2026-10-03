import { NextRequest, NextResponse } from "next/server";
import { markQuizAnswer } from "@/lib/app-state";
import { getKSTDateString, shiftIsoDate } from "@/lib/kst";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { slot, date, selected } = await req.json();
    const slotNumber = Number(slot);
    const selectedIndex = Number(selected);
    if (![1, 2, 3].includes(slotNumber)) {
      return NextResponse.json({ error: "slot은 1, 2, 3 중 하나여야 합니다." }, { status: 400 });
    }

    const today = getKSTDateString();
    const yesterday = shiftIsoDate(today, -1);
    const studyDate = date === yesterday ? yesterday : today;
    if (studyDate === yesterday && slotNumber !== 3) {
      return NextResponse.json({ error: "어제 기록은 저녁 퀴즈만 저장합니다." }, { status: 400 });
    }

    const saved = await markQuizAnswer(studyDate, slotNumber, selectedIndex);
    if (!saved) {
      return NextResponse.json({ error: "퀴즈 선택을 확인할 수 없습니다." }, { status: 400 });
    }
    return NextResponse.json({ success: true, slot: slotNumber, date: studyDate, correct: saved.correct });
  } catch (error) {
    const message = error instanceof Error ? error.message : "퀴즈 기록을 저장하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
