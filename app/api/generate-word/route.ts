import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Supabase 클라이언트 초기화
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Gemini fallback 모델 목록
const CANDIDATE_MODELS = [
  "gemini-3.7-flash",       // 1순위: 최신 초고속 모델
  "gemini-3.6-flash",       // 2순위: 대체 Flash 모델
  "gemini-3.5-flash",       // 3순위: 검증된 백업 Flash 모델
  "gemini-3.1-pro-preview", // 4순위: 고성능 추론 모델
  "gemini-2.5-pro",         // 5순위: 비상용 안정 버전
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { word, category = "business", excludeHistory = [] } = body;

    const historyList = Array.isArray(excludeHistory) ? excludeHistory.filter(Boolean) : [];

    // ------------------------------------------------------------------
    // STEP 1. Supabase DB에서 우선 조회 (0.01초 초고속 반환)
    // ------------------------------------------------------------------
    let query = supabase.from("words").select("*");

    if (word) {
      // 특정 단어가 지정된 경우
      query = query.eq("word", word);
    } else {
      // 카테고리 필터링
      if (category) {
        query = query.eq("category", category);
      }
      // 이미 학습한 단어 제외
      if (historyList.length > 0) {
        query = query.not("word", "in", `(${historyList.map((w) => `"${w}"`).join(",")})`);
      }
    }

    const { data: dbWords, error: dbError } = await query.limit(20);

    if (!dbError && dbWords && dbWords.length > 0) {
      // 랜덤으로 1개 선택하여 반환
      const randomWord = dbWords[Math.floor(Math.random() * dbWords.length)];
      return NextResponse.json(randomWord, { status: 200 });
    }

    // ------------------------------------------------------------------
    // STEP 2. DB에 조건에 맞는 단어가 없을 경우 Gemini API로 실시간 생성 (Fallback)
    // ------------------------------------------------------------------
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DB에서 단어를 찾지 못했으나 GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const targetInstruction = word
      ? `요청된 단어("${word}")와 카테고리("${category}")에 맞추어 답변하세요.`
      : `카테고리("${category}")에 속하는, 직장인에게 실용적인 비즈니스 영단어나 숙어(Idiom) 중 **이전과 겹치지 않는 새로운 표현 1개**를 랜덤하게 선택하여 답변하세요.`;

    const excludeInstruction =
      !word && historyList.length > 0
        ? `\n\n[🚨 절대 금지 단어 목록]\n다음 목록에 있는 단어/표현은 이미 학습했으므로 **절대로 다시 추천하지 마세요**:\n- ${historyList.join("\n- ")}\n`
        : "";

    const prompt = `
당신은 바쁜 성인을 위한 실전 영단어 AI 멘토입니다.
${targetInstruction}${excludeInstruction}

==================================================
[성인 학습자 콘텐츠 제공 원칙]
==================================================
1. 사전적 정의보다는 실제 직장, 비즈니스 이메일, 회의 등 실전에서 쓰이는 "뉘앙스(Nuance)"에 집중하세요.
2. 예문(example_sentence)은 출퇴근길에 3초 만에 이해할 수 있는 자연스럽고 유용한 문장이어야 합니다.
3. 발음 및 억양 가이드(speaking_tip)에는 원어민 연음이나 강조할 억양 포인트를 포함하세요.

==================================================
[JSON 반환 스키마]
==================================================
{
  "word": "단어 또는 숙어명",
  "phonetic": "발음기호 (예: /fəʊkəs/)",
  "meaning": "핵심 한글 뜻",
  "category": "${category}",
  "nuance": "성인을 위한 실전 뉘앙스 설명",
  "example_sentence": "실전 영문 예문",
  "example_translation": "자연스러운 한글 번역",
  "speaking_tip": "원어민 발음 및 억양 팁",
  "quick_quiz": {
    "question": "단어 활용 간단 퀴즈",
    "options": ["보기1", "보기2", "보기3"],
    "answer_index": 0,
    "explanation": "해설"
  }
}
`;

    let parsedData = null;
    let lastError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            responseMimeType: "application/json", // JSON 모드 강제 적용
          },
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        if (responseText) {
          parsedData = JSON.parse(responseText);

          if (!word && historyList.map((w: string) => w.toLowerCase()).includes(parsedData?.word?.toLowerCase())) {
            parsedData = null;
            continue;
          }

          break;
        }
      } catch (err: any) {
        console.warn(`⚠️ [Gemini Fallback Warning] ${modelName} 호출 실패:`, err?.message || err);
        lastError = err;
      }
    }

    if (!parsedData) {
      return NextResponse.json(
        { error: "단어 분석 생성 실패", details: lastError?.message || "All models failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedData, { status: 200 });

  } catch (error: any) {
    console.error("❌ [API ERROR] /api/generate-word 예외 발생:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}