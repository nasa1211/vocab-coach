"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import type { WordCardData } from "@/lib/word-card";
import { speakEnglish } from "@/lib/speak-english";

export default function ReviewQuiz({
  card,
  fromLabel,
  toLabel,
  onAnswered,
  onContinue,
}: {
  card: WordCardData;
  fromLabel: string;
  toLabel: string;
  onAnswered: () => void;
  onContinue: () => void;
}) {
  const quiz = card.quick_quiz;
  const [selected, setSelected] = useState<number | null>(null);
  if (!quiz) return null;

  const revealed = selected !== null;
  const correct = selected === quiz.answer_index;

  const choose = (index: number) => {
    if (revealed) return;
    setSelected(index);
    onAnswered();
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{fromLabel} 단어 확인</p>
      <p className="mt-3 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100">{quiz.question}</p>
      <div className="mt-4 space-y-2">
        {quiz.options.map((option, index) => {
          const isCorrect = index === quiz.answer_index;
          const isSelected = selected === index;
          let tone =
            "border border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";
          if (revealed && isCorrect) {
            tone = "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
          } else if (revealed && isSelected) {
            tone = "border border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300";
          }
          return (
            <button
              key={`${index}-${option}`}
              type="button"
              disabled={revealed}
              onClick={() => choose(index)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${tone}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {revealed ? (
        <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className={`text-sm font-semibold ${correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>
            {correct ? "맞았습니다" : "이번엔 아니었습니다"}
          </p>
          <div className="text-center">
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{card.word}</p>
            <p className="mt-1 flex flex-wrap items-baseline justify-center gap-x-2 text-sm">
              {card.phonetic ? (
                <span className="font-mono text-slate-400 dark:text-slate-500">{card.phonetic}</span>
              ) : null}
              {card.phonetic && card.korean_pronunciation ? (
                <span className="text-slate-300 dark:text-slate-600">·</span>
              ) : null}
              {card.korean_pronunciation ? (
                <span className="text-slate-600 dark:text-slate-300">{card.korean_pronunciation}</span>
              ) : null}
            </p>
            <p className="mt-2 text-base font-semibold text-emerald-600 dark:text-emerald-400">{card.meaning}</p>
          </div>
          {card.example_sentence ? (
            <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/60">
              <p className="flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                &quot;{card.example_sentence}&quot;
              </p>
              <button
                type="button"
                onClick={() => speakEnglish(card.example_sentence, 0.92)}
                className="shrink-0 rounded-full p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="예문 듣기"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {quiz.explanation ? <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{quiz.explanation}</p> : null}
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-500"
          >
            {toLabel} 단어 보기
          </button>
        </div>
      ) : null}
    </div>
  );
}
