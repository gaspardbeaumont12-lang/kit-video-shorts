import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import tl from "./timeline.json";
import emojis from "./emoji.json";

// ------------------------------------------------------------------ charte « cahier d'étudiant »
export const C = {
  ink: "#15172F",
  paper: "#F6F1E7",
  grid: "#E6DCC7",
  yellow: "#FFE45E",
  pink: "#FF7EB6",
  blue: "#4F8BFF",
  green: "#16A34A",
  red: "#E63946",
  orange: "#FF8A3D",
  navy: "#1B1F4B",
};
export const CARD_COLORS = ["#FFE45E", "#FFB3D1", "#A8C8FF", "#B9F3C9", "#FFC58A", "#D9C2FF"];
export const FONT = "Montserrat, sans-serif";
export const MARKER = "'Permanent Marker', cursive";
export const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type Scene = {
  id: string; type: string; from: number; durationInFrames: number; enter: string; voFrom: number;
  params: any; cues: Record<string, number>; ticks: number[];
  words: { text: string; say: string; from: number; to: number }[];
};
export const TL = tl as any;

// pseudo-aléatoire déterministe (jamais Math.random)
export const rnd = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

type SpringCfg = { damping?: number; stiffness?: number; mass?: number; overshootClamping?: boolean };
export const sp = (frame: number, at: number, fps: number, cfg: SpringCfg = {}) =>
  spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 220, mass: 0.6, ...cfg } });
export const usePop = (at: number, cfg: SpringCfg = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return sp(f, at, fps, cfg);
};
// « coup de tampon » : ressort sans rebond (ne rétrécit jamais sous 1×)
export const SLAM: SpringCfg = { damping: 18, stiffness: 400, mass: 0.6, overshootClamping: true };

// repère d'une scène : renvoie la valeur du repère, sinon la valeur par défaut
export const cue = (scene: Scene, name: string, fallback: number) =>
  scene.cues && typeof scene.cues[name] === "number" ? scene.cues[name] : fallback;

// taille de police qui tient dans une largeur donnée (Montserrat 900 ≈ 0,72 em par caractère en majuscules)
export const fitFont = (text: string, maxWidth: number, maxSize: number, minSize = 40, charW = 0.72) => {
  const len = Math.max(1, text.length);
  return Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / (charW * len))));
};
// coupe un texte en 1 ou 2 lignes équilibrées
export const splitLines = (text: string, maxChars = 12): string[] => {
  if (text.length <= maxChars) return [text];
  const words = text.split(" ");
  if (words.length < 2) return [text];
  let best = [text], bestScore = 1e9;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const score = Math.max(a.length, b.length);
    if (score < bestScore) { bestScore = score; best = [a, b]; }
  }
  return best;
};

