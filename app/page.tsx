"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WordCard from "@/components/WordCard";
import BottomNav, { type AppTab } from "@/components/BottomNav";
import HistoryList from "@/components/HistoryList";
import SettingsPanel from "@/components/SettingsPanel";
import type { WordCardData } from "@/lib/word-card";

type StudySlot = {
  slot: number;
  label: string;
  time: string;
  word: string;
  opened: boolean;
  sent: boolean;
  card?: WordCardData;
};

type StudyResponse = {
  studyDate: string;
  currentSlot: number | null;
  slots: StudySlot[];
  card: WordCardData;
};

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
  const requestId = useRef(0);
  const studyRef = useRef<StudyResponse | null>(null);
  studyRef.current = study;

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

  const showCachedSlot = (slot: number) => {
    const current = studyRef.current;
    const target = current?.slots.find((item) => item.slot === slot);
    if (!current || !target?.card) return false;
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
  const showCachedSlotRef = useRef(showCachedSlot);
  showCachedSlotRef.current = showCachedSlot;

  const loadStudy = useCallback(async (query = "", initial = false) => {
    const id = ++requestId.current;
    if (initial) setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/study${query}`, { cache: "no-store" });
      const body = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) {
        throw new Error(body.error || "학습 카드를 불러오지 못했습니다.");
      }
      studyRef.current = body;
      setStudy(body);
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
    if (!params.get("word") && slot && showCachedSlotRef.current(slot)) return;

    void loadStudy(location.query, !studyRef.current);
  }, [loadStudy]);

  useEffect(() => {
    applyLocation();
    window.addEventListener("popstate", applyLocation);
    return () => window.removeEventListener("popstate", applyLocation);
  }, [applyLocation]);

  const selectTab = (tab: AppTab) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (tab === "today" && study?.currentSlot) params.set("slot", String(study.currentSlot));
    window.history.pushState(null, "", `/?${params.toString()}`);
    setActiveTab(tab);
    if (tab === "today" && !study) void loadStudy("", true);
  };

  const openSlot = (slot: number) => {
    window.history.pushState(null, "", `/?tab=today&slot=${slot}`);
    setActiveTab("today");
    if (!showCachedSlot(slot)) void loadStudy(`?slot=${slot}`);
  };

  const openNext = () => {
    if (!study || study.slots.length === 0) return;
    const index = study.slots.findIndex((item) => item.slot === study.currentSlot);
    const next = study.slots[(index + 1) % study.slots.length];
    openSlot(next.slot);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 ios-safe-content-pb dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto max-w-md px-4 pb-3">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">세 장의 영어</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            단어와 예문을 아침, 낮, 저녁에 한 장씩 복습합니다.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
        {activeTab === "today" && (
          <div className="animate-fadeIn flex flex-col gap-5">
            {study && (
              <div className="grid grid-cols-3 gap-2">
                {study.slots.map((slot) => {
                  const selected = slot.slot === study.currentSlot;
                  return (
                    <button
                      key={slot.slot}
                      type="button"
                      onClick={() => openSlot(slot.slot)}
                      className={`rounded-2xl border px-2 py-2 text-left transition-colors ${
                        selected
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                      }`}
                    >
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {slot.label} {slot.time}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{slot.word}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {slot.opened ? "학습함" : "아직"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {loading && !study ? (
              <div className="flex h-[520px] w-full items-center justify-center rounded-3xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="animate-pulse text-xs text-slate-400">오늘의 단어와 예문을 불러오는 중입니다.</p>
              </div>
            ) : error ? (
              <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-sm text-rose-600 dark:border-slate-800 dark:bg-slate-900 dark:text-rose-300">
                {error}
              </div>
            ) : study ? (
              <WordCard
                key={(study.slots.find((item) => item.slot === study.currentSlot)?.card ?? study.card).word}
                data={study.slots.find((item) => item.slot === study.currentSlot)?.card ?? study.card}
                onNext={openNext}
              />
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
