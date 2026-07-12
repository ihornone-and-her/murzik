"use client";

import { useEffect, useRef, useState } from "react";

export default function HeartPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const startedRef = useRef(false);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W: number, H: number, cx: number, cy: number, S: number;
    let startTime = 0;
    let animationId = 0;
    let filled = false;
    let messageShown = false;

    const mask = document.createElement("canvas");
    const maskCtx = mask.getContext("2d")!;
    maskRef.current = mask;

    const FONT_FAMILY = "'Inter', sans-serif";
    const HEART_SCALE = 0.028;
    const TOP_MARGIN_RATIO = 0.04;

    const words = ["I LOVE YOU", "LOVE", "YOU", "I LOVE", "♥", "LOVE YOU", "I"];
    const phaseDurations = [2500, 3000, 3000];

    const batchConfigs = [
      { batchSize: 8, minSize: 14, maxSize: 28, minAlpha: 0.6, maxAlpha: 0.9, minLit: 45, maxLit: 70 },
      { batchSize: 20, minSize: 8, maxSize: 20, minAlpha: 0.4, maxAlpha: 0.75, minLit: 35, maxLit: 65 },
      { batchSize: 40, minSize: 4, maxSize: 14, minAlpha: 0.25, maxAlpha: 0.6, minLit: 25, maxLit: 60 },
    ];

    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.2 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: 0.003 + Math.random() * 0.01,
    }));

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
      S = Math.min(W, H) * HEART_SCALE;
      buildMask();
    }

    function heartX(t: number) {
      return 16 * Math.pow(Math.sin(t), 3);
    }

    function heartY(t: number) {
      return -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    }

    function drawHeartPath(c: CanvasRenderingContext2D, x: number, y: number, s: number, offsetY: number) {
      c.beginPath();
      for (let i = 0; i <= 300; i++) {
        const t = (i / 300) * Math.PI * 2;
        const px = x + heartX(t) * s;
        const py = y + heartY(t) * s + offsetY;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    }

    function isInsideHeart(nx: number, ny: number) {
      const xx = nx * nx;
      return Math.pow(xx + ny * ny - 1, 3) - xx * ny * ny * ny <= 0;
    }

    function buildMask() {
      mask.width = W;
      mask.height = H;
      maskCtx.clearRect(0, 0, W, H);
      maskCtx.save();
      drawHeartPath(maskCtx, cx, cy, S, H * TOP_MARGIN_RATIO);
      maskCtx.clip();
    }

    function getPhase(elapsed: number) {
      if (elapsed < phaseDurations[0]) return { phase: 0, t: elapsed / phaseDurations[0] };
      elapsed -= phaseDurations[0];
      if (elapsed < phaseDurations[1]) return { phase: 1, t: elapsed / phaseDurations[1] };
      elapsed -= phaseDurations[1];
      if (elapsed < phaseDurations[2]) return { phase: 2, t: elapsed / phaseDurations[2] };
      return { phase: 3, t: 1 };
    }

    function randomPointInHeart() {
      for (let i = 0; i < 50; i++) {
        const nx = (Math.random() - 0.5) * 2;
        const ny = (Math.random() - 0.5) * 2;
        if (isInsideHeart(nx, ny)) {
          return { x: cx + nx * 16 * S, y: cy - ny * 16 * S + H * TOP_MARGIN_RATIO };
        }
      }
      return { x: cx, y: cy };
    }

    function fillBatch(phase: number) {
      const cfg = batchConfigs[phase];
      if (!cfg) return;
      for (let i = 0; i < cfg.batchSize; i++) {
        const pt = randomPointInHeart();
        const word = words[Math.floor(Math.random() * words.length)];
        const size = cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize);
        const alpha = cfg.minAlpha + Math.random() * (cfg.maxAlpha - cfg.minAlpha);
        const hue = 330 + Math.random() * 50;
        const sat = 55 + Math.random() * 45;
        const lit = cfg.minLit + Math.random() * (cfg.maxLit - cfg.minLit);
        maskCtx.save();
        maskCtx.translate(pt.x, pt.y);
        maskCtx.rotate((Math.random() - 0.5) * 0.8);
        maskCtx.globalAlpha = alpha;
        maskCtx.font = `bold ${size}px ${FONT_FAMILY}`;
        maskCtx.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
        maskCtx.textAlign = "center";
        maskCtx.textBaseline = "middle";
        maskCtx.fillText(word, 0, 0);
        maskCtx.restore();
      }
    }

    function drawStars(time: number) {
      for (const star of stars) {
        const a = 0.15 + 0.3 * Math.sin(star.phase + time * star.speed);
        ctx.beginPath();
        ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      }
    }

    function breathe(time: number) {
      const t = (time % 1400) / 1400;
      if (t < 0.08) return 1 + 0.025 * Math.sin((t / 0.08) * Math.PI);
      if (t > 0.13 && t < 0.21) return 1 + 0.015 * Math.sin(((t - 0.13) / 0.08) * Math.PI);
      return 1;
    }

    function render(time: number) {
      animationId = requestAnimationFrame(render);
      const elapsed = time - startTime;
      const { phase } = getPhase(elapsed);

      if (phase < 3) fillBatch(phase);
      else if (!filled) {
        filled = true;
        for (let i = 0; i < 200; i++) fillBatch(2);
      }

      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, W, H);
      drawStars(time);

      const offsetY = H * TOP_MARGIN_RATIO;
      const scale = filled ? breathe(time) : 1;
      ctx.save();
      ctx.translate(cx, cy + offsetY);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -(cy + offsetY));
      ctx.drawImage(mask, 0, 0);
      ctx.restore();

      if (filled && !messageShown) {
        messageShown = true;
        setTimeout(() => setShowMessage(true), 300);
      }
    }

    function start() {
      if (startedRef.current) return;
      startedRef.current = true;
      startTime = performance.now();
      requestAnimationFrame(render);
    }

    resize();
    window.addEventListener("resize", () => {
      if (startedRef.current) {
        resize();
        filled = false;
        messageShown = false;
        setShowMessage(false);
        maskCtx.clearRect(0, 0, W, H);
        maskCtx.save();
        drawHeartPath(maskCtx, cx, cy, S, H * TOP_MARGIN_RATIO);
        maskCtx.clip();
      }
    });

    return () => cancelAnimationFrame(animationId);
  }, []);

  function handleOpen() {
    setShowIntro(false);
    startedRef.current = false;
    setTimeout(() => {
      startedRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;
      const cy = H / 2;
      const S = Math.min(W, H) * 0.028;
      const TOP_MARGIN = H * 0.04;

      const mask = maskRef.current;
      if (!mask) return;
      const maskCtx = mask.getContext("2d")!;
      maskCtx.clearRect(0, 0, W, H);
      maskCtx.save();
          const drawPath = (c: CanvasRenderingContext2D, x: number, y: number, s: number, off: number) => {
            c.beginPath();
            for (let i = 0; i <= 300; i++) {
              const t = (i / 300) * Math.PI * 2;
              const px = x + 16 * Math.pow(Math.sin(t), 3) * s;
              const py = y + -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * s + off;
              if (i === 0) c.moveTo(px, py);
              else c.lineTo(px, py);
            }
            c.closePath();
          };
          drawPath(maskCtx, cx, cy, S, TOP_MARGIN);
          maskCtx.clip();

      const startTime = performance.now();
      let filled = false;
      let messageShown = false;

      const words = ["I LOVE YOU", "LOVE", "YOU", "I LOVE", "♥", "LOVE YOU", "I"];
      const phaseDurations = [2500, 3000, 3000];
      const batchConfigs = [
        { batchSize: 8, minSize: 14, maxSize: 28, minAlpha: 0.6, maxAlpha: 0.9, minLit: 45, maxLit: 70 },
        { batchSize: 20, minSize: 8, maxSize: 20, minAlpha: 0.4, maxAlpha: 0.75, minLit: 35, maxLit: 65 },
        { batchSize: 40, minSize: 4, maxSize: 14, minAlpha: 0.25, maxAlpha: 0.6, minLit: 25, maxLit: 60 },
      ];
      const stars = Array.from({ length: 80 }, () => ({
        x: Math.random(), y: Math.random(),
        r: Math.random() * 1.2 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.003 + Math.random() * 0.01,
      }));

      function isInsideHeart(nx: number, ny: number) {
        const xx = nx * nx;
        return Math.pow(xx + ny * ny - 1, 3) - xx * ny * ny * ny <= 0;
      }
      function randomPoint() {
        for (let i = 0; i < 50; i++) {
          const nx = (Math.random() - 0.5) * 2;
          const ny = (Math.random() - 0.5) * 2;
          if (isInsideHeart(nx, ny)) return { x: cx + nx * 16 * S, y: cy - ny * 16 * S + TOP_MARGIN };
        }
        return { x: cx, y: cy };
      }
      function fillBatch(phase: number) {
        const cfg = batchConfigs[phase];
        if (!cfg || !mask) return;
        const mc = mask.getContext("2d");
        if (!mc) return;
        for (let i = 0; i < cfg.batchSize; i++) {
          const pt = randomPoint();
          const word = words[Math.floor(Math.random() * words.length)];
          const size = cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize);
          const alpha = cfg.minAlpha + Math.random() * (cfg.maxAlpha - cfg.minAlpha);
          const hue = 330 + Math.random() * 50;
          const sat = 55 + Math.random() * 45;
          const lit = cfg.minLit + Math.random() * (cfg.maxLit - cfg.minLit);
          mc.save();
          mc.translate(pt.x, pt.y);
          mc.rotate((Math.random() - 0.5) * 0.8);
          mc.globalAlpha = alpha;
          mc.font = `bold ${size}px 'Inter', sans-serif`;
          mc.fillStyle = `hsl(${hue}, ${sat}%, ${lit}%)`;
          mc.textAlign = "center";
          mc.textBaseline = "middle";
          mc.fillText(word, 0, 0);
          mc.restore();
        }
      }

      function render(time: number) {
        requestAnimationFrame(render);
        const elapsed = time - startTime;
        let phase = 0;
        let rem = elapsed;
        if (rem >= phaseDurations[0]) { phase = 1; rem -= phaseDurations[0]; }
        if (phase === 1 && rem >= phaseDurations[1]) { phase = 2; rem -= phaseDurations[1]; }
        if (phase === 2 && rem >= phaseDurations[2]) phase = 3;

        if (phase < 3) fillBatch(phase);
        else if (!filled) { filled = true; for (let i = 0; i < 200; i++) fillBatch(2); }

        ctx.fillStyle = "#0a0a0f";
        ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
          const a = 0.15 + 0.3 * Math.sin(s.phase + time * s.speed);
          ctx.beginPath();
          ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fill();
        }

        const bT = (time % 1400) / 1400;
        let sc = 1;
        if (bT < 0.08) sc = 1 + 0.025 * Math.sin((bT / 0.08) * Math.PI);
        else if (bT > 0.13 && bT < 0.21) sc = 1 + 0.015 * Math.sin(((bT - 0.13) / 0.08) * Math.PI);

        ctx.save();
        ctx.translate(cx, cy + TOP_MARGIN);
        ctx.scale(sc, sc);
        ctx.translate(-cx, -(cy + TOP_MARGIN));
        ctx.drawImage(mask!, 0, 0);
        ctx.restore();

        if (filled && !messageShown) {
          messageShown = true;
          setTimeout(() => setShowMessage(true), 300);
        }
      }

      requestAnimationFrame(render);
    }, 50);
  }

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #0a0a0f; }
        body { display: flex; align-items: center; justify-content: center; }
      `}</style>

      {/* Intro screen */}
      {showIntro && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(17, 24, 39, 0.6)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}>
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              background: "var(--color-pure-white)",
              border: "1px solid var(--color-mist)",
              borderRadius: "50%",
              color: "var(--color-midnight-ink)",
              width: "40px",
              height: "40px",
              fontSize: "1.1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(134, 47, 231, 0.04)",
              zIndex: 110,
            }}
            title="Переключить тему"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* Supahub Modal Card */}
          <div style={{
            position: "relative",
            textAlign: "center", padding: "2.5rem 2rem", borderRadius: "24px",
            background: "var(--color-pure-white)", border: "1px solid var(--color-mist)",
            boxShadow: "0 20px 40px rgba(134, 47, 231, 0.12)",
            maxWidth: 440, width: "90vw",
            fontFamily: "var(--font-inter)",
          }}>
            {/* macOS traffic light dots */}
            <div style={{ display: "flex", gap: "6px", position: "absolute", top: "18px", left: "20px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f57" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#febc20" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#28c840" }} />
            </div>

            {/* Back link */}
            <a href="/" style={{
              position: "absolute", top: "12px", right: "20px",
              fontFamily: "var(--font-inter)", fontSize: "0.85rem",
              fontWeight: 500, color: "var(--color-graphite)", textDecoration: "none",
            }}>← Назад</a>

            <span style={{
              display: "block", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              color: "#862fe7", marginBottom: "1rem", marginTop: "1rem"
            }}>ИНСТАЛЛЯЦИЯ СЕРДЦА</span>

            <h1 style={{
              fontFamily: "var(--font-bricolage)", fontSize: "2rem",
              fontWeight: 600, color: "var(--color-midnight-ink)", margin: "0 0 0.8rem",
              letterSpacing: "-0.8px",
              lineHeight: 1.25,
            }}>Дашенька, люблю тебя</h1>

            <p style={{
              fontSize: "14px",
              fontWeight: 400, color: "var(--color-slate)", margin: "0 0 2rem",
              lineHeight: 1.5,
            }}>Нажми на кнопку ниже, чтобы увидеть оживающее облако слов любви…</p>

            <button onClick={handleOpen} style={{
              fontSize: "16px",
              fontWeight: 600, color: "#fff",
              background: "#862fe7",
              border: "none", borderRadius: "12px",
              padding: "0.9rem 2.8rem", cursor: "pointer",
              boxShadow: "rgba(11, 61, 121, 0.16) 0px 0px 0px 1px inset",
              transition: "transform 0.2s, background 0.2s",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.02)";
              e.currentTarget.style.backgroundColor = "#5f259e";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "";
              e.currentTarget.style.backgroundColor = "#862fe7";
            }}>❤️ Открыть</button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 1 }} />

      {/* Message overlay */}
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, pointerEvents: "none" }}>
        <span style={{
          fontFamily: "'Dancing Script', cursive",
          fontSize: "clamp(2.5rem, 7vw, 5.5rem)", fontWeight: 700, color: "#fff",
          textShadow: "0 0 20px rgba(255,70,120,0.8), 0 0 60px rgba(255,70,120,0.4), 0 0 100px rgba(255,70,120,0.2)",
          opacity: showMessage ? 1 : 0, transform: showMessage ? "scale(1)" : "scale(0.7)",
          transition: "opacity 1.8s cubic-bezier(0.23,1,0.32,1), transform 1.8s cubic-bezier(0.23,1,0.32,1)",
          letterSpacing: "0.05em",
        }}>I Love You ❤</span>
      </div>
    </>
  );
}

