import { GoogleGenerativeAI } from "@google/generative-ai";
import { MODEL_NAME } from "@/lib/gemini";
import type { WordRow } from "@/lib/app-state";

type GeneratedWord = {
  word?: string;
  phonetic?: string;
  meaning?: string;
  category?: string;
  nuance?: string;
  example_sentence?: string;
  example_translation?: string;
  speaking_tip?: string;
  quick_quiz?: WordRow["quick_quiz"];
};

function normalizeWord(word: string) {
  return word.trim().toLowerCase();
}

export function takeNewWords(candidates: GeneratedWord[], blocked: Set<string>, limit: number) {
  const accepted: GeneratedWord[] = [];
  for (const candidate of candidates) {
    const key = normalizeWord(String(candidate.word || ""));
    if (!key || blocked.has(key)) continue;
    blocked.add(key);
    accepted.push(candidate);
    if (accepted.length === limit) break;
  }
  return accepted;
}

function asWordRow(raw: GeneratedWord, index: number): WordRow {
  const word = String(raw.word || "").trim();
  if (!word) {
    throw new Error("API 응답에 단어가 없습니다.");
  }

  return {
    id: `api-${Date.now()}-${index}`,
    word,
    phonetic: raw.phonetic ?? "",
    meaning: raw.meaning ?? "",
    category: raw.category ?? "English",
    nuance: raw.nuance ?? "",
    example_sentence: raw.example_sentence ?? "",
    example_translation: raw.example_translation ?? "",
    speaking_tip: raw.speaking_tip ?? "",
    quick_quiz: raw.quick_quiz ?? null,
    created_at: new Date().toISOString(),
  };
}

export async function generateStudyWords(options: {
  count?: number;
  category?: string;
  word?: string;
  exclude?: string[];
} = {}): Promise<WordRow[]> {
  const count = options.count ?? 3;
  const category = options.category || "English";
  const requestedWord = options.word ? normalizeWord(options.word) : "";
  const blocked = new Set((options.exclude ?? []).map(normalizeWord).filter(Boolean));
  if (requestedWord) blocked.delete(requestedWord);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY가 없습니다.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.8,
      responseMimeType: "application/json",
    },
  });

  const accepted: GeneratedWord[] = [];

  for (let attempt = 0; attempt < 4 && accepted.length < count; attempt += 1) {
    const need = count - accepted.length;
    const excludeList = [...blocked].slice(-80);
    const target = requestedWord
      ? `요청된 단어("${options.word}")의 뜻과 예문을 작성하세요.`
      : `성인 학습용 실용 영어 단어 또는 숙어 ${need}개를 서로 겹치지 않게 고르세요.`;
    const excludeInstruction =
      excludeList.length > 0 ? `\n이미 학습한 단어는 제외하세요: ${excludeList.join(", ")}` : "";

    const prompt = `
당신은 성인을 위한 영어 단어 멘토입니다.
${target}${excludeInstruction}

JSON만 반환하세요.
{
  "words": [
    {
      "word": "단어 또는 숙어",
      "phonetic": "/발음/",
      "meaning": "핵심 한글 뜻",
      "category": "${category}",
      "nuance": "실전에서 어떻게 쓰이는지 한국어 설명",
      "example_sentence": "영어 예문",
      "example_translation": "예문 한글 번역",
      "speaking_tip": "발음 팁",
      "quick_quiz": {
        "question": "간단 퀴즈",
        "options": ["보기1", "보기2", "보기3"],
        "answer_index": 0,
        "explanation": "해설"
      }
    }
  ]
}
words 배열 길이는 ${need}개입니다.
`;

    let list: GeneratedWord[] | undefined;
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      if (!responseText) continue;
      const parsed = JSON.parse(responseText) as { words?: GeneratedWord[] } | GeneratedWord[];
      list = Array.isArray(parsed) ? parsed : parsed.words;
    } catch {
      continue;
    }
    if (!Array.isArray(list)) continue;

    const fresh = takeNewWords(list, blocked, need).filter((item) => {
      if (!requestedWord) return true;
      return normalizeWord(String(item.word || "")) === requestedWord;
    });
    accepted.push(...fresh);
  }

  if (accepted.length < count) {
    throw new Error("이미 학습한 단어를 제외한 새 단어를 만들지 못했습니다.");
  }

  return accepted.slice(0, count).map(asWordRow);
}
