import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// KST (Asia/Seoul) 기준 YYYY-MM-DD 날짜 구하기 함수 (Vercel UTC 시차 방지)
function getKSTDateString(dateObj: Date = new Date()): string {
  const kstOffset = 9 * 60; // UTC+9
  const kstDate = new Date(dateObj.getTime() + (dateObj.getTimezoneOffset() + kstOffset) * 60000);
  return kstDate.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authHeader = req.headers.get('Authorization');

    // 1. Supabase SSR 클라이언트 생성
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
        // Bearer 토큰이 들어왔을 경우 글로벌 헤더 설정 (RLS 우회 및 인증 유지용)
        global: authHeader && authHeader.startsWith('Bearer ')
          ? { headers: { Authorization: authHeader } }
          : undefined,
      }
    );

    // 2. 사용자 인증 처리
    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data, error } = await supabase.auth.getUser(token);
      if (!error) user = data.user;
    } else {
      const { data, error } = await supabase.auth.getUser();
      if (!error) user = data.user;
    }

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다. 다시 로그인해주세요.' },
        { status: 401 }
      );
    }

    // 3. 현재 사용자 프로필 조회 (RLS 지원)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, current_streak, longest_streak, last_visited_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '사용자 프로필을 찾을 수 없습니다.', details: profileError?.message },
        { status: 404 }
      );
    }

    // 4. KST 기준 오늘/어제 날짜 계산
    const todayStr = getKSTDateString();
    
    const yesterdayObj = new Date();
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayStr = getKSTDateString(yesterdayObj);

    const lastVisitedStr = profile.last_visited_at;

    // 이미 오늘 출석을 완료한 경우
    if (lastVisitedStr === todayStr) {
      return NextResponse.json({
        success: true,
        message: '이미 오늘 출석 완료되었습니다.',
        current_streak: profile.current_streak || 0,
        longest_streak: profile.longest_streak || 0,
      });
    }

    // 연속 출석 일수(Streak) 계산
    let newStreak = 1;
    if (lastVisitedStr === yesterdayStr) {
      // 어제 연속해서 접속한 경우 streak 증가
      newStreak = (profile.current_streak || 0) + 1;
    }

    const newLongest = Math.max(newStreak, profile.longest_streak || 0);

    // 5. DB 출석 상태 및 날짜 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_visited_at: todayStr,
      })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: '출석 상태 업데이트 실패', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `🎉 출석 완료! ${newStreak}일 연속 학습 중입니다.`,
      current_streak: newStreak,
      longest_streak: newLongest,
    });
  } catch (error: any) {
    console.error('❌ /api/attendance 서버 에러:', error);
    return NextResponse.json(
      { error: '서버 내부 오류가 발생했습니다.', details: error?.message },
      { status: 500 }
    );
  }
}