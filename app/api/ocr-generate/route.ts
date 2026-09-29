import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 1. 순차적으로 시도할 후보 모델 목록
const CANDIDATE_MODELS = [
  "gemini-2.5-pro",
  "gemini-3.6-flash",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

export async function POST(req: Request) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '이미지 데이터가 없습니다.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    // Base64 및 MIME Type 분리
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      base64Data = parts[1];
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `Analyze the uploaded image (book page, email, document, or sign). 
Extract ONE key high-value English word or business idiom that is most useful for adult learners.

Respond STRICTLY in JSON format matching this schema:
{
  "word": "Extracted word or phrase",
  "phonetic": "/Phonetic symbol/",
  "meaning": "한국어 핵심 뜻 (직장인/성인 맞춤)",
  "category": "Business / Daily / Idiom 중 적절한 카테고리",
  "nuance": "사전적 의미와 실제 쓰임새의 차이 및 비즈니스 뉘앙스 설명 (한국어 2-3문장)",
  "example_sentence": "이미지 맥락 또는 실전에서 쓸 수 있는 영어 예문",
  "example_translation": "예문 한국어 번역",
  "speaking_tip": "원어민처럼 자연스럽게 발음하거나 사용하는 팁",
  "quick_quiz": {
    "question": "단어와 관련된 간단한 3초 퀴즈 질문",
    "options": ["보기1", "보기2", "보기3"],
    "answer_index": 0,
    "explanation": "해설"
  }
}`;

    let textResult: string | null = null;
    let lastError: any = null;

    // 2. 후보 모델 순회 시도 (404 완벽 방지)
    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
        ]);

        textResult = result.response.text();
        if (textResult) {
          console.log(`✅ [OCR SUCCESS] 성공한 모델: ${modelName}`);
          break; // 성공 시 반복문 탈출
        }
      } catch (err: any) {
        console.warn(`⚠️ [Gemini Model Fail] ${modelName}:`, err?.message || err);
        lastError = err;
      }
    }

    if (!textResult) {
      throw new Error(`모든 Gemini 모델 시도 실패. 마지막 에러: ${lastError?.message}`);
    }

    const wordData = JSON.parse(textResult);
    return NextResponse.json(wordData, { status: 200 });

  } catch (error: any) {
    console.error('❌ [OCR API Exception]:', error.message || error);
    return NextResponse.json(
      { error: error.message || '이미지에서 단어를 추출하지 못했습니다.' },
      { status: 500 }
    );
  }
}