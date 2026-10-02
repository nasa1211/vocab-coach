'use client';

import { useState } from 'react';
import { Volume2, Sparkles, CheckCircle2, RefreshCw, ChevronRight } from 'lucide-react';

export interface QuickQuiz {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
}

export interface WordData {
  word: string;
  phonetic: string;
  meaning: string;
  category: string;
  nuance: string;
  example_sentence: string;
  example_translation: string;
  speaking_tip: string;
  quick_quiz: QuickQuiz;
}

interface WordCardProps {
  data: WordData;
  onNext?: () => void;
}

export default function WordCard({ data, onNext }: WordCardProps) {
  const [activeTab, setActiveTab] = useState<'example' | 'nuance' | 'quiz'>('example');
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // 💡 개선된 음성 재생 (TTS) 함수
  const handlePlayAudio = () => {
    if (!('speechSynthesis' in window)) {
      alert('이 브라우저는 음성 재생을 지원하지 않습니다.');
      return;
    }

    // 이전 재생 취소 (중복 방지)
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(data.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;   // 속도: 약간 천천히 (자연스러운 학습용)
    utterance.pitch = 1.15; // 💡 톤 높이기: 저음/할아버지 목소리 현상 해결

    const playWithBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();

      if (voices.length > 0) {
        // 영어 음성 중 자연스러운 고품질/여성 음성 우선 검색
        const preferredVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Victoria') ||
              v.name.includes('Natural') ||
              v.name.includes('Female') ||
              v.name.includes('Karen'))
        );

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    };

    // 음성 목록(voices)이 비동기로 로드되는 브라우저 대응
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        playWithBestVoice();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      playWithBestVoice();
    }
  };

  const handleQuizSelect = (index: number) => {
    setSelectedAnswer(index);
    setShowExplanation(true);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100 flex flex-col justify-between min-h-[520px]">
      {/* 1. 상단 바 (카테고리 & 발음 듣기) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            {data.category}
          </span>
          <button
            onClick={handlePlayAudio}
            className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors active:scale-95"
            title="발음 듣기"
          >
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* 2. 핵심 표제어 & 발음기호 */}
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            {data.word}
          </h2>
          <p className="text-sm font-mono text-slate-400">{data.phonetic}</p>
          <p className="mt-3 text-lg font-semibold text-emerald-400">
            {data.meaning}
          </p>
        </div>

        {/* 3. 탭 네비게이션 */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl mb-5 text-xs font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('example')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'example'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            실전 예문
          </button>
          <button
            onClick={() => setActiveTab('nuance')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'nuance'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            비즈니스 뉘앙스
          </button>
          <button
            onClick={() => setActiveTab('quiz')}
            className={`py-2 rounded-lg transition-all ${
              activeTab === 'quiz'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            3초 퀴즈
          </button>
        </div>

        {/* 4. 탭 콘텐츠 영역 */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 min-h-[160px] flex flex-col justify-center">
          {/* [탭 1] 실전 예문 */}
          {activeTab === 'example' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-200 font-medium leading-relaxed">
                "{data.example_sentence}"
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {data.example_translation}
              </p>
              <div className="pt-2 border-t border-slate-800/60 text-[11px] text-blue-400/90 flex items-center gap-1">
                <span>💡 Speaking Tip:</span>
                <span className="text-slate-300">{data.speaking_tip}</span>
              </div>
            </div>
          )}

          {/* [탭 2] 비즈니스 뉘앙스 */}
          {activeTab === 'nuance' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-300">
                🔍 왜 사전에 나오는 뜻과 다를까요?
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {data.nuance}
              </p>
            </div>
          )}

          {/* [탭 3] 3초 퀴즈 */}
          {activeTab === 'quiz' && (
            <div>
              <p className="text-xs font-medium text-slate-200 mb-3">
                {data.quick_quiz.question}
              </p>
              <div className="space-y-2">
                {data.quick_quiz.options.map((option, idx) => {
                  const isCorrect = idx === data.quick_quiz.answer_index;
                  const isSelected = selectedAnswer === idx;

                  let btnStyle = 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80';
                  if (showExplanation) {
                    if (isCorrect) btnStyle = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                    else if (isSelected) btnStyle = 'bg-rose-500/20 text-rose-300 border border-rose-500/40';
                  }

                  return (
                    <button
                      key={idx}
                      disabled={showExplanation}
                      onClick={() => handleQuizSelect(idx)}
                      className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all ${btnStyle}`}
                    >
                      {idx + 1}. {option}
                    </button>
                  );
                })}
              </div>
              {showExplanation && (
                <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                  {data.quick_quiz.explanation}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. 하단 액션 버튼 */}
      <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
        <button
          onClick={() => {
            setSelectedAnswer(null);
            setShowExplanation(false);
            setActiveTab('example');
          }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-800/60 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          다시 보기
        </button>

        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95"
        >
          <span>완료 & 다음 단어</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}