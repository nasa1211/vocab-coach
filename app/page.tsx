"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WordCard from "@/components/WordCard";
import ReviewQuiz from "@/components/ReviewQuiz";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import HistoryList, { prefetchHistory, rememberHistoryQuiz, refreshHistory } from "@/components/HistoryList";
import SettingsPanel from "@/components/SettingsPanel";
import { clearDayCache, loadDayCache, readDayCache, writeDayCache } from "@/lib/day-cache";
import { isAwaitingPush, isSlotDue, isSlotReleased } from "@/lib/kst";
import type { WordCardData } from "@/lib/word-card";

const STUDY_CACHE_KEY = "day_study_v3";

type StudySlot = {
  slot: number;
  label: string;
  time: string;
  word: string;
  opened: boolean;
  sent: boolean;
  card?: WordCardData;
};

type PreviousEvening = {
  date: string;
  opened: boolean;
  finished: boolean;
  quizzed: boolean;
  card: WordCardData;
};

type StudyResponse = {
  studyDate: string;
  currentSlot: number | null;
  slots: StudySlot[];
  card: WordCardData;
  quizzed?: number[];
  finished?: number[];
  previousEvening?: PreviousEvening | null;
};

type QuizGate = {
  aboutSlot: number;
  destinationSlot: number;
  source?: "yesterday-evening";
};

function pendingEveningQuiz(data: StudyResponse) {
  const previous = data.previousEvening;
  if (!previous || previous.quizzed || (!previous.finished && !previous.opened)) return false;
  return Boolean(previous.card.quick_quiz && previous.card.quick_quiz.options.length > 0);
}

function needsReview(destination: number, data: StudyResponse) {
  const previous = destination - 1;
  if (previous < 1) return false;
  if ((data.quizzed ?? []).includes(previous)) return false;
  const prev = data.slots.find((item) => item.slot === previous);
  return Boolean(prev?.card?.quick_quiz && prev.card.quick_quiz.options.length > 0);
}

