import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Copy, FILES, SNIPPETS } from "../copy";
import { C, FONT } from "../theme";
import { Kicker, Panel, Rise, Scene, Symbol, Wordmark, clamp, useIn } from "../ui";

const CCY_COLOR: Record<string, string> = { GTQ: "#45b07f", USD: "#5562ec", EUR: "#e3a53c" };

export function Hook({ t, duration }: { t: Copy; duration: number }) {
  return (
    <Scene duration={duration}>
      <div style={{ display: "flex", height: "100%", alignItems: "center", gap: 90 }}>
        <div style={{ flex: "0 0 700px" }}>
          <Kicker>{t.hook.kicker}</Kicker>
          {t.hook.lines.map((l, i) => (
            <Rise key={l} delay={6 + i * 24}>
              <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 96, lineHeight: 1.08, letterSpacing: -2, color: i === 2 ? C.blue : C.ink }}>
                {l}
              </div>
            </Rise>
          ))}
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {FILES.map((f, i) => (
            <FileCard key={f.name} f={f} delay={70 + i * 9} />
          ))}
        </div>
      </div>
    </Scene>
  );
}

function FileCard({ f, delay }: { f: (typeof FILES)[number]; delay: number }) {
  const p = useIn(delay, 14);
  return (
    <Panel
      style={{
        padding: "26px 28px",
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px) rotate(${(1 - p) * -4}deg)`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT.mono, fontSize: 21, color: C.ink }}>{f.name}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 18, fontWeight: 700, color: CCY_COLOR[f.ccy], border: `1.5px solid ${CCY_COLOR[f.ccy]}`, borderRadius: 6, padding: "2px 9px" }}>
          {f.ccy}
        </span>
      </div>
      <div style={{ marginTop: 18, fontFamily: FONT.mono, fontSize: 19, color: C.muted }}>{f.trap}</div>
    </Panel>
  );
}

// Deterministic scatter for the format snippets.
const SPOTS = [
  [80, 260, -6], [620, 210, 4], [1180, 250, -3], [1420, 420, 7], [180, 470, 3], [760, 430, -5],
  [1080, 560, 5], [60, 650, -4], [520, 620, 6], [1330, 680, -7], [880, 720, 2], [300, 770, -2],
];

export function Chaos({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const subP = useIn(84);
  return (
    <Scene duration={duration}>
      <Rise delay={2}>
        <h1 style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 80, margin: 0, letterSpacing: -1.5 }}>{t.chaos.title}</h1>
      </Rise>
      <AbsoluteFill>
        {SNIPPETS.map((s, i) => {
          const [x, y, r] = SPOTS[i];
          const appear = interpolate(frame, [8 + i * 4, 18 + i * 4], [0, 1], clamp);
          const jx = Math.sin(frame / 6 + i * 1.7) * 6;
          const jy = Math.cos(frame / 7 + i) * 5;
          const fadeForSub = interpolate(subP, [0, 1], [1, 0.28]);
          const hot = i % 3 === 0;
          return (
            <div
              key={s}
              style={{
                position: "absolute",
                left: x + 140,
                top: y + 40,
                transform: `translate(${jx}px, ${jy}px) rotate(${r}deg) scale(${0.8 + appear * 0.2})`,
                opacity: appear * fadeForSub,
                fontFamily: FONT.mono,
                fontSize: 30,
                color: hot ? C.blocker : C.ink,
                background: C.panel,
                border: `1.5px solid ${hot ? C.blocker : C.line}`,
                borderRadius: 10,
                padding: "12px 20px",
                whiteSpace: "nowrap",
              }}
            >
              {s}
            </div>
          );
        })}
      </AbsoluteFill>
      <div style={{ flex: 1 }} />
      <div
        style={{
          opacity: subP,
          transform: `translateY(${(1 - subP) * 30}px)`,
          fontFamily: FONT.display,
          fontWeight: 500,
          fontSize: 50,
          lineHeight: 1.2,
          maxWidth: 1400,
          background: `${C.bg}e6`,
          padding: "24px 0",
          zIndex: 2,
        }}
      >
        {t.chaos.sub}
      </div>
    </Scene>
  );
}

export function Reveal({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const converge = interpolate(frame, [0, 16], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const logo = useIn(12, 12);
  const word = useIn(22);
  const line = useIn(44);
  const flash = interpolate(frame, [14, 18, 34], [0, 0.5, 0], clamp);
  return (
    <Scene duration={duration}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          const r = 700 * (1 - converge);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 26,
                height: 26,
                background: C.blue,
                transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r * 0.6}px)`,
                opacity: 1 - logo,
              }}
            />
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 48, transform: `scale(${0.7 + logo * 0.3})`, opacity: logo }}>
          <Symbol size={200} />
          <div style={{ opacity: word, transform: `translateX(${(1 - word) * -30}px)` }}>
            <Wordmark width={560} />
          </div>
        </div>
        <div
          style={{
            marginTop: 70,
            opacity: line,
            transform: `translateY(${(1 - line) * 20}px)`,
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: 48,
            textAlign: "center",
            maxWidth: 1300,
            lineHeight: 1.25,
          }}
        >
          {t.reveal.line}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.blue, opacity: flash }} />
    </Scene>
  );
}
