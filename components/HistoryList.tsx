"use client";

import { useEffect, useState } from "react";

type HistorySlot = {
  slot: number;
  label: string;
  time: string;
  word: string;
  meaning: string;
  exampleSentence: string;
  exampleTranslation: string;
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

export default function HistoryList() {
  const [days, setDays] = useState<HistoryDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/history", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "지난 단어를 불러오지 못했습니다.");
        return body.days as HistoryDay[];
      })
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
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">{slot.word}</p>
              {slot.meaning ? (
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">{slot.meaning}</p>
              ) : null}
              {slot.exampleSentence ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  &quot;{slot.exampleSentence}&quot;
                </p>
              ) : null}
              {slot.exampleTranslation ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {slot.exampleTranslation}
                </p>
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
