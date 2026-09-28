import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ .env.local 파일에 SUPABASE 키가 설정되어 있지 않습니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 스피킹 팁 / 퀴즈 등이 없는 오픈 데이터셋용 기본값 생성 함수
function formatWordItem(rawItem) {
  const word = rawItem.word?.trim();
  if (!word) return null;

  return {
    word: word,
    phonetic: rawItem.phonetic?.trim() || '',
    meaning: rawItem.meaning?.trim() || '',
    category: rawItem.category?.trim() || 'Business',
    nuance: rawItem.nuance?.trim() || `${word}의 실전 비즈니스 활용 표현입니다.`,
    example_sentence: rawItem.example_sentence?.trim() || `Let's use '${word}' in our daily workflow.`,
    example_translation: rawItem.example_translation?.trim() || `실무에서 '${word}' 표현을 활용해 보세요.`,
    speaking_tip: rawItem.speaking_tip?.trim() || `자연스러운 연음으로 발음해 보세요.`,
    quick_quiz: rawItem.quick_quiz || {
      question: `'${word}'의 가장 적절한 뜻은 무엇일까요?`,
      options: [rawItem.meaning || '정답', '다른 의미 1', '다른 의미 2'],
      answer_index: 0,
      explanation: `'${word}'는 ${rawItem.meaning || '해당 의미'}를 나타냅니다.`
    }
  };
}

// 1. JSON 파일 읽어서 DB 적재
async function importFromJson(filePath) {
  console.log(`📂 JSON 파일 읽는 중: ${filePath}`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rawList = JSON.parse(fileContent);

  const formattedList = rawList
    .map(formatWordItem)
    .filter((item) => item !== null);

  await batchInsertToSupabase(formattedList);
}

// 2. CSV 파일 읽어서 DB 적재
async function importFromCsv(filePath) {
  console.log(`📂 CSV 파일 읽는 중: ${filePath}`);
  const rawList = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rawList.push(row))
      .on('end', async () => {
        const formattedList = rawList
          .map(formatWordItem)
          .filter((item) => item !== null);

        await batchInsertToSupabase(formattedList);
        resolve();
      })
      .on('error', reject);
  });
}

// Supabase에 50개씩 배치(Batch)로 빠르게 저장하는 함수
async function batchInsertToSupabase(items) {
  console.log(`🚀 총 ${items.length}개 단어 DB 적재 시작...`);

  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    // 중복 단어는 건너뛰고 입력 (onConflict)
    const { data, error } = await supabase
      .from('words')
      .upsert(chunk, { onConflict: 'word', ignoreDuplicates: true });

    if (error) {
      console.error(`❌ [배치 오류 ${i + 1}~${i + chunk.length}]:`, error.message);
    } else {
      successCount += chunk.length;
      console.log(`✅ [${successCount}/${items.length}] 단어 적재 진행 중...`);
    }
  }

  console.log(`\n🎉 적재 완료! 총 ${successCount}개 단어가 Supabase DB에 반영되었습니다.`);
}

// 실행 메인 함수
async function main() {
  // data 폴더 안의 파일 경로 지정
  const targetJson = path.join(process.cwd(), 'data', 'words.json');
  const targetCsv = path.join(process.cwd(), 'data', 'words.csv');

  if (fs.existsSync(targetJson)) {
    await importFromJson(targetJson);
  } else if (fs.existsSync(targetCsv)) {
    await importFromCsv(targetCsv);
  } else {
    console.error("❌ 'data/words.json' 또는 'data/words.csv' 파일을 찾을 수 없습니다.");
  }
}

main();