function readLocation() {
  const params = new URLSearchParams(window.location.search);
  const word = params.get("word");
  const slot = params.get("slot");
  const tabParam = params.get("tab");
  const tab: AppTab =
    word || slot ? "today" : tabParam === "history" || tabParam === "settings" ? tabParam : "today";
  const query = word ? `?word=${encodeURIComponent(word)}` : slot ? `?slot=${encodeURIComponent(slot)}` : "";
  return { tab, query, loadStudy: tab === "today" };
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [study, setStudy] = useState<StudyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizGate | null>(null);
  const [now, setNow] = useState(() => new Date());
  const requestId = useRef(0);
  const studyRef = useRef<StudyResponse | null>(null);
  const quizRef = useRef<QuizGate | null>(null);
  studyRef.current = study;
  quizRef.current = quiz;

  const rememberOpened = (slot: number) => {
    const current = studyRef.current;
    const target = current?.slots.find((item) => item.slot === slot);
    if (!target || target.opened) return;
    void fetch("/api/study/opened", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot }),
    });
  };

  const showSlot = (slot: number) => {
    const current = studyRef.current;
    const target = current?.slots.find((item) => item.slot === slot);
    if (!current || !target?.card) return false;

    if (!isSlotReleased(target.time, Boolean(target.sent))) {
      quizRef.current = null;
      setQuiz(null);
      const next = { ...current, currentSlot: slot, card: target.card };
      studyRef.current = next;
      setStudy(next);
      setLoading(false);
      return true;
    }

    if (!new URLSearchParams(window.location.search).get("word") && needsReview(slot, current)) {
      const nextQuiz = { aboutSlot: slot - 1, destinationSlot: slot };
      quizRef.current = nextQuiz;
      setQuiz(nextQuiz);
      const next = { ...current, currentSlot: slot };
      studyRef.current = next;
      setStudy(next);
      setLoading(false);
      return true;
    }

    quizRef.current = null;
    setQuiz(null);
    rememberOpened(slot);
    const next = {
      ...current,
      currentSlot: slot,
      card: target.card,
      slots: current.slots.map((item) => (item.slot === slot ? { ...item, opened: true } : item)),
    };
    studyRef.current = next;
    setStudy(next);
    setLoading(false);
    return true;
  };
  const showSlotRef = useRef(showSlot);
  showSlotRef.current = showSlot;

  const applyStudy = (body: StudyResponse, query = "") => {
    studyRef.current = body;
    writeDayCache(STUDY_CACHE_KEY, body);
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    if (!params.get("word") && pendingEveningQuiz(body)) {
      const nextQuiz: QuizGate = { aboutSlot: 3, destinationSlot: 1, source: "yesterday-evening" };
      quizRef.current = nextQuiz;
      setQuiz(nextQuiz);
      const morning = body.slots.find((item) => item.slot === 1);
      setStudy(morning?.card ? { ...body, currentSlot: 1, card: morning.card } : body);
      setLoading(false);
      return;
    }
    const slot = Number(params.get("slot") || "") || body.currentSlot || body.slots[0]?.slot;
    if (params.get("word") || !slot || !showSlotRef.current(slot)) {
      quizRef.current = null;
      setQuiz(null);
      setStudy(body);
    }
  };

  const loadStudy = useCallback(async (query = "", initial = false, force = false) => {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    const word = params.get("word");
    const cached = readDayCache<StudyResponse>(STUDY_CACHE_KEY);
    const cachedHasWord =
      !word || cached?.slots.some((item) => item.word.toLowerCase() === word.toLowerCase());
    const cachedHasEvening = Boolean(cached && "previousEvening" in cached && Array.isArray(cached.finished));
    const cachedAwaitsPush = Boolean(cached?.slots.some((slot) => isAwaitingPush(slot.time, Boolean(slot.sent))));
    if (cached && cachedHasWord && cachedHasEvening && !cachedAwaitsPush && !force) {
      applyStudy(cached, query);
      setLoading(false);
      setError(null);
      return;
    }
    if (cached) clearDayCache(STUDY_CACHE_KEY);

    const id = ++requestId.current;
    if (initial) setLoading(true);
    setError(null);

    try {
      const body = await loadDayCache(STUDY_CACHE_KEY, async () => {
        const response = await fetch(`/api/study${query}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "학습 카드를 불러오지 못했습니다.");
        }
        return payload as StudyResponse;
      });
      if (id !== requestId.current) return;
      applyStudy(body, query);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof Error ? err.message : "학습 카드를 불러오지 못했습니다.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const applyLocation = useCallback(() => {
    const location = readLocation();
    setActiveTab(location.tab);
    if (!location.loadStudy) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const slot = Number(params.get("slot") || "");
    if (!params.get("word") && slot && showSlotRef.current(slot)) return;

    void loadStudy(location.query, !studyRef.current);
  }, [loadStudy]);

  useEffect(() => {
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, [applyLocation]);

  useEffect(() => {
    if (!study) return;
    writeDayCache(STUDY_CACHE_KEY, study);
    void prefetchHistory();
  }, [study]);

  useEffect(() => {
    const refresh = () => {
      const current = studyRef.current;
      if (!current?.slots.some((slot) => isAwaitingPush(slot.time, Boolean(slot.sent)))) return;
      if (document.visibilityState === "hidden") return;
      void loadStudy(window.location.search, false, true);
    };
    const timer = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadStudy]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (quizRef.current?.source === "yesterday-evening") return;
    const current = studyRef.current;
    if (!current?.currentSlot) return;
    const target = current.slots.find((item) => item.slot === current.currentSlot);
    if (!target?.card || !isSlotReleased(target.time, Boolean(target.sent), now)) return;
    if (needsReview(target.slot, current)) {
      if (quizRef.current?.destinationSlot === target.slot) return;
      const nextQuiz = { aboutSlot: target.slot - 1, destinationSlot: target.slot };
      quizRef.current = nextQuiz;
      setQuiz(nextQuiz);
      return;
    }
    if (quizRef.current || target.opened) return;
    rememberOpened(target.slot);
    const next = {
      ...current,
      card: target.card,
      slots: current.slots.map((item) => (item.slot === target.slot ? { ...item, opened: true } : item)),
    };
    studyRef.current = next;
    setStudy(next);
  }, [now, study]);

  const selectTab = (tab: AppTab) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "today" && study?.currentSlot) params.set("slot", String(study.currentSlot));
    window.history.pushState(null, "", `/?${params.toString()}`);
    setActiveTab(tab);
    if (tab === "today" && !study) void loadStudy("", true);
  };

  const openSlot = (slot: number) => {
    if (quizRef.current?.source === "yesterday-evening") return;
    const target = studyRef.current?.slots.find((item) => item.slot === slot);
    if (quizRef.current && target && !isSlotReleased(target.time, Boolean(target.sent), now)) return;
    if (quizRef.current && quizRef.current.aboutSlot === slot) return;
    window.history.pushState(null, "", `/?tab=today&slot=${slot}`);
    setActiveTab("today");
    if (!showSlot(slot)) void loadStudy(`?slot=${slot}`);
  };

  const revealQuiz = (selected: number) => {
    const gate = quizRef.current;
    const current = studyRef.current;
    if (!gate || !current) return;
    const saveAnswer = (body: { slot: number; date?: string; selected: number }, card?: WordCardData) => {
      const quiz = card?.quick_quiz;
      if (body.date && quiz && quiz.options.length > 0) {
        rememberHistoryQuiz(body.date, body.slot, {
          question: quiz.question,
          options: quiz.options,
          answerIndex: quiz.answer_index,
          explanation: quiz.explanation,
          selected: body.selected,
          correct: body.selected === quiz.answer_index,
        });
      }
      void fetch("/api/study/quizzed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((response) => {
        if (response.ok) void refreshHistory();
      });
    };
    if (gate.source === "yesterday-evening" && current.previousEvening) {
      if (current.previousEvening.quizzed) return;
      const next = {
        ...current,
        previousEvening: { ...current.previousEvening, quizzed: true },
      };
      studyRef.current = next;
      setStudy(next);
      saveAnswer({ slot: 3, date: current.previousEvening.date, selected }, current.previousEvening.card);
      return;
    }
    if ((current.quizzed ?? []).includes(gate.aboutSlot)) return;
    const quizzed = [...new Set([...(current.quizzed ?? []), gate.aboutSlot])];
    const next = { ...current, quizzed };
    studyRef.current = next;
    setStudy(next);
    saveAnswer(
      { slot: gate.aboutSlot, date: current.studyDate, selected },
      current.slots.find((item) => item.slot === gate.aboutSlot)?.card,
    );
  };

  const finishQuiz = () => {
    const gate = quizRef.current;
    if (!gate) return;
    quizRef.current = null;
    setQuiz(null);
    showSlot(gate.destinationSlot);
  };

  const currentSlot = study?.slots.find((item) => item.slot === study.currentSlot);
  const currentDue = currentSlot ? isSlotReleased(currentSlot.time, Boolean(currentSlot.sent), now) : true;
  const currentIndex = study ? study.slots.findIndex((item) => item.slot === study.currentSlot) : -1;
  const nextSlot = study && currentIndex >= 0 ? study.slots[currentIndex + 1] ?? null : null;
  const nextDue = nextSlot ? isSlotReleased(nextSlot.time, Boolean(nextSlot.sent), now) : false;
  const closedNote = (label: string, time: string) =>
    isSlotDue(time, now) ? "알림이 오면 열립니다" : `${label} ${time}에 열립니다`;
  const quizCard = quiz?.source === "yesterday-evening"
    ? study?.previousEvening?.card
    : study?.slots.find((item) => item.slot === quiz?.aboutSlot)?.card ?? study?.card;
  const quizFromLabel = quiz?.source === "yesterday-evening"
    ? "어제 저녁"
    : study?.slots.find((item) => item.slot === quiz?.aboutSlot)?.label ?? "이전";
  const quizToLabel = quiz?.source === "yesterday-evening"
    ? "아침"
    : study?.slots.find((item) => item.slot === quiz?.destinationSlot)?.label ?? "다음";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 ios-safe-content-pb dark:bg-slate-950 dark:text-slate-100">
      <header className="mobile-landscape-header sticky top-0 z-10 border-b border-slate-200 bg-white/90 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto max-w-md px-4 pb-3 sm:px-6">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">세 장의 영어</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            단어와 예문을 아침, 낮, 저녁에 한 장씩 복습합니다.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-2 py-4 sm:px-6 sm:py-6">
        {activeTab === "today" && (
          <div className="animate-fadeIn flex flex-col gap-5">
            {study && (
              <div className="grid grid-cols-3 gap-2">
                {study.slots.map((slot) => {
                  const selected = slot.slot === study.currentSlot;
                  const due = isSlotReleased(slot.time, Boolean(slot.sent), now);
                  const conceal = due && quiz?.aboutSlot === slot.slot && !(study.quizzed ?? []).includes(slot.slot);
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      disabled={conceal}
                      onClick={() => openSlot(slot.slot)}
                      className={`rounded-2xl border px-2 py-2 text-left transition-colors ${
                        conceal
                          ? "cursor-default border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                          : selected
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                      }`}
                    >
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {slot.label} {slot.time}
                      </p>
                      <p
                        className={`truncate text-xs font-semibold text-slate-900 dark:text-white ${
                          due && slot.opened ? "" : "select-none blur-md"
                        }`}
                      >
                        {conceal ? "퀴즈" : slot.word}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {due ? (slot.opened ? "학습함" : "아직") : "대기"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {loading && !study ? (
              <div className="flex h-[520px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50 sm:rounded-3xl sm:p-6">
                <p className="animate-pulse text-xs text-slate-400">오늘의 단어와 예문을 불러오는 중입니다.</p>
              </div>
            ) : error ? (
              <div className="w-full rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-rose-300 sm:rounded-3xl sm:p-6">
                {error}
              </div>
            ) : study && quiz && quizCard?.quick_quiz ? (
              <ReviewQuiz
                key={`${quiz.source ?? "slot"}-${quiz.aboutSlot}-${quiz.destinationSlot}`}
                card={quizCard}
                fromLabel={quizFromLabel}
                toLabel={quizToLabel}
                onAnswered={revealQuiz}
                onContinue={finishQuiz}
              />
            ) : study && currentSlot ? (
              <div className="relative">
                <div className={currentDue ? undefined : "locked-card pointer-events-none select-none"} aria-hidden={currentDue ? undefined : true}>
                  <WordCard
                    key={currentSlot.card?.word ?? study.card.word}
                    data={currentSlot.card ?? study.card}
                    waitingLabel={
                      currentDue && currentSlot.slot !== 3 && nextSlot && !nextDue
                        ? closedNote(nextSlot.label, nextSlot.time)
                        : undefined
                    }
                  />
                </div>
                {currentDue ? null : (
                  <div className="absolute inset-0 flex items-center justify-center px-6">
                    <p className="rounded-2xl bg-white/95 px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-lg dark:bg-slate-900/95 dark:text-slate-100">
                      {closedNote(currentSlot.label, currentSlot.time)}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "history" && <HistoryList />}
        {activeTab === "settings" && <SettingsPanel />}
      </main>

      <BottomNav activeTab={activeTab} onChange={selectTab} />
    </div>
  );
}
