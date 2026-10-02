"use client";

import { useEffect, useState } from "react";
import { urlBase64ToUint8Array } from "@/lib/urlBase64ToUint8Array";

function isHomeScreenApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function PushSubscriptionButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      if (!("PushManager" in window)) return;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;
      setIsSubscribed(true);
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
    });
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (isIos() && !isHomeScreenApp()) {
          alert("아이폰에서는 홈 화면에 추가한 아이콘으로 연 뒤에 알림을 켤 수 있습니다.");
        } else {
          alert("이 브라우저는 푸시 알림을 지원하지 않습니다.");
        }
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("알림 권한이 거부되었습니다.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        alert("NEXT_PUBLIC_VAPID_PUBLIC_KEY 환경 변수가 설정되지 않았습니다.");
        return;
      }
      const convertedVapidKey = urlBase64ToUint8Array(publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });

      const saveRes = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });

      if (!saveRes.ok) {
        alert("알림 구독을 저장하지 못했습니다.");
        return;
      }

      setIsSubscribed(true);

      const testRes = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          title: "학습 알림이 켜졌습니다",
          body: "아침 8시, 낮 1시, 저녁 6시에 단어와 예문이 도착합니다.",
          url: "/?tab=today",
        }),
      });

      if (testRes.ok) {
        alert("하루 세 번 단어 알림을 저장했습니다.");
      } else {
        alert("구독은 저장됐지만 확인 알림은 보내지 못했습니다.");
      }
    } catch (error) {
      console.error("푸시 구독 중 오류 발생:", error);
      alert("구독 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      if (!("serviceWorker" in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;
      if (endpoint) {
        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        if (!response.ok) {
          alert("알림을 끄지 못했습니다.");
          return;
        }
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (error) {
      console.error("푸시 구독 해제 중 오류 발생:", error);
      alert("알림을 끄지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">아침 8시 · 낮 1시 · 저녁 6시</p>
      <button
        type="button"
        onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
        disabled={loading}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          isSubscribed
            ? "border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            : "bg-blue-600 text-white hover:bg-blue-500 active:scale-95"
        }`}
      >
        {loading ? "설정 중..." : isSubscribed ? "알림 끄기" : "알림 켜기"}
      </button>
    </div>
  );
}
