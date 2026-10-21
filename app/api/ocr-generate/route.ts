import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MODEL_NAME } from '@/lib/gemini';
import { getDeviceIdFromHeader } from '@/lib/api-auth';
import { rateLimit, AI_RATE_LIMIT } from '@/lib/rate-limit';
import { getGeminiApiKey } from '@/lib/env-config';

export async function POST(req: NextRequest) {
  try {
    // Require device ID
    const deviceId = getDeviceIdFromHeader(req);
    if (!deviceId) {
      return NextResponse.json(
        { error: '유효한 기기 ID 헤더(X-Device-Id)가 필요합니다.' },
        { status: 401 }
      );
    }

    // Rate limit per device
    const { success, remaining } = rateLimit(deviceId, AI_RATE_LIMIT);
    if (!success) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '이미지 데이터가 없습니다.' }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();

    // 1. Base64 및 MIME Type 동적 분리
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      base64Data = parts[1];
    }

    // 2. GoogleGenerativeAI SDK 초기화 및 모델 선택
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

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

    // 3. SDK를 통한 이미지 분석 요청
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
    ]);

    const textResult = result.response.text();

    if (!textResult) {
      throw new Error('AI가 이미지에서 단어를 추출하지 못했습니다.');
    }

    const wordData = JSON.parse(textResult);
    return NextResponse.json(wordData, {
      status: 200,
      headers: { 'X-RateLimit-Remaining': remaining.toString() },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '이미지에서 단어를 추출하지 못했습니다.';
    console.error('❌ [OCR API Exception]:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}