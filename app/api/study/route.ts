import { NextRequest, NextResponse } from "next/server";
import { findCachedWord, getTodayStudy } from "@/lib/app-state";
import { DAILY_SLOTS, isDailySlotReleased } from "@/lib/study-plan";
import { toWordCard } from "@/lib/word-card";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const wordQuery = req.nextUrl.searchParams.get("word");
    const slotParam = req.nextUrl.searchParams.get("slot");
    const slotQuery = slotParam ? Number(slotParam) : null;
    const plan = await getTodayStudy((slots) => {
      if (slotQuery) return slots.some((item) => item.slot === slotQuery) ? slotQuery : null;
      if (wordQuery) {
        return (
          slots.find((item) => item.row.word.toLowerCase() === wordQuery.toLowerCase())?.slot ?? null
        );
      }
      const dueSlots = slots.filter((item) => isDailySlotReleased(item.slot, item.sent));
      const openedDue = dueSlots.filter((item) => item.opened);
      return openedDue.at(-1)?.slot ?? dueSlots[0]?.slot ?? slots[0]?.slot ?? null;
    });

    if (plan.slots.length === 0) {
      return NextResponse.json({ error: "공부할 단어가 없습니다." }, { status: 404 });
    }

    if (slotQuery && !plan.slots.some((item) => item.slot === slotQuery)) {
      return NextResponse.json({ error: "오늘 회차를 찾을 수 없습니다." }, { status: 404 });
    }

    let current = plan.currentSlot
      ? plan.slots.find((item) => item.slot === plan.currentSlot) ?? null
      : null;
    let extraRow = null;

    if (wordQuery && !current) {
      extraRow = await findCachedWord(wordQuery);
      if (!extraRow) {
        return NextResponse.json({ error: "단어를 찾을 수 없습니다." }, { status: 404 });
      }
    }

    const cardRow = current?.row ?? extraRow;
    if (!cardRow) {
      return NextResponse.json({ error: "공부할 단어가 없습니다." }, { status: 404 });
    }

    const slotMeta = Object.fromEntries(DAILY_SLOTS.map((item) => [item.slot, item]));
    const slots = plan.slots.map((item) => ({
      slot: item.slot,
      label: slotMeta[item.slot as 1 | 2 | 3]?.label ?? `${item.slot}회`,
      time: slotMeta[item.slot as 1 | 2 | 3]?.time ?? "",
      word: item.row.word,
      opened: item.opened,
      sent: item.sent,
      card: toWordCard(item.row),
    }));

    return NextResponse.json({
      studyDate: plan.date,
      currentSlot: current?.slot ?? null,
      slots,
      card: toWordCard(cardRow),
      quizzed: plan.quizzed,
      finished: plan.finished,
      previousEvening: plan.previousEvening
        ? {
            date: plan.previousEvening.date,
            opened: plan.previousEvening.opened,
            finished: plan.previousEvening.finished,
            quizzed: plan.previousEvening.quizzed,
            card: toWordCard(plan.previousEvening.row),
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "학습 카드를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
