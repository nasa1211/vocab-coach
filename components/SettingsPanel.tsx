"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import PushSubscriptionButton from "@/components/PushSubscriptionButton";

const FONT_SCALE_KEY = "font_scale";

export default function SettingsPanel() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [fontScale, setFontScale] = useState("1");
  const [homeScreenHint, setHomeScreenHint] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(FONT_SCALE_KEY) || "1";
    setFontScale(saved);
    document.documentElement.style.setProperty("--font-scale", saved);
    setMounted(true);

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setHomeScreenHint(ios && !standalone);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  const changeFontScale = (scale: string) => {
    setFontScale(scale);
    localStorage.setItem(FONT_SCALE_KEY, scale);
    document.documentElement.style.setProperty("--font-scale", scale);
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="px-1">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <span>⚙️</span>
          <span>설정</span>
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">화면 테마, 글자 크기, 알림을 조절합니다.</p>
      </div>

      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">🌙 다크 모드</span>
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="다크 모드 토글"
            className={`flex h-6 w-12 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ${
              isDark ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <div
              className={`h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                isDark ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="space-y-2.5 border-b border-slate-100 pb-4 dark:border-slate-800">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">글자 크기</span>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>글자 크기 조절</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {Math.round(Number.parseFloat(fontScale) * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400">가</span>
            <input
              type="range"
              min="1"
              max="2"
              step="0.05"
              value={fontScale}
              onChange={(event) => changeFontScale(event.target.value)}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-700"
              aria-label="글자 크기 조절"
            />
            <span className="text-base font-bold text-slate-600 dark:text-slate-300">가</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>기본 (100%)</span>
            <span>최대 (200%)</span>
          </div>
        </div>

        <div className="space-y-3">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">학습 알림</span>
          <PushSubscriptionButton />
          {homeScreenHint ? (
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              허용 창은 홈 화면 아이콘으로 연 앱에서만 나옵니다. 이미 만들어 둔 아이콘은 지우고, 사파리에서 다시 홈 화면에 추가한 뒤 그 아이콘으로 여세요.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
