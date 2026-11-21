import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Copy, FINDINGS, Lang } from "../copy";
import { C, FONT } from "../theme";
import { Kicker, Panel, Rise, Scene, SevBadge, Title, clamp, useIn } from "../ui";

const BEAT = 18; // frames per beat at 100 BPM / 30 fps

export function Pipeline({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const start = 30;
  const pulse = interpolate(frame, [start, start + BEAT * 6 * 1.5], [0, 1], clamp);
  return (
    <Scene duration={duration}>
      <Kicker>{t.pipeline.kicker}</Kicker>
      <Title>{t.pipeline.title}</Title>
      <div style={{ position: "relative", marginTop: 100, display: "flex", gap: 26 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 236, height: 4, borderRadius: 2, background: C.line }} />
        <div style={{ position: "absolute", left: 0, width: `${pulse * 100}%`, top: 236, height: 4, borderRadius: 2, background: C.blue, boxShadow: `0 0 24px ${C.blue}` }} />
        {t.pipeline.stages.map(([name, sub], i) => {
          const on = frame >= start + i * BEAT * 1.5;
          const p = useIn(start + i * BEAT * 1.5 - 6, 14);
          const last = i === t.pipeline.stages.length - 1;
          return (
            <div key={name} style={{ flex: 1, position: "relative", opacity: 0.35 + 0.65 * p, transform: `translateY(${(1 - p) * 24}px)` }}>
              <Panel
                style={{
                  height: 200,
                  padding: "26px 24px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderColor: on ? (last ? C.positive : C.blue) : C.line,
                  background: on ? (last ? `${C.positive}1c` : C.blueSoft) : C.panel,
                }}
              >
                <div style={{ fontFamily: FONT.mono, fontSize: 22, color: on ? C.blue : C.muted }}>{`0${i + 1}`}</div>
                <div>
                  <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 34 }}>{name}</div>
                  <div style={{ fontSize: 22, color: C.muted, marginTop: 6 }}>{sub}</div>
                </div>
              </Panel>
            </div>
          );
        })}
      </div>
      <Rise delay={140}>
        <div style={{ marginTop: 120, fontFamily: FONT.mono, fontSize: 28, color: C.muted, letterSpacing: 0.5 }}>{t.pipeline.foot}</div>
      </Rise>
    </Scene>
  );
}

export function Findings({ t, lang, duration }: { t: Copy; lang: Lang; duration: number }) {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [20, 20 + 13 * 6], [0, 13], clamp));
  const swap = interpolate(frame, [150, 166], [0, 1], clamp);
  return (
    <Scene duration={duration}>
      <Kicker>{t.findings.kicker}</Kicker>
      <Title size={58}>{t.findings.title}</Title>
      <div style={{ display: "flex", gap: 80, marginTop: 50, flex: 1 }}>
        <div style={{ flex: "0 0 440px" }}>
          <Rise delay={14}>
            <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 220, lineHeight: 1, letterSpacing: -6 }}>
              <span style={{ color: count === 13 ? C.positive : C.ink }}>{count}</span>
              <span style={{ color: C.muted }}>/13</span>
            </div>
            <div style={{ fontSize: 32, color: C.muted, marginTop: 8 }}>{t.findings.caught}</div>
          </Rise>
          <Rise delay={110}>
            <div style={{ marginTop: 50, display: "flex", alignItems: "baseline", gap: 18 }}>
              <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 110, color: C.positive }}>0</span>
              <span style={{ fontSize: 32, color: C.muted }}>{t.findings.fp}</span>
            </div>
          </Rise>
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 1 - swap, transform: `translateX(${-swap * 60}px)`, columnCount: 2, columnGap: 30 }}>
            {FINDINGS.map((f, i) => (
              <FindingLine key={f.id} f={f} lang={lang} delay={20 + i * 6} />
            ))}
          </div>
          {swap > 0 && <Spotlight t={t} p={swap} />}
        </div>
      </div>
    </Scene>
  );
}

