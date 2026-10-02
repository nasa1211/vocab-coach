'use client';

import { useCallback, useEffect, useState } from 'react';
import WordCard from '@/components/WordCard';
import PushSubscriptionButton from '@/components/PushSubscriptionButton';
import type { WordCardData } from '@/lib/word-card';

type StudySlot = {
  slot: number;
  label: string;
  time: string;
  word: string;
  opened: boolean;
  sent: boolean;
};

type StudyResponse = {
  studyDate: string;
  currentSlot: number | null;
  slots: StudySlot[];
  card: WordCardData;
};

export default function HomePage() {
  const [study, setStudy] = useState<StudyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudy = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/study${query}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || '학습 카드를 불러오지 못했습니다.');
      }
      setStudy(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : '학습 카드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFromLocation = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const word = params.get('word');
    const slot = params.get('slot');
    const query = word
      ? `?word=${encodeURIComponent(word)}`
      : slot
        ? `?slot=${encodeURIComponent(slot)}`
        : '';
    void loadStudy(query);
  }, [loadStudy]);

  useEffect(() => {
    loadFromLocation();
    window.addEventListener('popstate', loadFromLocation);
    return () => window.removeEventListener('popstate', loadFromLocation);
  }, [loadFromLocation]);

  const openSlot = (slot: number) => {
    const url = `/?slot=${slot}`;
    window.history.pushState(null, '', url);
    void loadStudy(`?slot=${slot}`);
  };

  const openNext = () => {
    if (!study || study.slots.length === 0) return;
    const index = study.slots.findIndex((item) => item.slot === study.currentSlot);
    const next = study.slots[(index + 1) % study.slots.length];
    openSlot(next.slot);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 flex flex-col items-center gap-5">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">Adult AI Vocab</h1>
        <p className="text-xs text-slate-400">단어와 예문을 아침, 낮, 저녁에 한 장씩 복습합니다.</p>
      </div>

      <PushSubscriptionButton />

      {study && (
        <div className="w-full max-w-md grid grid-cols-3 gap-2">
          {study.slots.map((slot) => {
            const selected = slot.slot === study.currentSlot;
            return (
              <button
                key={slot.slot}
                onClick={() => openSlot(slot.slot)}
                className={`rounded-2xl border px-2 py-2 text-left transition-colors ${
                  selected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-800 bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <p className="text-[11px] text-slate-400">
                  {slot.label} {slot.time}
                </p>
                <p className="text-xs font-semibold text-white truncate">{slot.word}</p>
                <p className="text-[10px] text-slate-500">{slot.opened ? '학습함' : '아직'}</p>
              </button>
            );
          })}
        </div>
      )}

      <div className="w-full max-w-md">
        {loading ? (
          <div className="w-full h-[520px] bg-slate-900/50 border border-slate-800 rounded-3xl flex items-center justify-center">
            <p className="text-xs text-slate-400 animate-pulse">오늘의 단어와 예문을 불러오는 중입니다.</p>
          </div>
        ) : error ? (
          <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-sm text-rose-300">
            {error}
          </div>
        ) : study ? (
          <WordCard key={study.card.word} data={study.card} onNext={openNext} />
        ) : null}
      </div>
    </main>
  );
}
