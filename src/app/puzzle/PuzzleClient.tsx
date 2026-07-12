"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/* ===================================================================
   TYPES
   =================================================================== */

interface PieceData {
  col: number;
  row: number;
  canvas: HTMLCanvasElement;
  correctX: number;
  correctY: number;
  placed: boolean;
  inTray: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EdgeParams {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  flip: boolean;
}

interface BoardInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  pieceW: number;
  pieceH: number;
  pad: number;
}

interface TrayInfo {
  areaTop: number;
  gap: number;
  padding: number;
  pieceW: number;
  pieceH: number;
  scrollX: number;
  maxScroll: number;
}

interface ConfettiP {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  rot: number;
  rs: number;
}

interface AmbientParticle {
  x: number;
  y: number;
  r: number;
  p: number;
  s: number;
  color: string;
}

interface TouchInfo {
  startX: number;
  startY: number;
  phase: "waiting" | "scrolling" | "dragging";
  piece: PieceData | null;
  scrollStartX: number;
  offsetX: number;
  offsetY: number;
}

interface DragInfo {
  piece: PieceData;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

interface GameState {
  img: HTMLImageElement;
  pieces: PieceData[];
  board: BoardInfo;
  tray: TrayInfo;
  particles: AmbientParticle[];
  confetti: ConfettiP[];
  completed: boolean;
  placedCount: number;
  totalPieces: number;
  W: number;
  H: number;
  cols: number;
  rows: number;
  touch: TouchInfo | null;
  drag: DragInfo | null;
}

/* ===================================================================
   CONSTANTS
   =================================================================== */

const TAB_SIZE = 0.1;
const JITTER = 0.04;
const SNAP_FRAC = 0.32; // Generous snap distance
const PAD_FACTOR = 0.42;
const MIN_PIECES = 50;
const MOVE_THRESHOLD = 6;

/* ===================================================================
   GRID CALCULATION
   =================================================================== */

function calculateGrid(
  imgW: number,
  imgH: number,
  minPieces: number = MIN_PIECES
): { cols: number; rows: number } {
  const ratio = imgW / imgH;
  let rows = Math.max(3, Math.round(Math.sqrt(minPieces / ratio)));
  let cols = Math.max(3, Math.round(rows * ratio));
  while (cols * rows < minPieces) {
    if (cols / rows < ratio) cols++;
    else rows++;
  }
  return { cols, rows };
}

/* ===================================================================
   SEEDED RANDOM
   =================================================================== */

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed;
  }
  next() {
    const x = Math.sin(this.s) * 10000;
    this.s++;
    return x - Math.floor(x);
  }
  uni(a: number, b: number) {
    return a + this.next() * (b - a);
  }
  bool() {
    return this.next() > 0.5;
  }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/* ===================================================================
   JIGSAW EDGE GENERATION
   =================================================================== */

function generateEdges(cols: number, rows: number, seed: number) {
  const rng = new Rng(seed);
  const J = JITTER;
  const horizontal: EdgeParams[][] = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontal[r] = [];
    for (let c = 0; c < cols; c++)
      horizontal[r][c] = {
        a: rng.uni(-J, J),
        b: rng.uni(-J, J),
        c: rng.uni(-J, J),
        d: rng.uni(-J, J),
        e: rng.uni(-J, J),
        flip: rng.bool(),
      };
  }
  const vertical: EdgeParams[][] = [];
  for (let r = 0; r < rows; r++) {
    vertical[r] = [];
    for (let c = 0; c < cols - 1; c++)
      vertical[r][c] = {
        a: rng.uni(-J, J),
        b: rng.uni(-J, J),
        c: rng.uni(-J, J),
        d: rng.uni(-J, J),
        e: rng.uni(-J, J),
        flip: rng.bool(),
      };
  }
  return { horizontal, vertical };
}

/* ===================================================================
   EDGE RENDERING
   =================================================================== */