function FindingLine({ f, lang, delay }: { f: (typeof FINDINGS)[number]; lang: Lang; delay: number }) {
  const p = useIn(delay, 16);
  return (
    <div
      style={{
        breakInside: "avoid",
        opacity: p,
        transform: `translateX(${(1 - p) * 40}px)`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "15px 0",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <span style={{ fontFamily: FONT.mono, fontSize: 22, color: C.blue, width: 70 }}>{f.id}</span>
      <span style={{ fontSize: 25, flex: 1 }}>{f[lang]}</span>
      <SevBadge sev={f.sev} />
    </div>
  );
}

function Spotlight({ t, p }: { t: Copy; p: number }) {
  const frame = useCurrentFrame();
  const diff = interpolate(frame, [185, 200], [0, 1], clamp);
  const side = (label: string, amount: string, src: string, hl: boolean) => (
    <Panel style={{ flex: 1, padding: "28px 30px", borderColor: hl ? C.warning : C.line }}>
      <div style={{ fontSize: 24, color: C.muted }}>{label}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 60, fontWeight: 700, marginTop: 10 }}>
        {amount.split("").map((ch, i) => (
          <span key={i} style={{ color: hl && (i === 1 || i === 2) ? interpolateColor(diff) : C.ink }}>
            {ch}
          </span>
        ))}
        <span style={{ fontSize: 30, color: C.muted, marginLeft: 12 }}>GTQ</span>
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: 19, color: C.muted, marginTop: 14 }}>{src}</div>
    </Panel>
  );
  return (
    <div style={{ position: "absolute", inset: 0, opacity: p, transform: `translateX(${(1 - p) * 60}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26 }}>
        <SevBadge sev="WARNING" />
        <span style={{ fontFamily: FONT.mono, fontSize: 20, color: C.muted }}>VAL-008</span>
        <span style={{ fontSize: 30, fontFamily: FONT.display, fontWeight: 500 }}>{t.findings.spotTitle}</span>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {side(t.findings.buyer, "472,500", `01_AG_Distribucion_GT.csv · ${t.line} 26`, true)}
        {side(t.findings.seller, "427,500", `02_AG_Manufactura_GT.csv · ${t.line} 4 · Mar`, true)}
      </div>
      <div style={{ marginTop: 30, fontSize: 30, opacity: diff, color: C.ink }}>
        <span style={{ color: C.warning, fontFamily: FONT.mono, marginRight: 14 }}>Δ 45,000</span>
        {t.findings.note}
      </div>
    </div>
  );
}

const interpolateColor = (p: number) => (p > 0.5 ? C.warning : C.ink);

export function Fx({ t, duration }: { t: Copy; duration: number }) {
  const rows = [
    { src: `01_AG_Distribucion_GT.csv · ${t.line} 155`, id: "E11a", local: "7.70", group: "7.75", unit: "GTQ / USD" },
    { src: `02_AG_Manufactura_GT.csv · ${t.line} 19`, id: "E11b", local: "7.85", group: "7.75", unit: "GTQ / USD" },
    { src: `05_AG_Espana.csv · ${t.line} 2`, id: "E11c", local: "1,05", group: "1.08", unit: "USD / EUR" },
  ];
  return (
    <Scene duration={duration}>
      <Kicker>{t.fx.kicker}</Kicker>
      <Title size={66}>{t.fx.title}</Title>
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", fontFamily: FONT.mono, fontSize: 20, color: C.muted, letterSpacing: 2, textTransform: "uppercase", padding: "0 34px" }}>
          <span style={{ flex: 1 }} />
          <span style={{ width: 270 }}>{t.fx.file}</span>
          <span style={{ width: 340 }}>{t.fx.group}</span>
        </div>
        {rows.map((r, i) => (
          <FxRow key={r.id} r={r} delay={24 + i * 18} />
        ))}
      </div>
      <Rise delay={150}>
        <div style={{ marginTop: 44, fontFamily: FONT.mono, fontSize: 25, color: C.muted }}>{t.fx.foot}</div>
      </Rise>
    </Scene>
  );
}

function FxRow({ r, delay }: { r: { src: string; id: string; local: string; group: string; unit: string }; delay: number }) {
  const frame = useCurrentFrame();
  const p = useIn(delay);
  const strike = interpolate(frame, [delay + 22, delay + 32], [0, 1], clamp);
  const g = useIn(delay + 30, 14);
  return (
    <Panel style={{ display: "flex", alignItems: "center", padding: "24px 34px", opacity: p, transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 20 }}>
        <SevBadge sev="INFO" />
        <span style={{ fontFamily: FONT.mono, fontSize: 20, color: C.blue }}>{r.id}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 23 }}>{r.src}</span>
      </div>
      <div style={{ width: 270, position: "relative", fontFamily: FONT.mono, fontSize: 44, color: C.muted }}>
        {r.local}
        <div style={{ position: "absolute", left: -6, top: "52%", height: 4, width: `${strike * 120}px`, background: C.blocker }} />
      </div>
      <div style={{ width: 340, fontFamily: FONT.mono, fontSize: 44, fontWeight: 700, color: C.positive, opacity: g, transform: `scale(${0.85 + 0.15 * g})`, transformOrigin: "left" }}>
        {r.group}
        <span style={{ fontSize: 20, color: C.muted, fontWeight: 400, marginLeft: 12 }}>{r.unit}</span>
      </div>
    </Panel>
  );
}
