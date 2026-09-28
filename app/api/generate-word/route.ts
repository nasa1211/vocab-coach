import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CANDIDATE_MODELS = [
  "gemini-3.7-flash",       // 1순위: 최신 초고속 모델
  "gemini-3.6-flash",       // 2순위: 대체 Flash 모델
  "gemini-3.5-flash",       // 3순위: 검증된 백업 Flash 모델
  "gemini-3.1-pro-preview", // 4순위: 고성능 추론 모델
  "gemini-2.5-pro",         // 5순위: 비상용 안정 버전
];

// 안전한 JSON 파싱 함수 (이스케이프 및 마크다운 백틱 완벽 제거)
function safeJsonParse(rawText: string) {
  let cleanText = rawText.trim();

  // ```json 및 ``` 마크다운 제어
  cleanText = cleanText.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 순수 JSON 객체 부분만 추출 ({ ... })
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleanText);
  } catch (initialError) {
    // 줄바꿈 문자 및 제어 문자 이스케이프 처리 후 재시도
    const fixedText = cleanText
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    return JSON.parse(fixedText);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { word, category = "business", excludeHistory = [] } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ [API ERROR] GEMINI_API_KEY가 Vercel 환경변수에 설정되지 않았습니다.");
      return NextResponse.json(
        { error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 단어 지정 여부에 따른 프롬프트 분기
    const targetInstruction = word
      ? `요청된 단어("${word}")와 카테고리("${category}")에 맞추어 답변하세요.`
      : `카테고리("${category}")에 속하는, 바쁜 직장인에게 유용한 **실전 영단어나 숙어(Idiom) 1개**를 직접 선정하여 답변하세요.`;

    const excludeInstruction =
      !word && Array.isArray(excludeHistory) && excludeHistory.length > 0
        ? `\n[제외할 단어 목록]\n다음 단어들은 이미 학습했으므로 절대로 선택하지 마세요: ${excludeHistory.join(", ")}\n`
        : "";

    const prompt = `
당신은 바쁜 성인을 위한 실전 영단어 AI 멘토입니다.
${targetInstruction}${excludeInstruction}
오직 순수 JSON 형식으로만 답변하세요. 다른 설명이나 마크다운 백틱(\`\`\`json)은 절대로 포함하지 마세요.

==================================================
[성인 학습자 콘텐츠 제공 원칙]
==================================================
1. 사전적 정의보다는 실제 직장, 비즈니스 이메일, 해외 여행, 현지 슬랭 등 실전에서 쓰이는 "뉘앙스(Nuance)"에 집중하세요.
2. 예문(example_sentence)은 바쁜 직장인들이 출퇴근길에 3초 만에 이해할 수 있는 자연스럽고 유용한 문장이어야 합니다.
3. 발음 및 억양 가이드(speaking_tip)에는 원어민 연음이나 강조할 억양 포인트(예: "touch base는 연속해서 '터치베이스'처럼 부드럽게 연결하세요")를 포함하세요.

==================================================
[JSON 반환 스키마]
==================================================
{
  "word": "단어 또는 숙어명",
  "phonetic": "발음기호 (예: /fəʊkəs/)",
  "meaning": "핵심 한글 뜻",
  "category": "${category}",
  "nuance": "성인을 위한 실전 뉘앙스 및 사전적 뜻과의 차이점 설명",
  "example_sentence": "실전 영문 예문",
  "example_translation": "자연스러운 한글 번역",
  "speaking_tip": "원어민 발음 및 억양 팁",
  "quick_quiz": {
    "question": "단어 활용 간단 퀴즈 (빈칸 채우기 등)",
    "options": ["보기1", "보기2", "보기3"],
    "answer_index": 0,
    "explanation": "해설"
  }
}
`;

    let lastError: any = null;
    let parsedData = null;

    // CANDIDATE_MODELS 순차적으로 시도 (Fallback)
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
        });

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        if (responseText) {
          parsedData = safeJsonParse(responseText);
          break; // 성공 시 루프 탈출
        }
      } catch (err: any) {
        console.warn(`⚠️ [Gemini Fallback Warning] ${modelName} 호출 실패:`, err?.message || err);
        lastError = err;
      }
    }

    if (!parsedData) {
      console.error("❌ [API ERROR] 모든 Gemini 모델 생성 연쇄 실패:", lastError?.message || lastError);
      return NextResponse.json(
        { error: "단어 분석 생성 실패", details: lastError?.message || "All models failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("❌ [API ERROR] /api/generate-word 예외 발생:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}