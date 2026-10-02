// app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { subscription, notificationTime = '08:00:00' } = await req.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: '유효하지 않은 구독 정보입니다.' },
        { status: 400 }
      );
    }

    const { endpoint, keys } = subscription;

    // Supabase DB에 Upsert (endpoint 기준으로 중복 방지)
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(
        {
          endpoint: endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          notification_time: notificationTime,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('Supabase DB 저장 실패:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '푸시 알림 구독 정보가 DB에 저장되었습니다.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}