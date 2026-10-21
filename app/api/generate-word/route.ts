import { NextRequest, NextResponse } from "next/server";
import { generateStudyWords } from "@/lib/generate-study-words";
import { getDeviceIdFromHeader } from "@/lib/api-auth";
import { rateLimit, AI_RATE_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Require device ID
    const deviceId = getDeviceIdFromHeader(req);
    if (!deviceId) {
      return NextResponse.json(
        { error: "유효한 기기 ID 헤더(X-Device-Id)가 필요합니다." },
        { status: 401 }
      );
    }

    // Rate limit per device
    const { success, remaining } = rateLimit(deviceId, AI_RATE_LIMIT);
    if (!success) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
      );
    }

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
    return NextResponse.json(generated, {
      status: 200,
      headers: { "X-RateLimit-Remaining": remaining.toString() },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "서버 내부 오류";
    console.error("❌ [API EXCEPTION]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}