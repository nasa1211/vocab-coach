'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Sparkles } from 'lucide-react';

export default function AuthModal() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  // 1. Google 소셜 로그인
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
  };

  // 2. 이메일 매직링크 로그인
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(`오류 발생: ${error.message}`);
    } else {
      setMessage('📩 이메일로 로그인 링크가 전송되었습니다!');
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl text-slate-100">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 bg-blue-500/10 text-blue-400 rounded-2xl mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold">3분 단어장 시작하기</h2>
        <p className="text-xs text-slate-400 mt-1">로그인하고 학습 스트릭을 기록해 보세요.</p>
      </div>

      {/* Google 로그인 */}
      <button
        onClick={handleGoogleLogin}
        className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 mb-4"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
        Google 계정으로 계속하기
      </button>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
        <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-slate-900 px-2 text-slate-500">또는 이메일</span></div>
      </div>

      {/* 이메일 매직링크 */}
      <form onSubmit={handleMagicLink} className="space-y-3">
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-blue-600/20"
        >
          {loading ? '전송 중...' : '매직링크로 로그인'}
        </button>
      </form>

      {message && <p className="mt-3 text-center text-xs text-emerald-400">{message}</p>}
    </div>
  );
}