// ------------------------------------------------------------------ emoji (Noto, Apache-2.0)
export const Emoji: React.FC<{ name?: string | null; size: number; style?: React.CSSProperties }> = ({ name, size, style }) => {
  const e = name ? (emojis as Record<string, { body: string; w: number; h: number }>)[name] : undefined;
  if (!e) return null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${e.w} ${e.h}`} style={{ display: "inline-block", flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: e.body }} />
  );
};

// ------------------------------------------------------------------ fond cahier (quadrillage fixe, gribouillis qui flottent)
const Doodle: React.FC<{ d: string; x: number; y: number; s: number; i: number }> = ({ d, x, y, s, i }) => {
  const f = useCurrentFrame();
  return (
    <svg width={140 * s} height={140 * s} viewBox="0 0 100 100"
      style={{ position: "absolute", left: x, top: y + Math.sin((f + i * 20) / 22) * 8,
        transform: `rotate(${(f * 0.3 + i * 40) % 360}deg)`, opacity: 0.16 }}>
      <path d={d} fill="none" stroke={C.ink} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
const STAR = "M50 8 L60 38 L92 40 L66 59 L76 90 L50 71 L24 90 L34 59 L8 40 L40 38 Z";
const SQUIG = "M6 60 C 20 20, 34 20, 44 50 S 70 80, 80 45 S 92 20, 96 30";
const SPIRAL = "M50 50 m-6 0 a6 6 0 1 1 12 0 a12 12 0 1 1 -24 0 a18 18 0 1 1 36 0 a24 24 0 1 1 -48 0";
const ARROW = "M10 80 L80 15 M50 12 L80 15 L76 45";

export const Paper: React.FC = () => (
  <div style={{ position: "absolute", left: -200, top: -200, right: -200, bottom: -200, backgroundColor: C.paper,
    backgroundImage: `linear-gradient(${C.grid} 2px, transparent 2px), linear-gradient(90deg, ${C.grid} 2px, transparent 2px)`,
    backgroundSize: "64px 64px" }}>
    <div style={{ position: "absolute", left: 200 + 64, top: 0, bottom: 0, width: 5, background: "#F2A7A7", opacity: 0.8 }} />
    <Doodle d={STAR} x={200 + 880} y={200 + 1500} s={0.9} i={1} />
    <Doodle d={SQUIG} x={200 + 40} y={200 + 1560} s={1.1} i={2} />
    <Doodle d={SPIRAL} x={200 + 900} y={200 + 230} s={0.8} i={3} />
    <Doodle d={ARROW} x={200 + 70} y={200 + 260} s={0.7} i={4} />
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(60,40,10,0.18) 100%)" }} />
  </div>
);

// ------------------------------------------------------------------ caméra : poussée lente, coups de zoom, secousses
export const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  let scale = 1, dx = 0, dy = 0, rot = 0;
  const sc = TL.scenes.find((s: Scene) => f >= s.from && f < s.from + s.durationInFrames);
  if (sc) scale *= 1 + 0.03 * ((f - sc.from) / sc.durationInFrames);
  for (const p of TL.punches) {
    if (f < p.frame) continue;
    const s = spring({ frame: f - p.frame, fps, config: { damping: 13, stiffness: 240, mass: 0.5 } });
    const rel = interpolate(f - p.frame, [0, 16, 28], [1, 1, 0], clampOpt);
    scale *= 1 + p.amount * s * rel;
  }
  for (const im of TL.impacts) {
    const t = f - im.frame;
    if (t < 0 || t > 16) continue;
    const a = im.amount * Math.exp(-t / 4);
    dx += a * Math.sin(t * 2.3 + im.frame);
    dy += a * Math.cos(t * 2.9 + im.frame * 0.7);
    rot += a * 0.05 * Math.sin(t * 1.9 + im.frame);
  }
  return (
    <AbsoluteFill style={{ transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${rot}deg)`, transformOrigin: "50% 42%" }}>
      {children}
    </AbsoluteFill>
  );
};

export const Flash: React.FC = () => {
  const f = useCurrentFrame();
  let o = 0;
  for (const fl of TL.flashes) {
    const t = f - fl.frame;
    if (t >= 0 && t < 6) o = Math.max(o, fl.amount * (1 - t / 6));
  }
  return o > 0 ? <AbsoluteFill style={{ background: "white", opacity: o }} /> : null;
};

export const ProgressBar: React.FC = () => {
  const f = useCurrentFrame();
  const p = f / (TL.durationInFrames - 1);
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: 190, height: 16, borderRadius: 10, border: `3px solid ${C.ink}`, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}>
      <div style={{ width: `${p * 100}%`, height: "100%", background: `repeating-linear-gradient(45deg, ${C.yellow} 0 14px, #FFD21F 14px 28px)` }} />
    </div>
  );
};

// ------------------------------------------------------------------ texte à contour (lisible sur tout fond)
export const Stroked: React.FC<{ children: React.ReactNode; stroke?: number; strokeColor?: string; color?: string; style?: React.CSSProperties }> = ({ children, stroke = 16, strokeColor = "white", color = C.ink, style }) => (
  <span style={{ position: "relative", display: "inline-block", ...style }}>
    <span aria-hidden style={{ position: "absolute", left: 0, top: 0, WebkitTextStroke: `${stroke}px ${strokeColor}`, color: strokeColor }}>{children}</span>
    <span style={{ position: "relative", color }}>{children}</span>
  </span>
);

// ------------------------------------------------------------------ sous-titres mot à mot (effet surligneur)
const CapWord: React.FC<{ w: any }> = ({ w }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = f >= w.from - 1;
  const p = spring({ frame: f - (w.from - 1), fps, config: { damping: 12, stiffness: 300, mass: 0.5 } });
  const active = f >= w.from && f < Math.max(w.to, w.from + 8);
  const hl = spring({ frame: f - w.from, fps, config: { damping: 22, stiffness: 380 } });
  return (
    <span style={{ position: "relative", display: "inline-block", margin: "0 12px", opacity: shown ? Math.min(1, p * 2.2) : 0,
      transform: `translateY(${(1 - p) * 26}px) scale(${0.55 + 0.45 * p})` }}>
      {active && (
        <span style={{ position: "absolute", left: -16, right: -16, top: 10, bottom: 0, background: C.yellow, borderRadius: 16,
          transform: `skewX(-8deg) scaleX(${hl})`, transformOrigin: "left center" }} />
      )}
      <Stroked stroke={18} color={w.color ?? C.ink}>{w.text}</Stroked>
    </span>
  );
};

