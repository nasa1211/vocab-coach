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
    <div className="w-full max-w-md p-5 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full font-medium">
          출퇴근 3분 코치
        </span>
        <span className="text-xs text-slate-400">PWA Web Push</span>
      </div>
      <h3 className="font-bold text-base mb-1">하루 세 번, 단어와 예문</h3>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        아침 8시, 낮 1시, 저녁 6시에 오늘 공부할 단어와 예문을 알림으로 받습니다.
      </p>
      <button
        onClick={handleSubscribe}
        disabled={isSubscribed || loading}
        className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
          isSubscribed
            ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 cursor-default'
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95'
        }`}
      >
        {loading ? (
          '설정 중...'
        ) : isSubscribed ? (
          '✓ 학습 알림 켜짐'
        ) : (
          '🔔 하루 세 번 알림 켜기'
        )}
      </button>
    </div>
  );
}