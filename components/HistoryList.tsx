"use client";

import { useLayoutEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { clearDayCache, loadDayCache, readDayCache, writeDayCache } from "@/lib/day-cache";
import { speakEnglish } from "@/lib/speak-english";

const HISTORY_CACHE_KEY = "day_history";

type HistoryQuiz = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  selected: number;
  correct: boolean;
};

type HistorySlot = {
  slot: number;
  label: string;
  time: string;
  word: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
  quiz: HistoryQuiz | null;
};

type HistoryDay = {
  date: string;
  slots: HistorySlot[];
};

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function cacheHasQuizField(days: HistoryDay[]) {
  return days.every((day) => day.slots.every((slot) => "quiz" in slot));
}

async function fetchHistory() {
  const response = await fetch("/api/history", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "지난 단어를 불러오지 못했습니다.");
  return body.days as HistoryDay[];
}

export function prefetchHistory() {
  const saved = readDayCache<HistoryDay[]>(HISTORY_CACHE_KEY);
  if (saved && !cacheHasQuizField(saved)) clearDayCache(HISTORY_CACHE_KEY);
  return loadDayCache(HISTORY_CACHE_KEY, fetchHistory);
}

export function refreshHistory() {
  clearDayCache(HISTORY_CACHE_KEY);
  return loadDayCache(HISTORY_CACHE_KEY, fetchHistory);
}

export function rememberHistoryQuiz(date: string, slot: number, quiz: HistoryQuiz) {
  const saved = readDayCache<HistoryDay[]>(HISTORY_CACHE_KEY);
  clearDayCache(HISTORY_CACHE_KEY);
  if (!saved) return;
  const next = saved.map((day) => ({
    ...day,
    slots: day.slots.map((item) => ({
      ...item,
      quiz: day.date === date && item.slot === slot ? quiz : (item.quiz ?? null),
    })),
  }));
  writeDayCache(HISTORY_CACHE_KEY, next);
}

function SpeakButton({ label, text, rate }: { label: string; text: string; rate: number }) {
  return (
    <button
      type="button"
      onClick={() => speakEnglish(text, rate)}
      className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      aria-label={label}
    >
      <Volume2 className="h-4 w-4" />
    </button>
  );
}

function QuizResult({ quiz }: { quiz: HistoryQuiz }) {
  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
      <p className={`text-sm font-semibold ${quiz.correct ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>
        {quiz.correct ? "맞았습니다" : "이번엔 아니었습니다"}
      </p>
      {quiz.question ? (
        <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">{quiz.question}</p>
      ) : null}
      <div className="space-y-1.5">
        {quiz.options.map((option, index) => {
          const isCorrect = index === quiz.answerIndex;
          const isSelected = index === quiz.selected;
          let tone = "bg-slate-50 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300";
          if (isCorrect) tone = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
          else if (isSelected) tone = "bg-rose-500/15 text-rose-700 dark:text-rose-300";
          return (
            <p key={`${index}-${option}`} className={`rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${tone}`}>
              {option}
            </p>
          );
        })}
      </div>
      {quiz.explanation ? (
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{quiz.explanation}</p>
      ) : null}
    </div>
  );
}

export default function HistoryList() {
  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const saved = readDayCache<HistoryDay[]>(HISTORY_CACHE_KEY);
    if (saved && cacheHasQuizField(saved)) {
      setDays(saved);
      return;
    }

    let cancelled = false;
    prefetchHistory()
      .then((nextDays) => {
        if (!cancelled) setDays(nextDays);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "지난 단어를 불러오지 못했습니다.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-rose-300 sm:rounded-3xl sm:p-6">
        {error}
      </div>
    );
  }

  if (!days) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl sm:p-6">
        지난 단어를 불러오는 중입니다.
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <span className="text-4xl">🕒</span>
        <h2 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">지난 단어가 없습니다</h2>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          오늘 배운 단어는 내일부터 이곳에 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.date} className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-slate-900 dark:text-white">{formatDate(day.date)}</h2>
          {day.slots.map((slot) => (
            <article
              key={`${day.date}-${slot.slot}`}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
            >
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {slot.label} {slot.time}
              </p>
              <div className="mt-1 flex items-start justify-between gap-2">
                <p className="text-base font-bold text-slate-900 dark:text-white">{slot.word}</p>
                <SpeakButton label={`${slot.word} 듣기`} text={slot.word} rate={0.86} />
              </div>
              {slot.meaning ? (
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">{slot.meaning}</p>
              ) : null}
              {slot.exampleSentence ? (
                <div className="mt-2 flex items-start gap-2">
                  <p className="flex-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    &quot;{slot.exampleSentence}&quot;
                  </p>
                  <SpeakButton label="예문 듣기" text={slot.exampleSentence} rate={0.92} />
                </div>
              ) : null}
              {slot.exampleTranslation ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {slot.exampleTranslation}
                </p>
              ) : null}
              {slot.quiz ? <QuizResult quiz={slot.quiz} /> : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
