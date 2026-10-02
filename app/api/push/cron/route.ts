// app/api/push/cron/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import webpush from 'web-push';

// VAPID 세팅
webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function GET(req: NextRequest) {
  try {
    // 보안: Vercel Cron 등의 인증 헤더 검증 (CRON_SECRET)
    const authHeader = req.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 });
    }

    // 1. DB에서 활성화된 전체 구독 리스트 조회
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*');

    if (error || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: '발송할 대상이 없습니다.' });
    }

    // 2. 발송할 알림 메세지 구성
    const payload = JSON.stringify({
      title: '☕ 출근길 3분 비즈니스 단어',
      body: '오늘 미팅에서 바로 활용 가능한 고급 어휘 표현 3개가도착했습니다!',
      icon: '/icons/icon-192x192.png',
      data: { url: '/' },
    });

    // 3. 비동기 병렬 푸시 전송 처리
    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        return { id: sub.id, status: 'success' };
      } catch (err: any) {
        // 410 Gone 또는 404 Not Found는 사용자가 브라우저에서 알림을 취소했거나 만료된 상태 -> DB 정리
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('subscriptions').delete().eq('id', sub.id);
          console.log(`만료된 구독 정보 삭제 완료 (ID: ${sub.id})`);
        }
        return { id: sub.id, status: 'failed', error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      totalCount: subscriptions.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}