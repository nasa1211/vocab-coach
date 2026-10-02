import { NextRequest, NextResponse } from "next/server";
import { generateStudyWords } from "@/lib/generate-study-words";
// DB 단어 조회는 lib/db-words.ts의 lookupWordsInDatabase에 유지한다.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const { word, category = "English", excludeHistory = [] } = body;
    const historyList = Array.isArray(excludeHistory) ? excludeHistory.filter(Boolean) : [];
    const [generated] = await generateStudyWords({
      count: 1,
      word,
      category,
      exclude: historyList,
    });

    console.log(`✅ [AI SUCCESS] 생성 완료: "${generated.word}" (총 소요시간: ${Date.now() - startTime}ms)`);
    return NextResponse.json(generated, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 내부 오류";
    console.error("❌ [API EXCEPTION]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}