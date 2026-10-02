import { NextRequest, NextResponse } from "next/server";
import { findCachedWord, getTodayPlan, markOpened } from "@/lib/app-state";
import { DAILY_SLOTS } from "@/lib/study-plan";
import { toWordCard } from "@/lib/word-card";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const wordQuery = req.nextUrl.searchParams.get("word");
    const slotParam = req.nextUrl.searchParams.get("slot");
    const slotQuery = slotParam ? Number(slotParam) : null;
    const plan = await getTodayPlan();

    if (plan.slots.length === 0) {
      return NextResponse.json({ error: "공부할 단어가 없습니다." }, { status: 404 });
    }

    let current = null;
    let extraRow = null;

    if (slotQuery) {
      current = plan.slots.find((item) => item.slot === slotQuery) ?? null;
      if (!current) {
        return NextResponse.json({ error: "오늘 회차를 찾을 수 없습니다." }, { status: 404 });
      }
    } else if (wordQuery) {
      current =
        plan.slots.find((item) => item.row.word.toLowerCase() === wordQuery.toLowerCase()) ?? null;
      if (!current) {
        extraRow = await findCachedWord(wordQuery);
        if (!extraRow) {
          return NextResponse.json({ error: "단어를 찾을 수 없습니다." }, { status: 404 });
        }
      }
    } else {
      current = plan.slots.find((item) => !item.opened) ?? plan.slots[0];
    }

    if (current) {
      await markOpened(plan.date, current.slot);
      current.opened = true;
    }

    const cardRow = current?.row ?? extraRow;
    if (!cardRow) {
      return NextResponse.json({ error: "공부할 단어가 없습니다." }, { status: 404 });
    }

    const card = toWordCard(cardRow);
    const slotMeta = Object.fromEntries(DAILY_SLOTS.map((item) => [item.slot, item]));

    return NextResponse.json({
      studyDate: plan.date,
      currentSlot: current?.slot ?? null,
      slots: plan.slots.map((item) => ({
        slot: item.slot,
        label: slotMeta[item.slot as 1 | 2 | 3]?.label ?? `${item.slot}회`,
        time: slotMeta[item.slot as 1 | 2 | 3]?.time ?? "",
        word: item.row.word,
        opened: item.opened,
        sent: item.sent,
      })),
      card,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "학습 카드를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
