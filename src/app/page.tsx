"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
      setTheme("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-primary text-text-primary px-4 transition-colors duration-250 selection:bg-voltage-violet/20 selection:text-ultra-violet">
      {/* Floating Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-mist bg-card-bg text-lg shadow-sm transition-all hover:scale-110 active:scale-95"
        title="Переключить тему"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      {/* Decorative gradient orbs */}
      <div className="absolute top-[10%] left-[-10%] -z-10 h-[500px] w-[500px] rounded-full bg-radial from-voltage-violet/15 via-magenta-spark/5 to-transparent opacity-[var(--orb-opacity)] blur-[80px]" />
      <div className="absolute bottom-[10%] right-[-15%] -z-10 h-[500px] w-[500px] rounded-full bg-radial from-amber-pulse/10 via-hot-pink-ray/5 to-transparent opacity-[var(--orb-opacity)] blur-[80px]" />

      {/* Main minimal container */}
      <div className="w-full max-w-3xl py-12">
        {/* Simple minimal header */}
        <div className="text-center mb-12">
          <span className="text-3xl inline-block mb-3 animate-bounce">✨</span>
          <h1 className="font-bricolage text-3xl font-bold tracking-tight text-midnight-ink">
            Для тебя, любимая
          </h1>
        </div>

        {/* Clean, premium grid of the two cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Card 1 — Puzzle Preview */}
          <div className="group relative rounded-cards border border-mist bg-card-bg p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl flex flex-col justify-between">
            <div>
              {/* macOS traffic light dots */}
              <div className="flex gap-1.5 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc20]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>

              <div className="relative overflow-hidden rounded-images aspect-video bg-[#ebdafd] flex items-center justify-center mb-6">
                <span className="text-4xl">🧩</span>
                {/* Decorative mini gradients */}
                <div className="absolute bottom-[-20px] right-[-20px] h-20 w-20 rounded-full bg-voltage-violet/30 blur-md" />
              </div>

              <h3 className="text-left font-bricolage text-heading-sm font-bold text-midnight-ink mb-2">
                Собрать Пазлы
              </h3>
              <p className="text-left font-inter text-body-sm text-slate mb-6">
                Фотографии под знаком вопроса. Каждая картинка откроет себя только
                тогда, когда ты её полностью соберёшь.
              </p>
            </div>

            <a
              href="/puzzle"
              className="flex items-center justify-center w-full rounded-buttons bg-voltage-violet py-3.5 font-inter text-sm font-semibold text-white transition-all hover:bg-ultra-violet hover:scale-[1.02]"
              style={{ boxShadow: "var(--shadow-subtle)" }}
            >
              Открыть пазлы →
            </a>
          </div>

          {/* Card 2 — Heart Preview */}
          <div className="group relative rounded-cards border border-mist bg-card-bg p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl flex flex-col justify-between">
            <div>
              {/* macOS traffic light dots */}
              <div className="flex gap-1.5 mb-4">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc20]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>

              <div className="relative overflow-hidden rounded-images aspect-video bg-[#d6fcf4] flex items-center justify-center mb-6">
                <span className="text-4xl text-[#111827]">❤</span>
                {/* Decorative mini gradients */}
                <div className="absolute bottom-[-20px] right-[-20px] h-20 w-20 rounded-full bg-magenta-spark/30 blur-md" />
              </div>

              <h3 className="text-left font-bricolage text-heading-sm font-bold text-midnight-ink mb-2">
                Оживающее Сердце
              </h3>
              <p className="text-left font-inter text-body-sm text-slate mb-6">
                Интерактивное полотно, наполняющееся теплыми словами в форме
                бьющегося сердца.
              </p>
            </div>

            <a
              href="/heart"
              className="flex items-center justify-center w-full rounded-buttons bg-midnight-ink py-3.5 font-inter text-sm font-semibold text-pure-white transition-all hover:bg-graphite hover:scale-[1.02]"
            >
              Открыть сердечко →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