function edgePts(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  e: EdgeParams
) {
  const dx = x1 - x0,
    dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ex = dx / len,
    ey = dy / len;
  const sg = e.flip ? 1 : -1;
  const px = -ey * sg,
    py = ex * sg;
  const t = TAB_SIZE;
  const pt = (l: number, w: number) => ({
    x: x0 + ex * len * l + px * len * w,
    y: y0 + ey * len * l + py * len * w,
  });
  return [
    pt(0, 0),
    pt(0.2, e.a),
    pt(0.5 + e.b + e.d, -t + e.c),
    pt(0.5 - t + e.b, t + e.c),
    pt(0.5 - 2 * t + e.b - e.d, 3 * t + e.c),
    pt(0.5 + 2 * t + e.b - e.d, 3 * t + e.c),
    pt(0.5 + t + e.b, t + e.c),
    pt(0.5 + e.b + e.d, -t + e.c),
    pt(0.8, e.e),
    pt(1, 0),
  ];
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  fx0: number,
  fy0: number,
  fx1: number,
  fy1: number,
  edge: EdgeParams,
  rev: boolean
) {
  const p = edgePts(fx0, fy0, fx1, fy1, edge);
  if (!rev) {
    ctx.bezierCurveTo(p[1].x, p[1].y, p[2].x, p[2].y, p[3].x, p[3].y);
    ctx.bezierCurveTo(p[4].x, p[4].y, p[5].x, p[5].y, p[6].x, p[6].y);
    ctx.bezierCurveTo(p[7].x, p[7].y, p[8].x, p[8].y, p[9].x, p[9].y);
  } else {
    ctx.bezierCurveTo(p[8].x, p[8].y, p[7].x, p[7].y, p[6].x, p[6].y);
    ctx.bezierCurveTo(p[5].x, p[5].y, p[4].x, p[4].y, p[3].x, p[3].y);
    ctx.bezierCurveTo(p[2].x, p[2].y, p[1].x, p[1].y, p[0].x, p[0].y);
  }
}

/* ===================================================================
   PIECE PATH + CREATION
   =================================================================== */

function piecePath(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  pw: number,
  ph: number,
  edges: ReturnType<typeof generateEdges>,
  cols: number,
  rows: number,
  px: number,
  py: number
) {
  const x0 = px, y0 = py, x1 = px + pw, y1 = py + ph;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  if (row > 0) drawEdge(ctx, x0, y0, x1, y0, edges.horizontal[row - 1][col], false);
  else ctx.lineTo(x1, y0);
  if (col < cols - 1) drawEdge(ctx, x1, y0, x1, y1, edges.vertical[row][col], false);
  else ctx.lineTo(x1, y1);
  if (row < rows - 1) drawEdge(ctx, x0, y1, x1, y1, edges.horizontal[row][col], true);
  else ctx.lineTo(x0, y1);
  if (col > 0) drawEdge(ctx, x0, y0, x0, y1, edges.vertical[row][col - 1], true);
  else ctx.lineTo(x0, y0);
  ctx.closePath();
}

function createPiece(
  img: HTMLImageElement,
  col: number,
  row: number,
  cols: number,
  rows: number,
  edges: ReturnType<typeof generateEdges>
): HTMLCanvasElement {
  const pw = img.naturalWidth / cols;
  const ph = img.naturalHeight / rows;
  const pad = Math.ceil(PAD_FACTOR * Math.max(pw, ph));
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(pw + 2 * pad);
  cv.height = Math.ceil(ph + 2 * pad);
  const c = cv.getContext("2d")!;
  piecePath(c, col, row, pw, ph, edges, cols, rows, pad, pad);
  c.save();
  c.clip();
  c.drawImage(img, pad - col * pw, pad - row * ph);
  c.restore();
  piecePath(c, col, row, pw, ph, edges, cols, rows, pad, pad);
  c.strokeStyle = "rgba(134, 47, 231, 0.25)";
  c.lineWidth = 1.2;
  c.stroke();
  return cv;
}

/* ===================================================================
   TRAY LAYOUT COMPUTATION (2-Row Horizontal Scroll Layout)
   =================================================================== */

function computeTray(
  pieces: PieceData[],
  W: number,
  H: number,
  boardBottom: number,
  pieceCanvasW: number,
  pieceCanvasH: number
): TrayInfo {
  const gap = 8;
  const padding = 10;
  const areaTop = H - 160;

  const pieceH = 64;
  const scale = pieceH / pieceCanvasH;
  const pieceW = pieceCanvasW * scale;

  const inTrayCount = pieces.filter((p) => !p.placed && p.inTray).length;
  const cols = Math.ceil(inTrayCount / 2);
  const totalW = cols * (pieceW + gap) - gap;
  const maxScroll = Math.max(0, totalW - W + padding * 2);

  return { areaTop, gap, padding, pieceW, pieceH, scrollX: 0, maxScroll };
}

/* ===================================================================
   FIND PIECE IN TRAY AT SCREEN POSITION
   =================================================================== */

function findTrayPiece(
  x: number,
  y: number,
  pieces: PieceData[],
  tray: TrayInfo
): PieceData | null {
  const inTray = pieces.filter((p) => !p.placed && p.inTray);
  for (let i = 0; i < inTray.length; i++) {
    const col = Math.floor(i / 2);
    const row = i % 2;
    const px = tray.padding + col * (tray.pieceW + tray.gap) - tray.scrollX;
    const py = tray.areaTop + tray.padding + row * (tray.pieceH + tray.gap);
    if (x >= px && x <= px + tray.pieceW && y >= py && y <= py + tray.pieceH) {
      return inTray[i];
    }
  }
  return null;
}

