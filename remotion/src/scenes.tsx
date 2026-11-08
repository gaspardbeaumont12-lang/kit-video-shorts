import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Burst, C, CARD_COLORS, Card, CHECK_D, Chip, clampOpt, CROSS_A, CROSS_B, cue, Emoji, fitFont, FONT, MARKER, Ring, rnd,
  Scene, SLAM, sp, splitLines, StepHeader, Stroke, Stroked, TL, usePop,
} from "./kit";

type P = { scene: Scene };
const firstWord = (scene: Scene) => scene.words[0]?.from ?? 6;
const asLines = (v: any): { text: string; color?: string; bg?: string }[] =>
  (Array.isArray(v) ? v : v ? [v] : []).map((l: any) => (typeof l === "string" ? { text: l } : l));

// ================================================================== hook_counter : gros compteur + pile qui tombe
export const HookCounter: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const from = p.count_from ?? 0, to = p.count_to ?? 10;
  const passed = scene.ticks.filter((t) => f >= t).length;
  const value = Math.min(to, from + passed);
  const lastTick = [...scene.ticks].reverse().find((t) => f >= t) ?? -99;
  const bump = 1 + 0.1 * Math.exp(-(f - lastTick) / 2.5);
  const end = cue(scene, "count_end", 30);
  const endPop = sp(f, end, fps, { damping: 8, stiffness: 260 });
  const alarm = cue(scene, "alarm", -1);
  const ap = sp(f, alarm, fps, { damping: 9, stiffness: 240 });
  const ring = alarm >= 0 && f >= alarm ? Math.sin((f - alarm) * 2.2) * 14 * Math.exp(-(f - alarm) / 22) : 0;
  const breathe = 1 + 0.015 * Math.sin(f / 6);
  const title = asLines(p.title);
  const cards: string[] = p.cards ?? [];
  const numStr = `${value}${p.suffix ?? ""}`;
  const numSize = Math.min(290, Math.floor(640 / (0.62 * numStr.length)));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        transform: `rotate(-2deg) scale(${breathe})` }}>
        {title.map((line, i) => (
          <div key={i} style={{ background: line.bg ?? (i === 0 ? "white" : C.yellow), border: `5px solid ${C.ink}`, borderRadius: 16, padding: "6px 26px",
            fontFamily: FONT, fontWeight: 900, fontSize: fitFont(line.text, 820, 70, 44), color: line.color ?? C.ink, boxShadow: `0 8px 0 ${C.ink}`,
            display: "flex", alignItems: "center", gap: 12 }}>
            {line.text}{i === title.length - 1 && p.title_emoji && <Emoji name={p.title_emoji} size={74} />}
          </div>
        ))}
      </div>
      {cards.map((c, i) => {
        const t0 = i * 3 - 14;
        const s = sp(f, t0, fps, { damping: 13, stiffness: 170, mass: 0.8 });
        const x = 540 - 160 + (rnd(i) - 0.5) * 380;
        const yEnd = 1040 - Math.min(i, 6) * 9;
        const y = interpolate(s, [0, 1], [-400, yEnd]);
        const r = (rnd(i + 7) - 0.5) * 34;
        return <Card key={i} label={c} color={CARD_COLORS[i % CARD_COLORS.length]} style={{ left: x, top: y, transform: `rotate(${r * s}deg)` }} />;
      })}
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, transform: `scale(${bump})` }}>
          <Stroked stroke={26} color={p.color ?? C.red} style={{ fontFamily: FONT, fontWeight: 900, fontSize: numSize, lineHeight: 1, letterSpacing: -8,
            textShadow: `0 14px 0 ${C.ink}` }}>{numStr}</Stroked>
          {f >= end && (
            <span style={{ transform: `scale(${endPop}) rotate(${(1 - endPop) * 60}deg)`, display: "inline-block" }}>
              <Emoji name={p.end_emoji ?? "anxious-face-with-sweat"} size={190} />
            </span>
          )}
        </div>
        {p.label && (
          <div style={{ marginTop: 6, background: C.ink, color: "white", fontFamily: FONT, fontWeight: 900, fontSize: fitFont(p.label, 860, 60, 36),
            padding: "8px 28px", borderRadius: 14, transform: "rotate(1.5deg)" }}>{p.label}</div>
        )}
      </div>
      {alarm >= 0 && f >= alarm && (
        <div style={{ position: "absolute", left: 70, top: 600, transform: `scale(${ap}) rotate(${ring}deg)` }}>
          <Emoji name={p.alarm_emoji ?? "alarm-clock"} size={170} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== hook_title : phrase choc en gros blocs (entière dès l'image 0)
export const HookTitle: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const lines = asLines(p.lines);
  const n = Math.max(1, lines.length);
  const top = 300, avail = (p.emoji ? 1010 : 1110) - top;
  const longest = Math.max(...lines.map((l) => l.text.length), 1);
  const fs = Math.min(fitFont("x".repeat(longest), 900, 175, 64, 0.7), Math.floor(avail / (n * 1.38)));
  const lastAt = cue(scene, `l${n - 1}`, (n - 1) * 6);
  const emojiAt = cue(scene, "emoji", lastAt + 6);
  const ep = sp(f, emojiAt, fps, { damping: 9, stiffness: 240 });
  return (
    <AbsoluteFill>
      {p.burst !== false && <Burst cx={540} cy={700} opacity={0.32} />}
      <div style={{ position: "absolute", top, left: 0, right: 0, height: avail, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {lines.map((l, i) => {
          const at = i === 0 ? 0 : cue(scene, `l${i}`, i * 6);
          const enter = sp(f, i * 2 - 30, fps, SLAM);            // déjà en place à l'image 0
          const hit = f >= at && i > 0 ? Math.exp(-(f - at) / 5) : 0; // coup d'accent quand la voix dit la ligne
          const on = i === 0 || f >= at;
          return (
            <div key={i} style={{ background: on ? (l.bg ?? (i % 2 === 0 ? "white" : C.yellow)) : "rgba(255,255,255,0.75)", border: `6px solid ${C.ink}`,
              borderRadius: 22, padding: "2px 30px", boxShadow: `0 10px 0 ${C.ink}`, fontFamily: FONT, fontWeight: 900, fontSize: fs, lineHeight: 1.1,
              color: l.color ?? C.ink, letterSpacing: -2, whiteSpace: "nowrap", opacity: enter,
              transform: `scale(${1 + 0.16 * hit}) rotate(${(i % 2 ? 1.5 : -2) + hit * 3}deg)` }}>
              {l.text}
            </div>
          );
        })}
      </div>
      {p.emoji && f >= emojiAt && (
        <div style={{ position: "absolute", right: 50, top: 1020, transform: `scale(${ep}) rotate(${(1 - ep) * 50 + Math.sin(f / 5) * 6}deg)` }}>
          <Emoji name={p.emoji} size={185} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== quote : bulles de messages (POV, phrases du public)
export const Quote: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const msgs: { text: string; side?: string; emoji?: string }[] = p.messages ?? [];
  const hp = sp(f, cue(scene, "header", 0), fps, { damping: 11 });
  const zoneTop = p.header ? 440 : 320, maxY = 1130;
  let fs = 78, heights: number[] = [];
  for (; fs >= 40; fs -= 2) {
    const cpl = Math.floor(780 / (0.58 * fs));
    heights = msgs.map((m) => Math.ceil((m.text.length + (m.emoji ? 3 : 0)) / cpl) * fs * 1.22 + 52);
    if (zoneTop + heights.reduce((a, b) => a + b + 40, 0) <= maxY) break;
  }
  const used = heights.reduce((a, b) => a + b + 40, 0) - 40;
  let y = zoneTop + Math.max(0, (maxY - zoneTop - used) / 2);
  return (
    <AbsoluteFill>
      {p.header && (
        <div style={{ position: "absolute", top: 250, left: 60, right: 60, textAlign: "center", transform: `scale(${hp}) rotate(-2deg)` }}>
          <Stroked stroke={16} style={{ fontFamily: MARKER, fontSize: fitFont(p.header, 940, 88, 40, 0.62), whiteSpace: "nowrap" }}>{p.header}</Stroked>
        </div>
      )}
      {msgs.map((m, i) => {
        const at = cue(scene, `m${i + 1}`, i === 0 ? firstWord(scene) : i * 24);
        const right = m.side === "right";
        const top = y; y += heights[i] + 40;
        const s = sp(f, at, fps, { damping: 12, stiffness: 260, mass: 0.6 });
        const side: React.CSSProperties = right ? { right: 80 } : { left: 80 };
        const box: React.CSSProperties = { position: "absolute", top, ...side, maxWidth: 880, borderRadius: 44, border: `5px solid ${C.ink}`,
          boxShadow: `0 8px 0 ${C.ink}`, background: right ? C.blue : "white" };
        if (f >= at - 10 && f < at) {
          return (
            <div key={i} style={{ ...box, padding: "28px 34px", display: "flex", gap: 12 }}>
              {[0, 1, 2].map((k) => (
                <div key={k} style={{ width: 22, height: 22, borderRadius: 11, background: right ? "white" : C.ink, opacity: 0.3 + 0.7 * Math.abs(Math.sin((f + k * 4) / 4)) }} />
              ))}
            </div>
          );
        }
        if (f < at) return null;
        return (
          <div key={i} style={{ ...box, padding: "20px 32px", color: right ? "white" : C.ink, fontFamily: FONT, fontWeight: 800, fontSize: fs, lineHeight: 1.22,
            transform: `scale(${s})`, transformOrigin: right ? "100% 100%" : "0% 100%" }}>
            {m.text}{m.emoji && <Emoji name={m.emoji} size={fs * 1.2} style={{ marginLeft: 10, verticalAlign: "middle" }} />}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ================================================================== cross_list : liste barrée d'une grande croix + tampon
export const CrossList: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const items: string[] = p.items ?? [];
  const n = Math.max(1, items.length);
  const step = Math.min(118, Math.floor(590 / n));
  const hAt = cue(scene, "header", firstWord(scene));
  const hp = usePop(hAt, { damping: 9 });
  const list = cue(scene, "list", hAt + 8);
  const cross = cue(scene, "cross", list + 20);
  const stampP = sp(f, cross + 3, fps, SLAM);
  const listH = n * step;
  const header = p.header ?? "SURTOUT";
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 18,
        transform: `scale(${hp}) rotate(-3deg)` }}>
        <Emoji name={p.header_emoji ?? "warning"} size={120} />
        <Stroked stroke={20} color={C.red} style={{ fontFamily: MARKER, fontSize: fitFont(header, 760, 130, 60, 0.62) }}>{header}</Stroked>
      </div>
      {items.map((it, i) => {
        const at = list + i * 2;
        if (f < at) return null;
        const s = sp(f, at, fps, { damping: 12, stiffness: 260, mass: 0.6 });
        return (
          <div key={i} style={{ position: "absolute", left: 230, top: 470 + i * step, width: 620, height: step - 22, borderRadius: 16, background: "white",
            border: `4px solid ${C.ink}`, boxShadow: `0 7px 0 ${C.ink}`, display: "flex", alignItems: "center", gap: 22, paddingLeft: 26,
            transform: `translateX(${(1 - s) * -900}px) rotate(${(i % 2 ? 1 : -1) * 1.2}deg)`, fontFamily: FONT, fontWeight: 800,
            fontSize: fitFont(it, 480, 50, 30, 0.62), color: C.ink }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, border: `4px solid ${C.ink}`, flexShrink: 0 }} />
            {it}
          </div>
        );
      })}
      <Stroke d="M8 6 C 40 40, 62 62, 94 96" at={cross - 4} dur={4} width={42} box={[190, 440, 700, listH + 40]} />
      <Stroke d="M92 6 C 62 38, 40 62, 6 94" at={cross} dur={4} width={42} box={[190, 440, 700, listH + 40]} />
      {p.stamp && f >= cross + 3 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: Math.min(1010, 470 + listH - 60), display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `scale(${3 - 2 * stampP}) rotate(-7deg)`, opacity: Math.min(1, stampP * 2), border: `8px solid ${C.red}`, borderRadius: 18,
            padding: "6px 30px", fontFamily: FONT, fontWeight: 900, fontSize: fitFont(p.stamp, 860, 76, 44), color: C.red, background: "rgba(255,255,255,0.92)" }}>{p.stamp}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== big_number : gros chiffre tamponné + pastilles
export const BigNumber: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const num = `${p.number ?? 3}`;
  const t3 = cue(scene, "number", firstWord(scene) + 10);
  const dots = cue(scene, "badges", t3 + 6);
  const s = sp(f, t3 - 2, fps, { ...SLAM, stiffness: 380, mass: 0.7 });
  const blob = usePop(0, { damping: 14 });
  const pre = interpolate(f, [0, t3], [0, 1], clampOpt);
  const nb = Math.min(6, p.badges ?? (/^\d+$/.test(num) && +num <= 6 ? +num : 0));
  const pos = [[230, 440], [800, 380], [820, 760], [170, 760], [500, 300], [520, 880]];
  const wp = sp(f, t3, fps, { damping: 10, stiffness: 260 });
  const numSize = Math.min(560, Math.floor(760 / (0.62 * num.length)));
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 540 - 300, top: 330, width: 600, height: 600, borderRadius: "50%", background: C.yellow,
        transform: `scale(${blob * (1 + 0.04 * Math.sin(f / 3))}) rotate(${f * 2}deg)`, border: `6px dashed ${C.ink}` }} />
      {f < t3 && (
        <div style={{ position: "absolute", top: 540, left: 0, right: 0, textAlign: "center", fontFamily: MARKER, fontSize: 150, color: C.ink,
          transform: `scale(${0.8 + 0.3 * pre}) rotate(${Math.sin(f / 2) * 4}deg)` }}>{p.teaser ?? "?!"}</div>
      )}
      {f >= t3 - 2 && (
        <div style={{ position: "absolute", top: 330 + 300 - numSize * 0.55, left: 0, right: 0, textAlign: "center", transform: `scale(${3.2 - 2.2 * s})`, opacity: Math.min(1, s * 3) }}>
          <Stroked stroke={30} color={p.color ?? C.blue} style={{ fontFamily: FONT, fontWeight: 900, fontSize: numSize, lineHeight: 1, textShadow: `0 18px 0 ${C.ink}` }}>{num}</Stroked>
        </div>
      )}
      {Array.from({ length: nb }).map((_, i) => {
        const at = dots + i * 3;
        if (f < at) return null;
        const d = sp(f, at, fps, { damping: 9, stiffness: 300, mass: 0.5 });
        return (
          <div key={i} style={{ position: "absolute", left: pos[i][0], top: pos[i][1], width: 130, height: 130, borderRadius: 65, background: CARD_COLORS[(i + 1) % 6],
            border: `5px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900, fontSize: 70,
            color: C.ink, transform: `scale(${d}) rotate(${(1 - d) * 120}deg)`, boxShadow: `0 8px 0 ${C.ink}` }}>{i + 1}</div>
        );
      })}
      {p.word && f >= t3 && (
        <div style={{ position: "absolute", top: 950, left: 0, right: 0, textAlign: "center" }}>
          <Stroked stroke={18} style={{ fontFamily: MARKER, fontSize: fitFont(p.word, 900, 120, 56, 0.62), transform: `rotate(-4deg) scale(${wp})` }}>{p.word}</Stroked>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== sort_bins : cartes triées dans deux bacs
export const SortBins: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const h = cue(scene, "header", firstWord(scene));
  const L = cue(scene, "left", h + 20), R = cue(scene, "right", L + 20);
  const cards: string[] = (p.cards ?? []).slice(0, 6);
  const half = Math.ceil(cards.length / 2);
  const binPop = (k: number) => sp(f, Math.min(h + 3, 4) + k * 3, fps, { damping: 11, stiffness: 240 });
  const bins = [
    { x: 80, label: p.left, emoji: p.left_emoji, bg: "#FFE1CF", bd: C.orange },
    { x: 560, label: p.right, emoji: p.right_emoji, bg: "#DDE8FF", bd: C.blue },
  ];
  return (
    <AbsoluteFill>
      <StepHeader n={p.n} text={p.header ?? ""} at={h} />
      {bins.map((b, k) => (
        <div key={k} style={{ position: "absolute", left: b.x, top: 790, width: 440, height: 330, borderRadius: 28, background: b.bg,
          border: `5px solid ${C.ink}`, boxShadow: `0 10px 0 ${C.ink}`, transform: `scale(${binPop(k)})`, transformOrigin: "50% 100%" }}>
          <div style={{ position: "absolute", top: -46, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
            <div style={{ background: b.bd, color: "white", border: `4px solid ${C.ink}`, borderRadius: 14, padding: "4px 22px", display: "flex",
              alignItems: "center", gap: 10, fontFamily: FONT, fontWeight: 900, fontSize: fitFont(b.label ?? "", 300, 52, 30), whiteSpace: "nowrap" }}>
              <Emoji name={b.emoji} size={58} />{b.label}
            </div>
          </div>
        </div>
      ))}
      {cards.map((c, i) => {
        const goLeft = i < half;
        const k = goLeft ? i : i - half;
        const start = (goLeft ? L : R) + k * 4;
        const s = sp(f, start, fps, { damping: 14, stiffness: 150, mass: 0.7 });
        const x0 = 390 + (rnd(i + 3) - 0.5) * 60, y0 = 480 + i * 12;
        const x1 = (goLeft ? 150 : 630) + (k === 1 ? 20 : 0), y1 = 880 + k * 70;
        const x = interpolate(s, [0, 1], [x0, x1]);
        const y = interpolate(s, [0, 1], [y0, y1]) - Math.sin(Math.min(1, s) * Math.PI) * 160;
        const r = interpolate(s, [0, 1], [(rnd(i) - 0.5) * 24, (rnd(i + 11) - 0.5) * 10]);
        return <Card key={i} label={c} color={CARD_COLORS[i % CARD_COLORS.length]} style={{ left: x, top: y, transform: `rotate(${r}deg) scale(${interpolate(s, [0, 1], [1, 0.95])})` }} />;
      })}
    </AbsoluteFill>
  );
};

// ================================================================== calendar : planning qui se remplit
export const Calendar: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const h = cue(scene, "header", firstWord(scene));
  const fill = cue(scene, "fill", h + 15);
  const special = cue(scene, "special", -1);
  const weeks = Math.max(2, Math.min(5, p.weeks ?? 4));
  const days = ["L", "M", "M", "J", "V", "S", "D"];
  const cell = weeks > 4 ? 92 : 104, gap = 10, gx = 540 - (7 * cell + 6 * gap) / 2, gy = 618;
  const total = weeks * 7;
  const specialIdx = p.special_day ?? total - 1;
  const ex = sp(f, special, fps, { damping: 8, stiffness: 240 });
  const skipWE = !!p.skip_weekends;
  let k = 0;
  return (
    <AbsoluteFill>
      <StepHeader n={p.n} text={p.header ?? ""} at={h} />
      <div style={{ position: "absolute", left: gx - 34, top: gy - 110, width: 7 * cell + 6 * gap + 68, height: weeks * (cell + gap) + 140, borderRadius: 30,
        background: "white", border: `5px solid ${C.ink}`, boxShadow: `0 12px 0 ${C.ink}` }} />
      {days.map((d, i) => (
        <div key={i} style={{ position: "absolute", left: gx + i * (cell + gap), top: gy - 82, width: cell, textAlign: "center", fontFamily: FONT,
          fontWeight: 900, fontSize: 40, color: i > 4 ? C.red : C.ink }}>{d}</div>
      ))}
      {Array.from({ length: total }).map((_, i) => {
        const col = i % 7, row = Math.floor(i / 7);
        const isSpecial = special >= 0 && i === specialIdx;
        const fillable = !isSpecial && !(skipWE && col > 4);
        const at = fill + (fillable ? k++ : 0);
        const s = sp(f, at, fps, { damping: 10, stiffness: 300, mass: 0.45 });
        return (
          <div key={i} style={{ position: "absolute", left: gx + col * (cell + gap), top: gy + row * (cell + gap), width: cell, height: cell,
            borderRadius: 16, border: `3px solid ${C.grid}`, background: "#FBF8F1" }}>
            {fillable && f >= at && (
              <div style={{ position: "absolute", inset: 10, borderRadius: 12, background: CARD_COLORS[(i * 5) % 4], border: `3px solid ${C.ink}`, transform: `scale(${s})` }} />
            )}
            {isSpecial && f >= special && (
              <div style={{ position: "absolute", inset: -8, borderRadius: 20, background: C.red, border: `4px solid ${C.ink}`, display: "flex",
                alignItems: "center", justifyContent: "center", transform: `scale(${ex * (1 + 0.06 * Math.sin((f - special) / 2))})` }}>
                <Emoji name={p.special_emoji ?? "graduation-cap"} size={cell * 0.72} />
              </div>
            )}
          </div>
        );
      })}
      {special >= 0 && p.special_label && f >= special && (
        <div style={{ position: "absolute", left: gx + (specialIdx % 7) * (cell + gap) + cell / 2 - 200, top: gy + weeks * (cell + gap) + 6, width: 400, textAlign: "center",
          transform: `scale(${ex}) rotate(-4deg)` }}>
          <Stroked stroke={14} color={C.red} style={{ fontFamily: MARKER, fontSize: 56 }}>{p.special_label}</Stroked>
        </div>
      )}
      {p.chip && <Chip text={p.chip} emoji={p.chip_emoji} at={cue(scene, "chip", h + 10)} x={540} y={432} rot={-3} bg={C.yellow} fg={C.ink} size={46} />}
    </AbsoluteFill>
  );
};

// ================================================================== versus : mauvaise méthode barrée / bonne méthode cochée
export const Versus: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const h = cue(scene, "header", firstWord(scene));
  const bad = cue(scene, "bad", h + 15), good = cue(scene, "good", bad + 20);
  const m0 = cue(scene, "meter", -1), m1 = cue(scene, "meter_full", m0 + 25);
  const g = sp(f, good, fps, { damping: 9, stiffness: 220 });
  const fillW = m0 >= 0 ? interpolate(f, [m0, m1], [0.12, 1], { ...clampOpt, easing: Easing.inOut(Easing.cubic) }) : 0;
  const full = sp(f, m1, fps, { damping: 8, stiffness: 260 });
  const card = (k: number) => {
    const isBad = k === 0;
    const dim = isBad && f >= bad ? interpolate(f, [bad, bad + 6], [1, 0.55], clampOpt) : 1;
    const tilt = isBad && f >= bad ? interpolate(f, [bad, bad + 6], [0, -6], clampOpt) : 0;
    const up = !isBad && f >= good ? 1 + 0.08 * g : 1;
    const label: string = isBad ? p.bad ?? "" : p.good ?? "";
    return (
      <div key={k} style={{ position: "absolute", left: isBad ? 80 : 560, top: 500, width: 440, height: 400, borderRadius: 30,
        background: isBad ? "#FFE3E3" : "#DDF7E6", border: `5px solid ${C.ink}`,
        boxShadow: !isBad && f >= good ? `0 12px 0 ${C.ink}, 0 0 0 ${14 * g}px rgba(22,163,74,0.25)` : `0 12px 0 ${C.ink}`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, opacity: dim,
        transform: `rotate(${tilt}deg) scale(${up})`, textAlign: "center", padding: "0 16px" }}>
        <Emoji name={isBad ? p.bad_emoji : p.good_emoji} size={180} />
        <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: fitFont(label, 400, 64, 34), color: C.ink, lineHeight: 1.05 }}>{label}</div>
      </div>
    );
  };
  return (
    <AbsoluteFill>
      <StepHeader n={p.n} text={p.header ?? ""} at={h} />
      {card(0)}
      {card(1)}
      <Stroke d={CROSS_A} at={bad} dur={4} width={34} box={[110, 530, 380, 340]} />
      <Stroke d={CROSS_B} at={bad + 3} dur={4} width={34} box={[110, 530, 380, 340]} />
      <Stroke d={CHECK_D} at={good} dur={6} width={36} color={C.green} box={[620, 540, 320, 300]} />
      {m0 >= 0 && p.meter && (
        <div style={{ position: "absolute", left: 80, top: 980, width: 920, height: 120, borderRadius: 26, background: "white", border: `5px solid ${C.ink}`,
          boxShadow: `0 10px 0 ${C.ink}`, overflow: "hidden", opacity: interpolate(f, [m0 - 6, m0], [0, 1], clampOpt) }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillW * 100}%`, background: `linear-gradient(90deg, #7EE2A0, ${C.green})` }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: FONT, fontWeight: 900,
            fontSize: 56, color: C.ink }}>
            {p.meter}
            {f >= m1 && <span style={{ transform: `scale(${full})`, display: "inline-block" }}><Emoji name={p.meter_emoji ?? "sparkles"} size={70} /></span>}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== checklist : lignes qui arrivent et se cochent
export const Checklist: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const items: string[] = (p.items ?? []).slice(0, 5);
  const n = Math.max(1, items.length);
  const h = cue(scene, "header", firstWord(scene));
  const rowH = Math.min(150, Math.floor(620 / n));
  const top = 470;
  return (
    <AbsoluteFill>
      <StepHeader n={p.n} text={p.header ?? ""} at={h} emoji={p.header_emoji} />
      <div style={{ position: "absolute", left: 70, top: top - 20, width: 940, height: n * rowH + 40, borderRadius: 30, background: "white",
        border: `5px solid ${C.ink}`, boxShadow: `0 12px 0 ${C.ink}`, transform: `scale(${sp(f, Math.min(h + 2, 3), fps, { damping: 13 })})`, transformOrigin: "50% 0%" }} />
      {items.map((it, i) => {
        const at = cue(scene, `i${i + 1}`, h + 10 + i * 14);
        if (f < at) return null;
        const s = sp(f, at, fps, { damping: 12, stiffness: 260, mass: 0.6 });
        const y = top + i * rowH;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: 110, top: y + (rowH - 76) / 2, width: 76, height: 76, borderRadius: 16, border: `5px solid ${C.ink}`,
              background: "#F4FBF6", transform: `scale(${s})` }} />
            <Stroke d={CHECK_D} at={at + 4} dur={5} width={30} color={C.green} box={[118, y + (rowH - 76) / 2 + 4, 66, 64]} />
            <div style={{ position: "absolute", left: 220, top: y, height: rowH, width: 750, display: "flex", alignItems: "center", fontFamily: FONT, fontWeight: 800,
              fontSize: it.length <= 20 ? 60 : Math.max(40, Math.min(54, Math.floor((rowH - 14) / 2.25))), lineHeight: 1.08, color: C.ink,
              transform: `translateX(${(1 - s) * 400}px)`, opacity: Math.min(1, s * 2) }}>{it}</div>
            {i < n - 1 && <div style={{ position: "absolute", left: 110, right: 110, top: y + rowH - 2, height: 3, background: C.grid }} />}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ================================================================== timer : minuteur rond qui défile
export const Timer: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const h = cue(scene, "header", firstWord(scene));
  const start = cue(scene, "start", h + 8), done = cue(scene, "done", start + 30);
  const prog = interpolate(f, [start, done], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.quad) });
  const [mm, ss] = `${p.from ?? "25:00"}`.split(":").map((x: string) => parseInt(x, 10) || 0);
  const totalS = mm * 60 + ss;
  const rem = Math.round(totalS * (1 - prog));
  const disp = `${String(Math.floor(rem / 60)).padStart(2, "0")}:${String(rem % 60).padStart(2, "0")}`;
  const isDone = f >= done;
  const dp = sp(f, done, fps, { damping: 8, stiffness: 260 });
  const rp = sp(f, Math.min(h + 3, 4), fps, { damping: 12 });
  const size = 560;
  return (
    <AbsoluteFill>
      <StepHeader n={p.n} text={p.header ?? ""} at={h} />
      <div style={{ position: "absolute", left: 540 - size / 2, top: 470, width: size, height: size, transform: `scale(${rp * (isDone ? 1 + 0.06 * dp * Math.exp(-(f - done) / 10) : 1)})` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "white", border: `6px solid ${C.ink}`, boxShadow: `0 12px 0 ${C.ink}` }} />
        <Ring progress={prog} size={size} color={isDone ? C.green : C.red} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 150, color: C.ink, letterSpacing: -4, lineHeight: 1 }}>{disp}</div>
          {p.label && <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: fitFont(p.label, 380, 52, 30), color: isDone ? C.green : C.ink, marginTop: 10 }}>{p.label}</div>}
        </div>
        {p.emoji && <div style={{ position: "absolute", right: -30, top: -30, transform: `scale(${rp}) rotate(${Math.sin(f / 3) * (isDone ? 0 : 8)}deg)` }}><Emoji name={p.emoji} size={150} /></div>}
        {isDone && <div style={{ position: "absolute", left: -30, bottom: -20, transform: `scale(${dp})` }}><Emoji name={p.done_emoji ?? "check-mark-button"} size={140} /></div>}
      </div>
      {p.sub && <Chip text={p.sub} emoji={p.sub_emoji} at={cue(scene, "sub", done + 6)} x={540} y={1065} rot={-2} bg={C.yellow} fg={C.ink} size={50} />}
    </AbsoluteFill>
  );
};

// ================================================================== emoji_focus : un grand emoji + un mot
export const EmojiFocus: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const ea = cue(scene, "emoji", 0);
  const wa = cue(scene, "word", ea + 8);
  const sa = cue(scene, "sub", wa + 10);
  const e = sp(f, ea, fps, { damping: 8, stiffness: 220, mass: 0.7 });
  const w = sp(f, wa, fps, SLAM);
  const s = sp(f, sa, fps, { damping: 11 });
  const word: string = p.word ?? "";
  const lines = splitLines(word.toUpperCase(), 12);
  const fs = fitFont("x".repeat(Math.max(...lines.map((l) => l.length))), 900, 140, 64);
  return (
    <AbsoluteFill>
      {[0, 1, 2].map((k) => {
        const t = ((f - ea + k * 14) % 42) / 42;
        if (f < ea) return null;
        return <div key={k} style={{ position: "absolute", left: 540 - 220, top: 600 - 220, width: 440, height: 440, borderRadius: "50%",
          border: `8px solid ${p.color ?? C.yellow}`, transform: `scale(${0.7 + t * 0.9})`, opacity: (1 - t) * 0.8 }} />;
      })}
      <div style={{ position: "absolute", left: 540 - 190, top: 410, transform: `scale(${e}) rotate(${(1 - e) * -30 + Math.sin(f / 6) * 4}deg)` }}>
        <Emoji name={p.emoji} size={380} style={{ filter: "drop-shadow(0 14px 0 rgba(21,23,47,0.25))" }} />
      </div>
      {f >= wa && (
        <div style={{ position: "absolute", top: 830, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center",
          transform: `scale(${2.2 - 1.2 * w})`, opacity: Math.min(1, w * 3) }}>
          {lines.map((l, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: -14, right: -14, bottom: fs * 0.08, height: fs * 0.5, background: p.color ?? C.yellow, borderRadius: 10, transform: "skewX(-10deg)" }} />
              <div style={{ position: "relative", fontFamily: FONT, fontWeight: 900, fontSize: fs, lineHeight: 1.02, color: C.ink, letterSpacing: -2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
      {p.sub && f >= sa && (
        <div style={{ position: "absolute", top: 830 + lines.length * fs * 1.05 + 30, left: 40, right: 40, textAlign: "center", transform: `scale(${s}) rotate(-2deg)` }}>
          <Stroked stroke={14} style={{ fontFamily: MARKER, fontSize: fitFont(p.sub, 960, 64, 40, 0.55) }}>{p.sub}</Stroked>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== product_reveal : couverture 3D + prix + bio
const fitTitle = (title: string, width: number, maxH: number) => {
  const words = title.toUpperCase().split(/\s+/);
  for (let fs = 84; fs >= 40; fs -= 2) {
    const cpl = Math.floor(width / (0.68 * fs));
    const lines: string[][] = [[]];
    let len = 0;
    for (const w of words) {
      if (len + w.length > cpl && lines[lines.length - 1].length) { lines.push([]); len = 0; }
      lines[lines.length - 1].push(w); len += w.length + 1;
    }
    if (lines.length * fs * 1.04 <= maxH && Math.max(...words.map((w) => w.length)) <= cpl) return { fs, lines };
  }
  return { fs: 40, lines: [words] };
};

export const ProductReveal: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prod = (TL.product ?? {}) as any;
  const rv = cue(scene, "reveal", 0), sh = cue(scene, "shine", rv + 30), bio = cue(scene, "bio", -1), pr = cue(scene, "price", -1);
  const s = sp(f, rv, fps, { damping: 13, stiffness: 120, mass: 0.9 });
  const ry = interpolate(s, [0, 1], [80, 0]) + Math.sin(f / 18) * 7;
  const rx = Math.sin(f / 25) * 4;
  const shineX = interpolate(f, [sh, sh + 16], [-900, 900], clampOpt);
  const ps = sp(f, pr, fps, SLAM);
  const hl = `${prod.highlight ?? ""}`.toUpperCase();
  const { fs, lines } = fitTitle(prod.title ?? "", 520, 430);
  return (
    <AbsoluteFill>
      <Burst cx={540} cy={700} opacity={0.55 * s} />
      <div style={{ position: "absolute", left: 540 - 300, top: 300, width: 600, height: 790, perspective: 1600 }}>
        {[2, 1].map((k) => (
          <div key={k} style={{ position: "absolute", inset: 0, borderRadius: 22, background: "white", border: `4px solid ${C.ink}`,
            transform: `translate(${k * 22 * s}px, ${k * -16 * s}px) rotate(${k * 3 * s}deg)` }} />
        ))}
        <div style={{ position: "absolute", inset: 0, borderRadius: 22, background: prod.cover_color ?? C.navy, border: `5px solid ${C.ink}`, overflow: "hidden",
          transform: `rotateY(${ry}deg) rotateX(${rx}deg) scale(${0.55 + 0.45 * s})`, boxShadow: `0 24px 0 ${C.ink}`,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.06) 2px, transparent 2px)",
          backgroundSize: "40px 40px" }}>
          {prod.subtitle && (
            <div style={{ position: "absolute", top: 44, left: 40, background: C.yellow, color: C.ink, fontFamily: FONT, fontWeight: 900,
              fontSize: fitFont(`${prod.subtitle}`, 500, 36, 24), padding: "8px 20px", borderRadius: 12 }}>{`${prod.subtitle}`.toUpperCase()}</div>
          )}
          <div style={{ position: "absolute", top: 140, left: 40, right: 40, fontFamily: FONT, fontWeight: 900, fontSize: fs, lineHeight: 1.02, color: "white" }}>
            {lines.map((ln, i) => (
              <div key={i}>{ln.map((w, j) => <span key={j} style={{ color: hl && w.replace(/[^\p{L}\p{N}]/gu, "") === hl ? C.yellow : "white" }}>{w} </span>)}</div>
            ))}
          </div>
          <svg viewBox="0 0 100 40" style={{ position: "absolute", left: 40, bottom: 120, width: 300 }}>
            <path d="M2 30 C 30 8, 60 8, 96 22" fill="none" stroke={C.yellow} strokeWidth={5} strokeLinecap="round" />
          </svg>
          {prod.brand && <div style={{ position: "absolute", bottom: 44, left: 40, fontFamily: FONT, fontWeight: 800, fontSize: 34, color: "rgba(255,255,255,0.75)" }}>{prod.brand}</div>}
          <div style={{ position: "absolute", top: 0, bottom: 0, width: 220, left: "50%", transform: `translateX(${shineX}px) skewX(-18deg)`,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }} />
        </div>
      </div>
      {pr >= 0 && prod.price && f >= pr && (
        <div style={{ position: "absolute", left: 760, top: 250, width: 250, height: 250, borderRadius: "50%", background: C.yellow, border: `6px solid ${C.ink}`,
          boxShadow: `0 10px 0 ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 900,
          fontSize: fitFont(`${prod.price}`, 210, 64, 36, 0.62), color: C.ink, transform: `scale(${2.6 - 1.6 * ps}) rotate(${12 + (1 - ps) * 40}deg)`,
          opacity: Math.min(1, ps * 3) }}>{prod.price}</div>
      )}
      {bio >= 0 && <Chip text={scene.params.chip ?? "LIEN EN BIO"} emoji="backhand-index-pointing-up" at={bio} x={540} y={1050} rot={-3} bg={C.red} size={56} bounce />}
    </AbsoluteFill>
  );
};

// ================================================================== locked : la suite verrouillée (mystère avant le produit)
export const Locked: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const items: { text: string; open?: boolean; blur?: boolean }[] = (p.items ?? []).slice(0, 5);
  const n = Math.max(1, items.length);
  const h = cue(scene, "header", firstWord(scene));
  const list = cue(scene, "list", h + 6);
  const lock = cue(scene, "lock", list + 20);
  const rowH = Math.min(165, Math.floor(480 / n));
  const top = 470;
  const stampP = sp(f, lock + 4, fps, SLAM);
  return (
    <AbsoluteFill>
      <StepHeader text={p.header ?? "LA SUITE ?"} at={h} emoji={p.header_emoji ?? "locked"} />
      {items.map((it, i) => {
        const at = list + i * 4;
        if (f < at) return null;
        const s = sp(f, at, fps, { damping: 12, stiffness: 260, mass: 0.6 });
        const open = !!it.open;
        const shake = !open && f >= lock ? Math.sin((f - lock) * 2.4) * 12 * Math.exp(-(f - lock) / 10) : 0;
        const glow = !open && f >= lock ? 0.5 + 0.5 * Math.abs(Math.sin((f - lock) / 6)) : 0;
        return (
          <div key={i} style={{ position: "absolute", left: 80, top: top + i * rowH, width: 920, height: rowH - 22, borderRadius: 24,
            background: open ? "#DDF7E6" : C.navy, border: `5px solid ${C.ink}`, boxShadow: `0 8px 0 ${C.ink}, 0 0 ${30 * glow}px rgba(255,228,94,${0.8 * glow})`,
            display: "flex", alignItems: "center", gap: 22, padding: "0 28px", transform: `translateX(${(1 - s) * -900 + shake}px)` }}>
            <Emoji name={open ? "check-mark-button" : "locked"} size={Math.min(84, rowH * 0.6)} />
            <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: it.text.length <= 16 ? 60 : Math.max(40, Math.min(52, Math.floor((rowH - 30) / 2.2))),
              lineHeight: 1.05, maxWidth: open ? 720 : 600, color: open ? C.ink : "white", filter: !open && it.blur ? "blur(10px)" : "none" }}>{it.text}</div>
            {!open && <div style={{ marginLeft: "auto", fontFamily: FONT, fontWeight: 900, fontSize: Math.min(64, rowH * 0.45), color: C.yellow }}>???</div>}
          </div>
        );
      })}
      {p.stamp && f >= lock + 4 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: Math.min(1030, top + n * rowH + 8), display: "flex", justifyContent: "center" }}>
          <div style={{ transform: `scale(${2.2 - 1.2 * stampP}) rotate(-5deg)`, opacity: Math.min(1, stampP * 2), border: `8px solid ${C.red}`, borderRadius: 18,
            padding: "6px 30px", fontFamily: FONT, fontWeight: 900, fontSize: fitFont(p.stamp, 860, 80, 44), color: C.red, background: "rgba(255,255,255,0.95)" }}>{p.stamp}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ================================================================== cta : appel à l'action final
export const Cta: React.FC<P> = ({ scene }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = scene.params;
  const so = cue(scene, "line1", firstWord(scene) + 10), de = cue(scene, "line2", -1);
  const a = sp(f, so, fps, SLAM);
  const b = sp(f, de, fps, { damping: 11, stiffness: 260 });
  const intro = usePop(2, { damping: 12 });
  const line1: string = p.line1 ?? "";
  const words2: string[] = `${p.line2 ?? ""}`.split(" ").filter(Boolean);
  const strike = `${p.strike ?? words2[words2.length - 1] ?? ""}`;
  const fs2 = fitFont(words2.join(" "), 900, 116, 56);
  return (
    <AbsoluteFill>
      {p.top !== "" && (
        <div style={{ position: "absolute", top: 300, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 16, alignItems: "center", transform: `scale(${intro}) rotate(-2deg)` }}>
          <Emoji name={p.top_emoji ?? "crescent-moon"} size={110} />
          <span style={{ fontFamily: MARKER, fontSize: fitFont(p.top ?? "COMMENCE…", 760, 96, 50, 0.6), color: C.ink }}>{p.top ?? "COMMENCE…"}</span>
        </div>
      )}
      {f >= so && line1 && (
        <div style={{ position: "absolute", top: 480, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 18,
          transform: `scale(${2.4 - 1.4 * a}) rotate(${(1 - a) * -10 - 2}deg)`, opacity: Math.min(1, a * 3) }}>
          <div style={{ background: C.yellow, border: `6px solid ${C.ink}`, borderRadius: 22, padding: "4px 34px", boxShadow: `0 12px 0 ${C.ink}`,
            fontFamily: FONT, fontWeight: 900, fontSize: fitFont(line1, 720, 170, 70), color: C.ink, letterSpacing: -4 }}>{line1}</div>
          <Emoji name={p.line1_emoji ?? "check-mark-button"} size={150} />
        </div>
      )}
      {de >= 0 && f >= de && words2.length > 0 && (
        <div style={{ position: "absolute", top: 780, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26, fontFamily: FONT, fontWeight: 900,
          fontSize: fs2, color: C.ink, transform: `scale(${0.6 + 0.4 * b})`, opacity: Math.min(1, b * 3) }}>
          {words2.map((w, i) => w === strike ? (
            <span key={i} style={{ position: "relative", color: C.red }}>{w}
              <Stroke d="M2 55 C 30 45, 70 62, 98 48" at={de + 4} dur={5} width={22} color={C.ink} box={[-10, 0, w.length * fs2 * 0.75 + 20, fs2 * 1.12]} />
            </span>
          ) : <span key={i}>{w}</span>)}
        </div>
      )}
      <Chip text={p.chip ?? "LIEN EN BIO"} emoji={p.chip_emoji ?? "backhand-index-pointing-up"} at={cue(scene, "chip", Math.max(so, de) + 12)} x={540} y={1010} rot={2} bg={C.red} size={58} bounce />
    </AbsoluteFill>
  );
};

export const SCENES: Record<string, React.FC<P>> = {
  hook_counter: HookCounter,
  hook_title: HookTitle,
  quote: Quote,
  cross_list: CrossList,
  big_number: BigNumber,
  sort_bins: SortBins,
  calendar: Calendar,
  versus: Versus,
  checklist: Checklist,
  timer: Timer,
  emoji_focus: EmojiFocus,
  product_reveal: ProductReveal,
  locked: Locked,
  cta: Cta,
  // anciens noms (compatibilité)
  order_cross: CrossList,
  three_steps: BigNumber,
  step_sort: SortBins,
  step_plan: Calendar,
  step_test: Versus,
};
