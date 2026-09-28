import { NextResponse } from 'next/server';

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

    // 1. Data URL에서 동적으로 MIME Type 및 순수 Base64 데이터 추출
    let mimeType = 'image/jpeg';
    let base64Data = imageBase64;

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      base64Data = parts[1];
    }

    // 2. Gemini API 호출 (1.5-flash)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: `Analyze the uploaded image (book page, email, document, or sign). 
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
}`,
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.2, // OCR 및 규격 추출을 위해 낮은 temperature 권장
          },
        }),
      }
    );

    const result = await response.json();

    // 3. HTTP 응답 상태 및 Gemini API 내부 에러 체크
    if (!response.ok) {
      console.error('❌ [Gemini API HTTP Error]:', response.status, JSON.stringify(result, null, 2));
      throw new Error(`Gemini API Error (${response.status}): ${result.error?.message || 'Unknown error'}`);
    }

    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      console.error('❌ [Gemini API No Candidate Error]:', JSON.stringify(result, null, 2));
      throw new Error('AI가 이미지에서 단어를 추출하지 못했거나 안전 필터에 의해 차단되었습니다.');
    }

    const wordData = JSON.parse(textResult);
    return NextResponse.json(wordData, { status: 200 });

  } catch (error: any) {
    console.error('❌ [OCR API Handler Exception]:', error.message || error);
    return NextResponse.json(
      { error: error.message || '이미지에서 단어를 추출하지 못했습니다.' },
      { status: 500 }
    );
  }
}