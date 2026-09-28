'use client';

import { useState, useEffect } from 'react';
import WordCard, { WordData } from '@/components/WordCard';
import PushSubscriptionButton from '@/components/PushSubscriptionButton';
import ImageWordUploader from '@/components/ImageWordUploader';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

const SAMPLE_WORD: WordData = {
  word: 'Touch base',
  phonetic: '/tʌtʃ beɪs/',
  meaning: '(건으로) 간단히 연락하다 / 소통하다',
  category: 'Business English',
  nuance:
    '공식적인 긴 미팅이 아니라, 진행 상황을 가볍게 점검하거나 의견을 교환하기 위해 연락할 때 쓰는 대표적인 직장인 표현입니다.',
  example_sentence: "Let's touch base on this before EOD.",
  example_translation: '오늘 퇴근 전(EOD)에 이 건으로 간단히 이야기 나누시죠.',
  speaking_tip: "'터치'와 '베이스'를 멈추지 말고 '터치베이스'처럼 이어서 발음하세요.",
  quick_quiz: {
    question: "다음 중 'Touch base'와 가장 가까운 표현은?",
    options: ['진행 상황 짧게 체크하기', '계약서에 서명하기', '사과 인사 전하기'],
    answer_index: 0,
    explanation: "'Touch base'는 간단한 경과 보고나 연락을 뜻합니다.",
  },
};

export default function HomePage() {
  const [wordData, setWordData] = useState<WordData>(SAMPLE_WORD);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const supabase = createClient();

  // 1. 컴포넌트 상단 state 목록에 이미 나온 단어 이력(history) 상태 추가
  const [history, setHistory] = useState<string[]>([SAMPLE_WORD.word]);


  // 1. 초기 세션 체크 및 로그인 상태 변경 리스너 등록
  useEffect(() => {
    // 현재 세션 가져오기
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 실시간 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 구글 소셜 로그인
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  // 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };


// 2. handleFetchNextWord 함수 수정
const handleFetchNextWord = async () => {
  setLoading(true);
  setToastMessage(null);

  try {
    const { data: { session } } = await supabase.auth.getSession();

    // [A] 로그인한 사용자만 출석 체크 API 실행
    if (session?.access_token) {
      const attendRes = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (attendRes.ok) {
        const attendData = await attendRes.json();
        if (attendData.success) {
          setToastMessage(`🎉 오늘 학습 완료! ${attendData.current_streak}일 연속 학습 중!`);
        }
      } else {
        const errorData = await attendRes.json();
        console.error('출석 체크 실패:', errorData);
      }
    }

    // [B] 무작위 신규 AI 단어 추천 요청 (word 하드코딩 제거 및 히스토리 전달)
    const wordRes = await fetch('/api/generate-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        category: 'Business',
        excludeHistory: history // 👈 최근 나온 단어 목록을 전달하여 중복 방지
      }),
    });

    if (wordRes.ok) {
      const newWord: WordData = await wordRes.json();
      setWordData(newWord);

      // 새로운 단어를 히스토리에 추가 (최근 10개까지 관리)
      if (newWord.word) {
        setHistory((prev) => [...prev.slice(-9), newWord.word]);
      }
    }
  } catch (err) {
    console.error('학습 및 단어 불러오기 실패:', err);
  } finally {
    setLoading(false);
    setTimeout(() => setToastMessage(null), 3000);
  }
};

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 flex flex-col items-center justify-center gap-5 relative">
      {/* 출석 축하 토스트 알림 */}
      {toastMessage && (
        <div className="fixed top-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-full shadow-lg text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* 상단 사용자 로그인/게스트 상태 표시 바 */}
      <div className="w-full max-w-md flex justify-between items-center text-xs px-1">
        <span className="text-slate-400">
          {user ? (
            <span className="text-emerald-400 font-medium">● 출석 기록 중</span>
          ) : (
            <span className="text-slate-500">👀 게스트 학습 모드</span>
          )}
        </span>

        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-300 truncate max-w-[150px]">{user.email}</span>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg border border-slate-800 transition-all"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <span>🔑</span> 구글 로그인
          </button>
        )}
      </div>

      {/* 서비스 타이틀 헤더 */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Adult AI Vocab <span className="text-blue-500 text-sm font-normal">3-Min Coach</span>
        </h1>
        <p className="text-xs text-slate-400">
          바쁜 직장인을 위한 출퇴근 맞춤 실전 영단어
        </p>
      </div>

      {/* 게스트 유저 로그인 유도 배너 (비로그인 상태일 때만 노출) */}
      {!user && (
        <div className="w-full max-w-md p-3 bg-blue-950/40 border border-blue-800/40 rounded-2xl flex items-center justify-between text-xs">
          <p className="text-slate-300">
            💡 로그인하면 <strong className="text-blue-400">연속 출석 스트릭</strong>이 기록됩니다.
          </p>
          <button
            onClick={handleLogin}
            className="text-blue-400 font-bold underline underline-offset-2 hover:text-blue-300 shrink-0 ml-2"
          >
            로그인하기
          </button>
        </div>
      )}

      {/* 상단 액션 영역 (푸시 알림 구독 & OCR 이미지 업로더) */}
      <div className="w-full max-w-md space-y-3">
        <PushSubscriptionButton />
        <ImageWordUploader onWordGenerated={(newWord) => setWordData(newWord)} />
      </div>

      {/* 플래시 카드 UI 영역 */}
      <div className="w-full max-w-md">
        {loading ? (
          <div className="w-full h-[520px] bg-slate-900/50 border border-slate-800 rounded-3xl flex items-center justify-center">
            <p className="text-xs text-slate-400 animate-pulse">
              AI 멘토가 다음 실전 단어를 준비 중입니다...
            </p>
          </div>
        ) : (
          <WordCard data={wordData} onNext={handleFetchNextWord} />
        )}
      </div>
    </main>
  );
}