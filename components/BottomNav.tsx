"use client";

import { useEffect, useRef, useState } from "react";

export type AppTab = "today" | "history" | "settings";

const TABS: { id: AppTab; icon: string; label: string }[] = [
  { id: "today", icon: "📖", label: "오늘" },
  { id: "history", icon: "🕒", label: "기록" },
  { id: "settings", icon: "⚙️", label: "설정" },
];

export default function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768 && window.innerHeight >= 600);
    };
    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (isDesktop) {
        setShowBottomNav(true);
        return;
      }

      const currentScrollY = window.scrollY;
      if (currentScrollY < 20) {
        setShowBottomNav(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      if (Math.abs(currentScrollY - lastScrollY.current) > 10) {
        if (currentScrollY > lastScrollY.current) {
          setShowBottomNav(false);
        } else {
          setShowBottomNav(true);
        }
        lastScrollY.current = currentScrollY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isDesktop]);

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md transition-transform duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-900/95 ios-safe-bottom ${
        isDesktop || showBottomNav ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-3 items-center px-2 landscape:h-12 md:h-16">
        {TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex h-full cursor-pointer flex-col items-center justify-center transition-all ${
                selected
                  ? "scale-105 text-blue-600 dark:text-blue-400"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="mt-0.5 text-[11px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
