import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { MODEL_NAME } from '../lib/gemini.ts';

// .env.local 환경변수 로드
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 💡 주의: 대량 입력 시 RLS를 우회하려면 SUPABASE_SERVICE_ROLE_KEY 사용을 권장하며, 
// 없을 경우 NEXT_PUBLIC_SUPABASE_ANON_KEY를 사용하세요.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
  console.error("❌ .env.local 파일에 SUPABASE 및 GEMINI 키 설정이 필요합니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

function safeJsonParse(rawText) {
  let cleanText = rawText.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleanText);
  } catch {
    return JSON.parse(cleanText.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'));
  }
}

async function seedDatabase(targetCount = 50) {
  console.log(`🚀 DB 자동 적재 시작 (목표 수량: ${targetCount}개)...`);

  // 이미 DB에 있는 단어 목록 불러오기 (중복 생성 방지)
  const { data: existingWords } = await supabase.from('words').select('word');
  const history = existingWords ? existingWords.map((w) => w.word) : [];

  console.log(`📊 현재 DB에 저장되어 있는 단어 수: ${history.length}개`);

  let addedCount = 0;

  for (let i = 0; i < targetCount; i++) {
    const prompt = `
당신은 바쁜 성인을 위한 실전 비즈니스 영단어 멘토입니다.
직장인에게 유용한 비즈니스/이메일/회의 실전 영단어나 숙어(Idiom) 1개를 새로 선정하세요.

[🚨 절대 금지 단어 목록]
다음 단어들은 이미 DB에 있으므로 절대로 선택하지 마세요:
${history.slice(-100).join(', ')}

오직 순수 JSON 형식으로만 응답하세요. 백틱(\`\`\`json)은 금지합니다.
{
  "word": "단어 또는 숙어명",
  "phonetic": "발음기호 (예: /fəʊkəs/)",
  "meaning": "핵심 한글 뜻",
  "category": "Business",
  "nuance": "실전 비즈니스 뉘앙스 및 사전적 뜻과의 차이점",
  "example_sentence": "실전 영문 예문",
  "example_translation": "자연스러운 한글 번역",
  "speaking_tip": "원어민 발음 및 연음 팁",
  "quick_quiz": {
    "question": "단어 활용 3초 퀴즈 질문",
    "options": ["보기1", "보기2", "보기3"],
    "answer_index": 0,
    "explanation": "퀴즈 해설"
  }
}
`;

    let data = null;

    try {
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { temperature: 0.95 },
      });

      const result = await model.generateContent(prompt);
      const parsed = safeJsonParse(result.response.text());

      if (parsed && parsed.word) {
        data = parsed;
      }
    } catch (err) {
      console.warn(`⚠️ [${MODEL_NAME}] 생성 실패:`, err?.message || err);
    }

    if (!data || !data.word) {
      console.error(`❌ Gemini 모델(${MODEL_NAME})이 단어를 생성하지 못했습니다.`);
      continue;
    }

    // DB 저장 진행
    try {
      const { error } = await supabase.from('words').insert([data]);

      if (error) {
        if (error.code === '23505') { // UNIQUE 중복 에러
          console.warn(`⚠️ [중복 건너뜀] ${data.word}`);
        } else {
          console.error(`❌ DB 저장 실패 (${data.word}):`, error.message);
        }
      } else {
        addedCount++;
        history.push(data.word);
        console.log(`✅ [${addedCount}/${targetCount}] 추가 성공: "${data.word}" (${data.meaning})`);
      }
    } catch (dbErr) {
      console.error(`❌ DB 연동 오류 (${data.word}):`, dbErr?.message || dbErr);
    }

    // API 호출 속도 조절 (0.5초 대기)
    await new Promise((res) => setTimeout(res, 500));
  }

  console.log(`\n🎉 작업 완료! 총 ${addedCount}개의 단어가 새로 저장되었습니다.`);
}

// 50개 단어 생성 실행 (원하는 개수로 변경 가능)
seedDatabase(50);