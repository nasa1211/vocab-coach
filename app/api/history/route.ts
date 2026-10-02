import { NextResponse } from "next/server";
import { listPastDays } from "@/lib/app-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const days = await listPastDays();
    return NextResponse.json({ days });
  } catch (error) {
    const message = error instanceof Error ? error.message : "지난 단어를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