/* ===================================================================
   CANVAS HELPERS
   =================================================================== */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function idFromSrc(src: string): string {
  return src.replace(/^\/puzzles\//, "").replace(/\.[^.]+$/, "");
}

/* ===================================================================
   GALLERY COMPONENT — Supahub light theme style
   =================================================================== */

function Gallery({
  images,
  solved,
  onSelect,
  theme,
  toggleTheme,
}: {
  images: string[];
  solved: Set<string>;
  onSelect: (src: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem 1.5rem",
        fontFamily: "var(--font-inter)",
        position: "relative",
        overflowX: "hidden",
        transition: "background-color 0.25s, color 0.25s",
      }}
    >
      {/* Floating Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-mist bg-card-bg text-lg shadow-sm transition-all hover:scale-110 active:scale-95"
        style={{ pointerEvents: "auto" }}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      {/* Decorative atmospheric gradient orbs */}
      <div className="absolute top-[5%] left-[-15%] -z-10 h-[500px] w-[500px] rounded-full bg-radial from-voltage-violet/15 via-magenta-spark/5 to-transparent opacity-[var(--orb-opacity)] blur-[80px]" />
      <div className="absolute top-[20%] right-[-15%] -z-10 h-[500px] w-[500px] rounded-full bg-radial from-amber-pulse/10 via-hot-pink-ray/5 to-transparent opacity-[var(--orb-opacity)] blur-[80px]" />

      <a
        href="/"
        style={{
          alignSelf: "flex-start",
          color: "var(--color-graphite)",
          textDecoration: "none",
          fontSize: "0.9rem",
          fontWeight: 500,
          marginBottom: "2rem",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        ← Назад
      </a>

      {/* Eyebrow */}
      <span className="inline-block text-xs font-bold tracking-[0.1em] uppercase text-voltage-violet mb-3">
        СЕКРЕТНЫЕ КАРТИНКИ
      </span>

      {/* Heading */}
      <h1
        style={{
          fontFamily: "var(--font-bricolage)",
          fontSize: "clamp(2rem, 6vw, 3rem)",
          fontWeight: 600,
          color: "var(--color-midnight-ink)",
          marginBottom: "0.75rem",
          lineHeight: 1.25,
          letterSpacing: "-0.8px",
          textAlign: "center",
        }}
      >
        Твоя галерея пазлов
      </h1>

      <p
        style={{
          color: "var(--color-slate)",
          fontSize: "0.95rem",
          marginBottom: "3rem",
          textAlign: "center",
          maxWidth: "480px",
          lineHeight: 1.5,
        }}
      >
        Выбери любой знак вопроса. Картинка раскроется только после того, как ты
        полностью соберёшь её!
      </p>

      {images.length === 0 && (
        <div
          style={{
            color: "var(--color-slate)",
            fontSize: "1rem",
            textAlign: "center",
            marginTop: "3rem",
            lineHeight: 1.7,
          }}
        >
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "1rem" }}>📂</span>
          Пока нет картинок.
          <br />
          Закинь фотки в{" "}
          <code style={{ color: "var(--color-voltage-violet)" }}>public/puzzles/</code> и они появятся!
        </div>
      )}

      {/* Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "1.2rem",
          width: "100%",
          maxWidth: "560px",
        }}
      >
        {images.map((src) => {
          const id = idFromSrc(src);
          const done = solved.has(id);
          return (
            <button
              key={id}
              id={`puzzle-card-${id}`}
              onClick={() => onSelect(src)}
              style={{
                position: "relative",
                aspectRatio: "1",
                borderRadius: "var(--radius-cards)",
                border: "1px solid var(--color-mist)",
                background: done ? `url(${src}) center/cover` : "var(--color-fog)",
                cursor: "pointer",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.3s, box-shadow 0.3s, border-color 0.3s, background-color 0.3s",
                boxShadow: "0 4px 18px rgba(134, 47, 231, 0.03)",
                outline: "none",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(134, 47, 231, 0.1)";
                e.currentTarget.style.borderColor = "var(--color-voltage-violet)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "0 4px 18px rgba(134, 47, 231, 0.03)";
                e.currentTarget.style.borderColor = "var(--color-mist)";
              }}
            >
              {!done && (
                <>
                  {/* macOS traffic light dots for styling details */}
                  <div style={{ display: "flex", gap: "3px", position: "absolute", top: "8px", left: "10px" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff5f57" }} />
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#febc20" }} />
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#28c840" }} />
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(105deg, transparent 35%, rgba(134,47,231,0.06) 45%, rgba(255,95,228,0.08) 50%, rgba(134,47,231,0.06) 55%, transparent 65%)",
                      backgroundSize: "300% 100%",
                      animation: "shimmer 3.5s ease-in-out infinite",
                      pointerEvents: "none",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-bricolage)",
                      fontSize: "3rem",
                      fontWeight: 600,
                      background: "linear-gradient(135deg, var(--color-voltage-violet), var(--color-magenta-spark))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      animation: "qPulse 2.5s ease-in-out infinite",
                      lineHeight: 1,
                      userSelect: "none",
                    }}
                  >
                    ?
                  </span>
                </>
              )}
              {done && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(17, 24, 39, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1.4rem",
                      background: "var(--color-voltage-violet)",
                      borderRadius: "50%",
                      width: "40px",
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(134,47,231,0.3)",
                      color: "#fff",
                    }}
                  >
                    ✓
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <style>{`
        @keyframes qPulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.1);opacity:1} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </div>
  );
}

/* ===================================================================
   PUZZLE GAME
   =================================================================== */

function PuzzleGame({
  src,
  onBack,
  onSolved,
  theme,
  toggleTheme,
}: {
  src: string;
  onBack: () => void;
  onSolved: (id: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiState, setUiState] = useState({ placed: 0, total: 0, completed: false });

  /* ---- SETUP ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId = 0;
    let cancelled = false;

    const img = new Image();
    img.src = src;

    img.onload = () => {
      if (cancelled) return;
      const { cols, rows } = calculateGrid(img.naturalWidth, img.naturalHeight, MIN_PIECES);
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.scale(dpr, dpr);

      // Workspace sizing above the 2-row bottom tray
      const topBar = 38;
      const trayH = 160;
      const workspaceH = H - trayH - topBar - 10;

      const imgR = img.naturalWidth / img.naturalHeight;
      const maxBW = W * 0.95;
      const maxBH = workspaceH;
      let bW: number, bH: number;
      if (maxBW / maxBH > imgR) { bH = maxBH; bW = bH * imgR; }
      else { bW = maxBW; bH = bW / imgR; }
      const bX = (W - bW) / 2;
      const bY = topBar + 5 + (workspaceH - bH) / 2; // vertically centered in workspace
      const scale = bW / img.naturalWidth;
      const pieceImgW = img.naturalWidth / cols;
      const pieceImgH = img.naturalHeight / rows;
      const pad = Math.ceil(PAD_FACTOR * Math.max(pieceImgW, pieceImgH));

      const board: BoardInfo = { x: bX, y: bY, w: bW, h: bH, scale, pieceW: pieceImgW, pieceH: pieceImgH, pad };
      const edges = generateEdges(cols, rows, hashStr(src));

      // Create pieces
      const pieces: PieceData[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cv = createPiece(img, c, r, cols, rows, edges);
          pieces.push({
            col: c, row: r, canvas: cv,
            correctX: bX + c * pieceImgW * scale - pad * scale,
            correctY: bY + r * pieceImgH * scale - pad * scale,
            placed: false,
            inTray: true,
            x: 0,
            y: 0,
            width: cv.width, height: cv.height,
          });
        }
      }
      // Shuffle tray order
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }

      // Tray layout
      const tray = computeTray(pieces, W, H, bY + bH, pieces[0].width, pieces[0].height);

      // Light-or-Dark ambient glowing particles
      const colors = ["rgba(134, 47, 231, 0.08)", "rgba(255, 95, 228, 0.08)", "rgba(220, 95, 5, 0.06)"];
      const particles: AmbientParticle[] = Array.from({ length: 30 }, () => ({
        x: Math.random(), y: Math.random(),
        r: 2 + Math.random() * 4,
        p: Math.random() * Math.PI * 2,
        s: 0.001 + Math.random() * 0.003,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));

      const g: GameState = {
        img,
        pieces, board, tray, particles,
        confetti: [], completed: false,
        placedCount: 0, totalPieces: cols * rows,
        W, H, cols, rows,
        touch: null, drag: null,
      };
      gRef.current = g;

      setUiState({ placed: 0, total: cols * rows, completed: false });
      setLoading(false);

      /* ---- RENDER LOOP ---- */
      function render(time: number) {
        if (cancelled) return;
        animId = requestAnimationFrame(render);
        const g = gRef.current!;
        const { board: bd, tray: tr, pieces: pcs } = g;

        // -- Read styles dynamically from document body (enables fast live theme toggle) --
        const cStyle = getComputedStyle(document.documentElement);
        const bgPrimary = cStyle.getPropertyValue("--bg-primary").trim() || "#ffffff";
        const fogColor = cStyle.getPropertyValue("--color-fog").trim() || "#f1f5f9";
        const borderPrimary = cStyle.getPropertyValue("--border-primary").trim() || "#d8e0ea";

        // -- Background --
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, bgPrimary);
        grad.addColorStop(0.5, fogColor);
        grad.addColorStop(1, bgPrimary);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Render ambient glowing particles
        for (const pt of g.particles) {
          const a = 0.3 + 0.5 * Math.sin(pt.p + time * pt.s);
          ctx.beginPath();
          ctx.arc(pt.x * W, pt.y * H, pt.r, 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fill();
          ctx.restore();
        }

        // -- Mystery Board Target Area (Secret) --
        ctx.fillStyle = "rgba(134, 47, 231, 0.015)";
        roundRect(ctx, bd.x, bd.y, bd.w, bd.h, 5);
        ctx.fill();

        // Subtle target board outline
        ctx.save();
        ctx.shadowColor = "rgba(134, 47, 231, 0.12)";
        ctx.shadowBlur = 16;
        ctx.strokeStyle = borderPrimary;
        ctx.lineWidth = 1.2;
        roundRect(ctx, bd.x, bd.y, bd.w, bd.h, 5);
        ctx.stroke();
        ctx.restore();

        // -- Snap highlight --
        if (g.drag) {
          const dp = g.drag.piece;
          const targetX = bd.x + dp.col * bd.pieceW * bd.scale - bd.pad * bd.scale;
          const targetY = bd.y + dp.row * bd.pieceH * bd.scale - bd.pad * bd.scale;
          const sd = SNAP_FRAC * Math.min(bd.pieceW, bd.pieceH) * bd.scale;
          
          const curX = g.drag.x - g.drag.offsetX;
          const curY = g.drag.y - g.drag.offsetY;

          if (Math.abs(curX - targetX) < sd && Math.abs(curY - targetY) < sd) {
            ctx.fillStyle = "rgba(134, 47, 231, 0.15)";
            ctx.fillRect(
              bd.x + dp.col * bd.pieceW * bd.scale,
              bd.y + dp.row * bd.pieceH * bd.scale,
              bd.pieceW * bd.scale,
              bd.pieceH * bd.scale
            );
          }
        }

        // -- Placed pieces --
        for (const p of pcs) {
          if (!p.placed) continue;
          ctx.drawImage(p.canvas, p.correctX, p.correctY, p.width * bd.scale, p.height * bd.scale);
        }

        // -- Free-floating pieces (on board) --
        const dragPiece = g.drag?.piece;
        for (const p of pcs) {
          if (p.placed || p.inTray || p === dragPiece) continue;
          ctx.save();
          ctx.shadowColor = "rgba(11, 61, 121, 0.15)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 2;
          ctx.drawImage(p.canvas, p.x, p.y, p.width * bd.scale, p.height * bd.scale);
          ctx.restore();
        }

        // -- Tray Area Separator / Background --
        ctx.fillStyle = fogColor;
        ctx.fillRect(0, tr.areaTop - 6, W, H - tr.areaTop + 6);
        ctx.strokeStyle = borderPrimary;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, tr.areaTop - 6);
        ctx.lineTo(W, tr.areaTop - 6);
        ctx.stroke();

        // -- Tray pieces (2 rows) --
        const inTray = pcs.filter((p) => !p.placed && p.inTray);
        const trayCols = Math.ceil(inTray.length / 2);
        const totalTW = trayCols * (tr.pieceW + tr.gap) - tr.gap;
        tr.maxScroll = Math.max(0, totalTW - W + tr.padding * 2);
        tr.scrollX = clamp(tr.scrollX, 0, tr.maxScroll);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, tr.areaTop - 4, W, H - tr.areaTop + 4);
        ctx.clip();

        for (let i = 0; i < inTray.length; i++) {
          const p = inTray[i];
          if (p === dragPiece) continue;
          const col = Math.floor(i / 2);
          const row = i % 2;
          const px = tr.padding + col * (tr.pieceW + tr.gap) - tr.scrollX;
          const py = tr.areaTop + tr.padding + row * (tr.pieceH + tr.gap);
          if (px + tr.pieceW < 0 || px > W) continue;

          ctx.save();
          ctx.shadowColor = "rgba(11, 61, 121, 0.12)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 1;
          ctx.drawImage(p.canvas, px, py, tr.pieceW, tr.pieceH);
          ctx.restore();
        }
        ctx.restore();

        // -- Floating dragged piece --
        if (g.drag) {
          const dp = g.drag.piece;
          const dw = dp.width * bd.scale;
          const dh = dp.height * bd.scale;
          ctx.save();
          ctx.shadowColor = "rgba(134, 47, 231, 0.4)";
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 5;
          ctx.globalAlpha = 0.9;
          ctx.drawImage(dp.canvas, g.drag.x - g.drag.offsetX, g.drag.y - g.drag.offsetY, dw, dh);
          ctx.restore();
        }

        // -- Confetti --
        for (let i = g.confetti.length - 1; i >= 0; i--) {
          const c = g.confetti[i];
          c.x += c.vx;
          c.y += c.vy;
          c.vy += 0.14;
          c.vx *= 0.99;
          c.rot += c.rs;
          c.life--;
          if (c.life <= 0) { g.confetti.splice(i, 1); continue; }
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rot);
          ctx.globalAlpha = Math.min(1, c.life / 35);
          ctx.fillStyle = c.color;
          ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
          ctx.restore();
        }

        // -- Horizontal Scroll indicator --
        if (tr.maxScroll > 0 && !g.completed && inTray.length > 0) {
          const barW = Math.max(20, W * (W / (totalTW + tr.padding * 2)));
          const barX = (tr.scrollX / tr.maxScroll) * (W - barW);
          ctx.fillStyle = "rgba(134, 47, 231, 0.22)";
          roundRect(ctx, barX, H - 4, barW, 2, 1);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    return () => { cancelled = true; cancelAnimationFrame(animId); };
  }, [src]);

  /* ---- PREVENT NATIVE TOUCH ---- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const p = (e: Event) => e.preventDefault();
    cv.addEventListener("touchstart", p, { passive: false });
    cv.addEventListener("touchmove", p, { passive: false });
    return () => { cv.removeEventListener("touchstart", p); cv.removeEventListener("touchmove", p); };
  }, []);

  /* ---- WHEEL SCROLL (Horizontal) ---- */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const handler = (e: WheelEvent) => {
      const g = gRef.current;
      if (!g) return;
      const rect = cv.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y > g.tray.areaTop) {
        g.tray.scrollX = clamp(g.tray.scrollX + e.deltaY * 0.4, 0, g.tray.maxScroll);
        e.preventDefault();
      }
    };
    cv.addEventListener("wheel", handler, { passive: false });
    return () => cv.removeEventListener("wheel", handler);
  }, []);

  /* ---- HELPERS ---- */
  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const cv = canvasRef.current!;
    const rect = cv.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e) {
      const t = (e as React.TouchEvent).touches[0] || (e as React.TouchEvent).changedTouches[0];
      cx = t.clientX; cy = t.clientY;
    } else {
      cx = (e as React.MouseEvent).clientX; cy = (e as React.MouseEvent).clientY;
    }
    return { x: cx - rect.left, y: cy - rect.top };
  }, []);

  /* ---- SNAP / RELEASE CHECK ---- */
  const trySnap = useCallback(() => {
    const g = gRef.current;
    if (!g?.drag) return;
    const { piece, x, y, offsetX, offsetY } = g.drag;
    const bd = g.board;

    const curX = x - offsetX;
    const curY = y - offsetY;

    const targetX = bd.x + piece.col * bd.pieceW * bd.scale - bd.pad * bd.scale;
    const targetY = bd.y + piece.row * bd.pieceH * bd.scale - bd.pad * bd.scale;
    const sd = SNAP_FRAC * Math.min(bd.pieceW, bd.pieceH) * bd.scale;

    if (Math.abs(curX - targetX) < sd && Math.abs(curY - targetY) < sd) {
      piece.placed = true;
      piece.inTray = false;
      piece.x = piece.correctX;
      piece.y = piece.correctY;
      g.placedCount++;
      setUiState((prev) => ({ ...prev, placed: g.placedCount }));

      if (g.placedCount === g.totalPieces && !g.completed) {
        g.completed = true;
        setUiState((prev) => ({ ...prev, completed: true }));
        onSolved(idFromSrc(src));
        // Confetti
        const colors = ["#862fe7", "#ff5fe4", "#dc5f05", "#d6fcf4", "#ebdafd", "#fff"];
        const cx = bd.x + bd.w / 2, cy = bd.y + bd.h / 2;
        for (let i = 0; i < 180; i++) {
          g.confetti.push({
            x: cx + (Math.random() - 0.5) * 140, y: cy,
            vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 17 - 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 4 + Math.random() * 8, life: 85 + Math.random() * 70,
            rot: Math.random() * Math.PI * 2, rs: (Math.random() - 0.5) * 0.3,
          });
        }
        if (navigator.vibrate) navigator.vibrate(200);
      } else {
        if (navigator.vibrate) navigator.vibrate(15);
      }
    } else {
      // Free movement drop!
      if (y > g.tray.areaTop) {
        piece.inTray = true;
        piece.placed = false;
      } else {
        piece.inTray = false;
        piece.placed = false;
        piece.x = curX;
        piece.y = curY;
      }
    }
    g.drag = null;
  }, [src, onSolved]);

  /* ---- MOUSE HANDLERS (desktop) ---- */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const g = gRef.current;
    if (!g || g.completed) return;
    const pos = getPos(e);

    // 1. Tapped in tray
    if (pos.y > g.tray.areaTop) {
      const piece = findTrayPiece(pos.x, pos.y, g.pieces, g.tray);
      if (piece) {
        g.drag = {
          piece,
          x: pos.x,
          y: pos.y,
          offsetX: (piece.width * g.board.scale) / 2,
          offsetY: (piece.height * g.board.scale) / 2,
        };
      }
    } else {
      // 2. Tapped on floating pieces on board
      const floating = g.pieces.filter((p) => !p.placed && !p.inTray);
      for (let i = floating.length - 1; i >= 0; i--) {
        const p = floating[i];
        const pw = p.width * g.board.scale;
        const ph = p.height * g.board.scale;
        if (pos.x >= p.x && pos.x <= p.x + pw && pos.y >= p.y && pos.y <= p.y + ph) {
          g.pieces.splice(g.pieces.indexOf(p), 1);
          g.pieces.push(p);

          g.drag = {
            piece: p,
            x: pos.x,
            y: pos.y,
            offsetX: pos.x - p.x,
            offsetY: pos.y - p.y,
          };
          break;
        }
      }
    }
  }, [getPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const g = gRef.current;
    if (!g?.drag) return;
    const pos = getPos(e);
    g.drag.x = pos.x;
    g.drag.y = pos.y;
  }, [getPos]);

  const handleMouseUp = useCallback(() => trySnap(), [trySnap]);

  /* ---- TOUCH HANDLERS (mobile) ---- */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const g = gRef.current;
    if (!g || g.completed) return;
    const pos = getPos(e);

    // 1. Tapped in tray
    if (pos.y > g.tray.areaTop) {
      const piece = findTrayPiece(pos.x, pos.y, g.pieces, g.tray);

      g.touch = {
        startX: pos.x,
        startY: pos.y,
        phase: "waiting",
        piece,
        scrollStartX: g.tray.scrollX,
        offsetX: piece ? (piece.width * g.board.scale) / 2 : 0,
        offsetY: piece ? (piece.height * g.board.scale) / 2 : 0,
      };
    } else {
      // 2. Tapped on floating pieces
      const floating = g.pieces.filter((p) => !p.placed && !p.inTray);
      let hitPiece: PieceData | null = null;
      for (let i = floating.length - 1; i >= 0; i--) {
        const p = floating[i];
        const pw = p.width * g.board.scale;
        const ph = p.height * g.board.scale;
        if (pos.x >= p.x && pos.x <= p.x + pw && pos.y >= p.y && pos.y <= p.y + ph) {
          hitPiece = p;
          break;
        }
      }

      if (hitPiece) {
        g.pieces.splice(g.pieces.indexOf(hitPiece), 1);
        g.pieces.push(hitPiece);

        g.drag = {
          piece: hitPiece,
          x: pos.x,
          y: pos.y,
          offsetX: pos.x - hitPiece.x,
          offsetY: pos.y - hitPiece.y,
        };
        g.touch = {
          startX: pos.x,
          startY: pos.y,
          phase: "dragging",
          piece: hitPiece,
          scrollStartX: g.tray.scrollX,
          offsetX: pos.x - hitPiece.x,
          offsetY: pos.y - hitPiece.y,
        };
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }
  }, [getPos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const g = gRef.current;
    if (!g?.touch) return;
    const pos = getPos(e);

    const dx = pos.x - g.touch.startX;
    const dy = pos.y - g.touch.startY;

    if (g.touch.phase === "waiting") {
      if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
        if (Math.abs(dx) > Math.abs(dy)) {
          g.touch.phase = "scrolling";
        } else if (dy < -MOVE_THRESHOLD) {
          if (g.touch.piece) {
            g.touch.phase = "dragging";
            g.drag = {
              piece: g.touch.piece,
              x: pos.x,
              y: pos.y,
              offsetX: g.touch.offsetX,
              offsetY: g.touch.offsetY,
            };
            if (navigator.vibrate) navigator.vibrate(20);
          } else {
            g.touch.phase = "scrolling";
          }
        } else {
          g.touch.phase = "scrolling";
        }
      }
    }

    if (g.touch.phase === "scrolling") {
      g.tray.scrollX = clamp(g.touch.scrollStartX - dx, 0, g.tray.maxScroll);
    }

    if (g.touch.phase === "dragging" && g.drag) {
      g.drag.x = pos.x;
      g.drag.y = pos.y;
    }
  }, [getPos]);

  const handleTouchEnd = useCallback(() => {
    const g = gRef.current;
    if (!g?.touch) return;
    if (g.touch.phase === "dragging") trySnap();
    g.touch = null;
    g.drag = null;
  }, [trySnap]);

  /* ---- RENDER ---- */
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-primary)", touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", touchAction: "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Top bar — Light/Dark Theme adaptive */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 10px",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <button
          id="puzzle-back-btn"
          onClick={onBack}
          style={{
            pointerEvents: "auto",
            background: "var(--color-pure-white)",
            border: "1px solid var(--color-mist)",
            borderRadius: "var(--radius-buttons)",
            color: "var(--color-midnight-ink)",
            padding: "6px 14px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            fontFamily: "var(--font-inter)",
            boxShadow: "0 2px 8px rgba(134, 47, 231, 0.04)",
          }}
        >
          ← Назад
        </button>

        {/* Floating Theme Toggle (Inside game overlay) */}
        <button
          onClick={toggleTheme}
          style={{
            pointerEvents: "auto",
            background: "var(--color-pure-white)",
            border: "1px solid var(--color-mist)",
            borderRadius: "50%",
            color: "var(--color-midnight-ink)",
            width: "36px",
            height: "36px",
            fontSize: "1rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(134, 47, 231, 0.04)",
          }}
          title="Переключить тему"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {!loading && (
          <div
            id="puzzle-progress"
            style={{
              pointerEvents: "none",
              background: "var(--color-pure-white)",
              border: "1px solid var(--color-mist)",
              borderRadius: "var(--radius-buttons)",
              color: "var(--color-midnight-ink)",
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: 600,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              fontFamily: "var(--font-inter)",
              boxShadow: "0 2px 8px rgba(134, 47, 231, 0.04)",
            }}
          >
            🧩 {uiState.placed}/{uiState.total}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
            color: "var(--color-midnight-ink)",
            fontSize: "1.1rem",
            fontFamily: "var(--font-inter)",
          }}
        >
          <span style={{ animation: "ldPulse 1.5s ease-in-out infinite" }}>Загрузка пазла...</span>
        </div>
      )}

      {/* Completed Modal Overlay */}
      {uiState.completed && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
            pointerEvents: "none",
            background: "rgba(17, 24, 39, 0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              position: "relative",
              background: "var(--color-pure-white)",
              borderRadius: "var(--radius-cards)",
              border: "1px solid var(--color-mist)",
              padding: "2.5rem 2rem",
              textAlign: "center",
              animation: "doneBounce 0.6s cubic-bezier(0.34,1.56,0.64,1)",
              pointerEvents: "auto",
              maxWidth: "88vw",
              width: 360,
              fontFamily: "var(--font-inter)",
              boxShadow: "0 20px 40px rgba(134, 47, 231, 0.15)",
            }}
          >
            {/* macOS traffic lights */}
            <div style={{ display: "flex", gap: "5px", position: "absolute", top: "16px", left: "18px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ff5f57" }} />
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#febc20" }} />
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#28c840" }} />
            </div>

            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem", marginTop: "0.5rem" }}>🎉</div>
            <h2
              style={{
                fontFamily: "var(--font-bricolage)",
                fontSize: "1.7rem",
                fontWeight: 600,
                color: "var(--color-midnight-ink)",
                margin: "0 0 0.4rem",
                letterSpacing: "-0.6px",
              }}
            >
              Собрано!
            </h2>
            <p style={{ color: "var(--color-slate)", fontSize: "0.95rem", margin: "0 0 1.5rem" }}>
              Ты великолепно справилась с этим секретным пазлом! 💜
            </p>
            <button
              id="puzzle-complete-back"
              onClick={onBack}
              style={{
                background: "var(--color-voltage-violet)",
                border: "none",
                borderRadius: "var(--radius-buttons)",
                color: "#fff",
                padding: "0.75rem 2rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "rgba(11, 61, 121, 0.16) 0px 0px 0px 1px inset",
                transition: "transform 0.2s, background 0.2s",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.backgroundColor = "var(--color-ultra-violet)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.backgroundColor = "var(--color-voltage-violet)";
              }}
            >
              К галерее
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes ldPulse { 0%,100%{transform:scale(1);opacity:.7} 50%{transform:scale(1.04);opacity:1} }
        @keyframes doneBounce { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  );
}

/* ===================================================================
   MAIN CLIENT COMPONENT
   =================================================================== */

export default function PuzzleClient({ images }: { images: string[] }) {
  const [view, setView] = useState<"gallery" | "game">("gallery");
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (next === "light") {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        localStorage.setItem("theme", "light");
      } else {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem("murzik-puzzles-solved");
      if (s) setSolved(new Set(JSON.parse(s)));
    } catch { /* noop */ }
  }, []);

  const handleSelect = useCallback((src: string) => { setActiveSrc(src); setView("game"); }, []);

  const handleSolved = useCallback((id: string) => {
    setSolved((prev) => {
      const n = new Set(prev);
      n.add(id);
      try { localStorage.setItem("murzik-puzzles-solved", JSON.stringify([...n])); } catch { /* noop */ }
      return n;
    });
  }, []);

  const handleBack = useCallback(() => { setView("gallery"); setActiveSrc(null); }, []);

  if (view === "game" && activeSrc)
    return (
      <PuzzleGame
        src={activeSrc}
        onBack={handleBack}
        onSolved={handleSolved}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );

  return (
    <Gallery
      images={images}
      solved={solved}
      onSelect={handleSelect}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
}
