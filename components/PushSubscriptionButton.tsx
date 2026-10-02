'use client';

import { useState, useEffect } from 'react';
import { urlBase64ToUint8Array } from '@/lib/urlBase64ToUint8Array';

export default function PushSubscriptionButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.getRegistration().then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      setIsSubscribed(true);
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });
    });
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // 1. 브라우저 지원 여부 확인
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
        return;
      }

      // 2. 알림 권한 요청
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('알림 권한이 거부되었습니다.');
        return;
      }

      // 3. 서비스 워커 등록
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 4. VAPID 키 검증 및 변환
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        alert('NEXT_PUBLIC_VAPID_PUBLIC_KEY 환경 변수가 설정되지 않았습니다.');
        return;
      }
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      // 5. 브라우저 PushManager로 구독 신청 (타입 단언 적용)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // 사용자가 볼 수 있는 알림만 수신
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });

      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!saveRes.ok) {
        alert('알림 구독을 저장하지 못했습니다.');
        return;
      }

      setIsSubscribed(true);

      const testRes = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          title: '학습 알림이 켜졌습니다',
          body: '아침 8시, 낮 1시, 저녁 6시에 단어와 예문이 도착합니다.',
          url: '/',
        }),
      });

      if (testRes.ok) {
        alert('하루 세 번 단어 알림을 저장했습니다.');
      } else {
        alert('구독은 저장됐지만 확인 알림은 보내지 못했습니다.');
      }
    } catch (error) {
      console.error('푸시 구독 중 오류 발생:', error);
      alert('구독 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
      <p className="text-xs text-slate-400">아침 8시 · 낮 1시 · 저녁 6시</p>
      <button
        onClick={handleSubscribe}
        disabled={isSubscribed || loading}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          isSubscribed
            ? 'cursor-default text-emerald-400'
            : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-95'
        }`}
      >
        {loading ? '설정 중...' : isSubscribed ? '알림 켜짐' : '알림 켜기'}
      </button>
    </div>
  );
}