export const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const page = TL.pages.find((p: any) => f >= p.from && f < p.to);
  if (!page) return null;
  const pin = spring({ frame: f - page.from, fps, config: { damping: 14, stiffness: 300, mass: 0.5 } });
  const ew = page.words.find((w: any) => w.emoji);
  const ep = ew ? spring({ frame: f - ew.from, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } }) : 0;
  const longest = Math.max(...page.words.map((w: any) => w.text.length));
  const size = Math.min(94, Math.floor(880 / (0.74 * Math.max(8, longest))));
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 1225, height: 250, display: "flex", alignItems: "center",
      justifyContent: "center", flexWrap: "wrap", fontFamily: FONT, fontWeight: 900, fontSize: size, lineHeight: 1.12,
      textTransform: "uppercase", textAlign: "center", transform: `scale(${0.88 + 0.12 * pin})` }}>
      {page.words.map((w: any, i: number) => <CapWord key={i} w={w} />)}
      {ew && f >= ew.from && (
        <span style={{ display: "inline-block", marginLeft: 10, transform: `scale(${ep}) rotate(${(1 - ep) * -40 + Math.sin(f / 4) * 6}deg)` }}>
          <Emoji name={ew.emoji} size={104} style={{ filter: "drop-shadow(0 6px 0 rgba(21,23,47,0.25))" }} />
        </span>
      )}
    </div>
  );
};

