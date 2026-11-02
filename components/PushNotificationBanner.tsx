// components/PushNotificationBanner.tsx
'use client';

import { useState } from 'react';

export default function PushNotificationBanner() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('이 브라우저는 알림을 지원하지 않습니다.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setIsSubscribed(true);
      alert('학습 알림이 설정되었습니다.');
      // TODO: 서비스 워커 푸시 구독 정보(Subscription Object)를 서버/DB로 전송
    } else {
      alert('알림 권한이 거부되었습니다.');
    }
  };

  return (
    <div className="p-4 bg-slate-800 text-white rounded-xl shadow-md flex items-center justify-between">
      <div>
        <p className="font-bold text-sm">매일 3분, 단어 잊지 않기</p>
        <p className="text-xs text-slate-400">하루 세 번 알림 받기</p>
      </div>
      <button
        type="button"
        aria-pressed={isSubscribed}
        aria-label={isSubscribed ? '학습 알림 설정됨' : '학습 알림 켜기'}
        onClick={requestNotificationPermission}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-lg transition-colors"
      >
        {isSubscribed ? '알림 설정됨' : '알림 켜기'}
      </button>
    </div>
  );
}