import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CANDIDATE_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { word, category = "business", excludeHistory = [] } = body;

    const historyList = Array.isArray(excludeHistory) ? excludeHistory.filter(Boolean) : [];

    // ------------------------------------------------------------------
    // STEP 1. Supabase DB에서 우선 조회 (0.01초 초고속 반환)
    // ------------------------------------------------------------------
    console.time("⏱️ [DB Query Time]");
    let query = supabase.from("words").select("*");

    if (word) {
      query = query.ilike("word", word); // 대소문자 무시검색
    } else {
      // 카테고리 지정 시 대소문자 무시 검색 (ilike)
      if (category) {
        query = query.ilike("category", category);
      }
      
      // 이미 학습한 단어 제외 (Postgres IN format)
      if (historyList.length > 0) {
        const formattedHistory = historyList.map(w => `"${w.replace(/"/g, '""')}"`).join(",");
        query = query.not("word", "in", `(${formattedHistory})`);
      }
    }

    const { data: dbWords, error: dbError } = await query.limit(30);
    console.timeEnd("⏱️ [DB Query Time]");

    if (dbError) {
      console.error("❌ [DB ERROR] Supabase 쿼리 오류:", dbError.message, dbError.details);
    } else {
      console.log(`📊 [DB RESULT] 조회된 단어 수: ${dbWords?.length || 0}개`);
    }

    // DB 데이터가 존재하는 경우 즉시 반환
    if (!dbError && dbWords && dbWords.length > 0) {
      const randomWord = dbWords[Math.floor(Math.random() * dbWords.length)];
      console.log(`✅ [DB SUCCESS] 단어 선택됨: "${randomWord.word}" (소요시간: ${Date.now() - startTime}ms)`);
      return NextResponse.json(randomWord, { status: 200 });
    }

    // ------------------------------------------------------------------
    // STEP 2. Fallback: DB 데이터가 없을 때만 Gemini AI 생성
    // ------------------------------------------------------------------
    console.warn(`⚠️ [FALLBACK START] DB 결과 없음. Gemini AI 생성을 시도합니다... (요청 category: ${category})`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DB 단어 없음 & GEMINI_API_KEY 미설정" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const targetInstruction = word
      ? `요청된 단어("${word}")와 카테고리("${category}")에 맞추어 답변하세요.`
      : `카테고리("${category}")에 속하는 실용적인 영단어/숙어 중 새로운 표현 1개를 추천하세요.`;

    const excludeInstruction =
      !word && historyList.length > 0
        ? `\n\n[🚨 제외 목록]\n- ${historyList.join("\n- ")}\n`
        : "";

    const prompt = `
당신은 바쁜 성인을 위한 실전 영단어 AI 멘토입니다.
${targetInstruction}${excludeInstruction}

==================================================
[JSON 반환 스키마]
==================================================
{
  "word": "단어 또는 숙어명",
  "phonetic": "발음기호 (예: /fəʊkəs/)",
  "meaning": "핵심 한글 뜻",
  "category": "${category}",
  "nuance": "실전 뉘앙스 설명",
  "example_sentence": "영문 예문",
  "example_translation": "한글 번역",
  "speaking_tip": "원어민 발음 팁",
  "quick_quiz": {
    "question": "간단 퀴즈",
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
        console.time(`⏱️ [AI Query - ${modelName}]`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.8,
            responseMimeType: "application/json",
          },
        });

        const result = await model.generateContent(prompt);
        console.timeEnd(`⏱️ [AI Query - ${modelName}]`);

        const responseText = result.response.text();

        if (responseText) {
          parsedData = JSON.parse(responseText);
          break;
        }
      } catch (err: any) {
        console.warn(`⚠️ [Gemini Fail] ${modelName}:`, err?.message || err);
        lastError = err;
      }
    }

    if (!parsedData) {
      return NextResponse.json(
        { error: "단어 생성 실패", details: lastError?.message },
        { status: 500 }
      );
    }

    console.log(`✅ [AI SUCCESS] 생성 완료: "${parsedData.word}" (총 소요시간: ${Date.now() - startTime}ms)`);
    return NextResponse.json(parsedData, { status: 200 });

  } catch (error: any) {
    console.error("❌ [API EXCEPTION]", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "서버 내부 오류" },
      { status: 500 }
    );
  }
}