// ------------------------------------------------------------------ transitions d'entrée / sortie
export const SceneShell: React.FC<{ scene: Scene; exit: string; children: React.ReactNode }> = ({ scene, exit, children }) => {
  const f = useCurrentFrame();
  const dur = scene.durationInFrames;
  let tx = 0, s = 1, blur = 0, op = 1;
  const E = 8;
  if (f < E && scene.enter !== "none" && scene.enter !== "cut") {
    const p = Easing.out(Easing.cubic)(f / E);
    if (scene.enter === "whip_left") { tx = (1 - p) * 1150; blur = (1 - p) * 30; }
    if (scene.enter === "whip_right") { tx = -(1 - p) * 1150; blur = (1 - p) * 30; }
    if (scene.enter === "zoom") { s = 1.9 - 0.9 * p; blur = (1 - p) * 22; op = Math.min(1, 0.35 + f / 4); }
  }
  const X = 5;
  if (f >= dur - X) {
    const q = Easing.in(Easing.cubic)((f - (dur - X) + 1) / X);
    if (exit === "whip_left") { tx = -q * 1150; blur = q * 30; }
    if (exit === "whip_right") { tx = q * 1150; blur = q * 30; }
    if (exit === "zoom") { s = 1 + q * 0.6; blur = q * 16; op = 1 - q * 0.8; }
  }
  return (
    <AbsoluteFill style={{ transform: `translateX(${tx}px) scale(${s})`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined, opacity: op }}>
      {children}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ briques visuelles
export const Card: React.FC<{ label: string; color: string; w?: number; h?: number; font?: number; style?: React.CSSProperties }> = ({ label, color, w = 300, h = 124, font, style }) => {
  const fs = font ?? Math.max(26, Math.min(46, Math.floor((w - 36) / (0.6 * Math.max(1, label.length)))));
  return (
    <div style={{ position: "absolute", width: w, height: h, borderRadius: 18, background: color, border: `4px solid ${C.ink}`,
      boxShadow: `0 10px 0 ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      fontFamily: MARKER, fontSize: fs, lineHeight: 1.05, color: C.ink, padding: "0 12px", ...style }}>
      {label}
    </div>
  );
};

// en-tête d'étape : pastille numérotée (facultative) + mot surligné
export const StepHeader: React.FC<{ n?: string | number | null; text: string; at: number; emoji?: string }> = ({ n, text, at, emoji }) => {
  const f = useCurrentFrame();
  const p = usePop(at, { damping: 10, stiffness: 240 });
  const u = interpolate(f, [at + 2, at + 9], [0, 1], clampOpt);
  const b = usePop(0, { damping: 12 });
  const hasN = n !== undefined && n !== null && `${n}` !== "";
  const lines = splitLines(text.toUpperCase(), 11);
  const longest = Math.max(...lines.map((l) => l.length));
  const fs = Math.min(lines.length > 1 ? 80 : 128, fitFont("x".repeat(longest), (hasN ? 720 : 900) - (emoji ? 110 : 0), 128, 56));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 240, height: 185, display: "flex", alignItems: "center", justifyContent: "center", gap: 30 }}>
      {hasN && (
        <div style={{ width: 150, height: 150, borderRadius: 75, background: C.ink, color: C.yellow, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: FONT, fontWeight: 900, fontSize: 100, transform: `scale(${b}) rotate(${(1 - b) * -90}deg)`, boxShadow: `0 8px 0 ${C.yellow}`, flexShrink: 0 }}>{n}</div>
      )}
      <div style={{ position: "relative", transform: `scale(${0.4 + 0.6 * p})`, opacity: Math.min(1, p * 3), display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: -12, right: -12, bottom: fs * 0.08, height: fs * 0.48, background: C.yellow, borderRadius: 10,
              transform: `scaleX(${u}) skewX(-10deg)`, transformOrigin: "left" }} />
            <div style={{ position: "relative", fontFamily: FONT, fontWeight: 900, fontSize: fs, lineHeight: 1.02, color: C.ink, letterSpacing: -2 }}>{l}</div>
          </div>
        ))}
      </div>
      {emoji && <span style={{ transform: `scale(${p})`, display: "inline-block" }}><Emoji name={emoji} size={110} /></span>}
    </div>
  );
};

// trait de feutre qui se dessine (croix, coche, rature)
export const Stroke: React.FC<{ d: string; at: number; dur?: number; color?: string; width?: number; box: [number, number, number, number]; vb?: string }> = ({ d, at, dur = 5, color = C.red, width = 30, box, vb = "0 0 100 100" }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], { ...clampOpt, easing: Easing.out(Easing.quad) });
  if (f < at) return null;
  return (
    <svg viewBox={vb} preserveAspectRatio="none" style={{ position: "absolute", left: box[0], top: box[1], width: box[2], height: box[3], overflow: "visible" }}>
      <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" strokeDasharray="1" strokeDashoffset={1 - p} />
    </svg>
  );
};
export const CHECK_D = "M8 55 L38 85 L94 12";
export const CROSS_A = "M10 10 L90 90";
export const CROSS_B = "M90 10 L10 90";

export const Chip: React.FC<{ text: string; emoji?: string; at: number; x: number; y: number; rot?: number; bg?: string; fg?: string; size?: number; bounce?: boolean }> = ({ text, emoji, at, x, y, rot = 0, bg = C.ink, fg = "white", size = 54, bounce }) => {
  const f = useCurrentFrame();
  const p = usePop(at, { damping: 9, stiffness: 260 });
  if (f < at) return null;
  const by = bounce ? Math.abs(Math.sin((f - at) / 6)) * -18 : 0;
  const fs = Math.min(size, Math.floor(820 / (0.72 * Math.max(1, text.length + (emoji ? 2 : 0)))));
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, ${by}px) scale(${p}) rotate(${rot}deg)`, background: bg, color: fg,
      borderRadius: 999, padding: "16px 34px", display: "flex", alignItems: "center", gap: 14, fontFamily: FONT, fontWeight: 900, fontSize: fs,
      border: `4px solid ${C.ink}`, boxShadow: `0 8px 0 ${C.ink}`, whiteSpace: "nowrap" }}>
      {text}{emoji && <Emoji name={emoji} size={fs * 1.15} />}
    </div>
  );
};

// anneau de progression (minuteur, jauge ronde)
export const Ring: React.FC<{ progress: number; size: number; color: string; track?: string; width?: number }> = ({ progress, size, color, track = "#EDE5D3", width = 38 }) => {
  const r = (size - width) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ position: "absolute", left: 0, top: 0, transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={width} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))} />
    </svg>
  );
};

// rayons qui tournent derrière un élément
export const Burst: React.FC<{ cx: number; cy: number; opacity: number; color?: string }> = ({ cx, cy, opacity, color = C.yellow }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: cx - 1000, top: cy - 1000, width: 2000, height: 2000, borderRadius: "50%", opacity,
      background: `repeating-conic-gradient(from ${f * 1.0}deg, ${color} 0deg 9deg, transparent 9deg 22deg)` }} />
  );
};
