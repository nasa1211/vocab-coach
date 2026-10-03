'use client';

import { useState } from 'react';
import { Volume2, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import type { WordCardData } from '@/lib/word-card';
import { speakEnglish } from '@/lib/speak-english';

export type { QuickQuiz, WordCardData as WordData } from '@/lib/word-card';

interface WordCardProps {
  data: WordCardData;
  onNext?: () => void;
  nextLabel?: string;
}

export default function WordCard({ data, onNext, nextLabel }: WordCardProps) {
  const [activeTab, setActiveTab] = useState<'example' | 'nuance'>('example');
  const tabGridClass = data.nuance ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className="mx-auto flex min-h-[520px] w-full max-w-md flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 text-slate-800 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:rounded-3xl sm:p-6">
      {/* 1. 상단 바 (카테고리 & 발음 듣기) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            {data.category}
          </span>
          <button
            onClick={() => speakEnglish(data.word, 0.86)}
            className="rounded-full bg-slate-100 p-2.5 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
            title="발음 듣기"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* 2. 핵심 표제어 & 발음기호 */}
        <div className="mb-6 text-center">
          <h2 className="mb-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {data.word}
          </h2>
          <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-sm">
            {data.phonetic ? (
              <span className="font-mono tracking-tight text-slate-400 dark:text-slate-500">{data.phonetic}</span>
            ) : null}
            {data.phonetic && data.korean_pronunciation ? (
              <span className="text-slate-300 dark:text-slate-600" aria-hidden>
                ·
              </span>
            ) : null}
            {data.korean_pronunciation ? (
              <span className="text-slate-600 dark:text-slate-300">{data.korean_pronunciation}</span>
            ) : null}
          </p>
          <p className="mt-3 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {data.meaning}
          </p>
        </div>

        {/* 3. 탭 네비게이션 */}
        <div className={`mb-5 grid gap-1 rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400 ${tabGridClass}`}>
          <button
            onClick={() => setActiveTab('example')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'example'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            예문
          </button>
          {data.nuance ? (
            <button
              onClick={() => setActiveTab('nuance')}
              className={`py-2 rounded-lg transition-all ${
                activeTab === 'nuance'
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              뉘앙스
            </button>
          ) : null}
        </div>

        {/* 4. 탭 콘텐츠 영역 */}
        <div className="flex min-h-[160px] flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800/80 dark:bg-slate-950/60">
          {/* [탭 1] 실전 예문 */}
          {activeTab === 'example' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <p className="flex-1 text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200">
                  &quot;{data.example_sentence}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => speakEnglish(data.example_sentence, 0.92)}
                  className="mt-0.5 shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  title="예문 듣기"
                  aria-label="예문 듣기"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {data.example_translation}
              </p>
              {data.speaking_tip ? (
                <div className="border-t border-slate-200 pt-2 text-[11px] leading-relaxed dark:border-slate-800/60">
                  <p className="text-blue-600 dark:text-blue-400/90">발음 팁</p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{data.speaking_tip}</p>
                </div>
              ) : null}
            </div>
          )}

          {/* [탭 2] 비즈니스 뉘앙스 */}
          {activeTab === 'nuance' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                🔍 왜 사전에 나오는 뜻과 다를까요?
              </p>
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {data.nuance}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. 하단 액션 버튼 */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800/80">
        <button
          onClick={() => {
            setActiveTab('example');
          }}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          다시 보기
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-medium transition-all ${
            onNext
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 active:scale-95"
              : "cursor-default bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          <span>{nextLabel ?? "완료 & 다음 단어"}</span>
          {onNext ? <ChevronRight className="w-4 h-4" /> : null}
        </button>
      </div>
    </div>
  );
}