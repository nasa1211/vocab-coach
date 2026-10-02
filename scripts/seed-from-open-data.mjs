import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ .env.local 파일에 SUPABASE 키 설정이 필요합니다.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 💡 검증된 비즈니스/실전 영단어 및 예문 오픈 세트 (예시 데이터)
// 필요시 오픈소스 JSON URL을 fetch()로 가져와 바로 넣을 수도 있습니다.
const OPEN_VOCAB_DATASET = [
  {
    word: "Circle back",
    phonetic: "/ˈsɜːr.kəl bæk/",
    meaning: "나중에 다시 이야기하다 / 원점으로 돌아와 검토하다",
    category: "Business",
    nuance: "당장 결정을 내리기 어렵거나 추가 정보가 필요할 때 '나중에 다시 논의하자'는 의미로 직장인들이 매우 자주 쓰는 유용한 표입니다.",
    example_sentence: "Let's circle back to this issue after the team meeting.",
    example_translation: "팀 회의가 끝난 후에 이 안건에 대해 다시 이야기 나누시죠.",
    speaking_tip: "circle과 back을 이어 [써클백]으로 자연스럽게 연결하세요.",
    quick_quiz: {
      question: "나중에 다시 논의하자는 의미의 표현은?",
      options: ["Circle back", "Call off", "Pass out"],
      answer_index: 0,
      explanation: "Circle back은 나중에 주제로 다시 돌아와 논의할 때 씁니다."
    }
  },
  {
    word: "Touch base",
    phonetic: "/tʌtʃ beɪs/",
    meaning: "간단히 상황을 공유하다 / 연락하다",
    category: "Business",
    nuance: "긴 회의 대신 짧고 가볍게 진행 상황을 체크하거나 인사를 건넬 때 쓰는 가장 대표적인 비즈니스 표현입니다.",
    example_sentence: "I just wanted to touch base with you regarding the new project schedule.",
    example_translation: "새 프로젝트 일정에 대해 간단히 공유드리고자 연락드렸습니다.",
    speaking_tip: "touch의 ch와 base를 붙여 [터치베이스]로 발음합니다.",
    quick_quiz: {
      question: "진행 상황을 가볍게 확인할 때 쓰는 말은?",
      options: ["Touch base", "Break a leg", "Bite the bullet"],
      answer_index: 0,
      explanation: "Touch base는 짧은 공유 및 회의를 의미합니다."
    }
  },
  {
    word: "Bandwidth",
    phonetic: "/ˈbænd.wɪdθ/",
    meaning: "수용 능력 / 시간적·정신적 여유",
    category: "Business",
    nuance: "현재 다른 업무를 추가로 맡을 시간이나 마음의 여유가 있는지를 비유적으로 나타내는 대중적인 비즈니스 용어입니다.",
    example_sentence: "I don't have the bandwidth to take on another task this week.",
    example_translation: "이번 주는 다른 업무를 추가로 맡을 여유가 없습니다.",
    speaking_tip: "band에 강세를 주어 [밴드위드스]로 발음합니다.",
    quick_quiz: {
      question: "일할 여유나 에너지를 비유하는 단어는?",
      options: ["Bandwidth", "Software", "Protocol"],
      answer_index: 0,
      explanation: "Bandwidth는 작업 수용 능력을 뜻합니다."
    }
  },
  {
    word: "Out of the loop",
    phonetic: "/aʊt əv ðə luːp/",
    meaning: "상황을 잘 모르는 / 의사결정 공유에서 제외된",
    category: "Business",
    nuance: "정보 공유 대상에서 빠져 있어 최신 진행 상황을 알지 못할 때 쓰는 표현입니다.",
    example_sentence: "Sorry, I've been out of the loop for a few days due to my business trip.",
    example_translation: "죄송합니다, 출장 때문에 며칠 동안 상황을 제대로 파악하지 못했습니다.",
    speaking_tip: "out of를 빠르게 이어 [아웃오브]가 아닌 [아웃어브]로 부드럽게 넘어가세요.",
    quick_quiz: {
      question: "소식이나 공유에서 빠져 상황을 모를 때 쓰는 표현은?",
      options: ["Out of the loop", "On the fence", "In the red"],
      answer_index: 0,
      explanation: "Out of the loop는 정보 전달 고리(loop)에서 벗어나 있음을 뜻합니다."
    }
  },
  {
    word: "Low-hanging fruit",
    phonetic: "/ləʊ ˈhæŋ.ɪŋ fruːt/",
    meaning: "가장 쉽게 달성할 수 있는 목표 / 용이한 과제",
    category: "Business",
    nuance: "낮게 매달린 과일을 먼저 따듯, 적은 노력으로 즉각 성과를 낼 수 있는 쉬운 과제를 비유합니다.",
    example_sentence: "We should focus on the low-hanging fruit first to show quick results.",
    example_translation: "빠른 성과를 보여주기 위해 먼저 달성하기 쉬운 목표부터 집중해야 합니다.",
    speaking_tip: "hanging의 g음은 크게 내지 않고 [로우해닝 프룻]처럼 읽습니다.",
    quick_quiz: {
      question: "가장 쉽게 달성할 수 있는 목표를 비유하는 말은?",
      options: ["Low-hanging fruit", "Piece of cake", "Hard nut"],
      answer_index: 0,
      explanation: "Low-hanging fruit은 쉽게 얻을 수 있는 성과를 비유합니다."
    }
  }
];

async function seedOpenDataset() {
  console.log(`🚀 오픈 데이터셋 적재 시작 (총 ${OPEN_VOCAB_DATASET.length}개)...`);

  let successCount = 0;

  for (const item of OPEN_VOCAB_DATASET) {
    const { error } = await supabase.from('words').upsert([item], { onConflict: 'word' });

    if (error) {
      console.error(`❌ [저장 실패] ${item.word}:`, error.message);
    } else {
      successCount++;
      console.log(`✅ [${successCount}/${OPEN_VOCAB_DATASET.length}] 입력 성공: "${item.word}"`);
    }
  }

  console.log(`\n🎉 완료! 총 ${successCount}개 단어가 Supabase DB에 적재되었습니다.`);
}

seedOpenDataset();