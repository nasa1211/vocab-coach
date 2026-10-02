import type { WordRow } from "@/lib/app-state";

export type QuickQuiz = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
};

export type WordCardData = {
  word: string;
  phonetic: string;
  meaning: string;
  category: string;
  nuance: string;
  example_sentence: string;
  example_translation: string;
  speaking_tip: string;
  quick_quiz: QuickQuiz | null;
};

export function toWordCard(row: WordRow): WordCardData {
  const quiz = row.quick_quiz;
  const hasQuiz = Array.isArray(quiz?.options) && quiz.options.length > 0;

  return {
    word: row.word ?? "",
    phonetic: row.phonetic ?? "",
    meaning: row.meaning ?? "",
    category: row.category ?? "",
    nuance: row.nuance ?? "",
    example_sentence: row.example_sentence ?? "",
    example_translation: row.example_translation ?? "",
    speaking_tip: row.speaking_tip ?? "",
    quick_quiz: hasQuiz
      ? {
          question: quiz?.question ?? "",
          options: quiz?.options ?? [],
          answer_index: Number(quiz?.answer_index ?? 0),
          explanation: quiz?.explanation ?? "",
        }
      : null,
  };
}
