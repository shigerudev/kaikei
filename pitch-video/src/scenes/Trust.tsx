import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Copy } from "../copy";
import { C, FONT } from "../theme";
import { Kicker, Panel, Rise, Scene, SevBadge, Symbol, Title, Wordmark, clamp, useIn } from "../ui";

function Entity({ name, ccy, delay }: { name: string; ccy: string; delay: number }) {
  const p = useIn(delay);
  return (
    <Panel style={{ padding: "26px 34px", opacity: p, transform: `scale(${0.9 + 0.1 * p})`, minWidth: 300 }}>
      <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 38 }}>{name}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: 20, color: C.muted, marginTop: 6 }}>{ccy}</div>
    </Panel>
  );
}

export function Elimination({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const arrow = interpolate(frame, [30, 56], [0, 1], clamp);
  const j = useIn(66);
  const dr = useIn(80);
  const cr = useIn(92);
  const ok = useIn(112, 10);
  const e08 = useIn(150);
  return (
    <Scene duration={duration}>
      <Kicker>{t.elim.kicker}</Kicker>
      <Title size={68}>{t.elim.title}</Title>
      <div style={{ display: "flex", gap: 70, marginTop: 64, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 640px", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <Entity name="AG Holding" ccy="EMP6 · USD" delay={12} />
          <div style={{ position: "relative", height: 130, width: "100%" }}>
            <div style={{ position: "absolute", left: 60, top: 0, width: 4, height: `${arrow * 100}%`, background: C.blue }} />
            <div style={{ position: "absolute", left: 51, top: `calc(${arrow * 100}% - 14px)`, width: 0, height: 0, borderLeft: "11px solid transparent", borderRight: "11px solid transparent", borderTop: `16px solid ${C.blue}`, opacity: arrow }} />
            <div style={{ position: "absolute", left: 100, top: 48, fontFamily: FONT.mono, fontSize: 22, color: C.ink, opacity: arrow, whiteSpace: "nowrap" }}>
              {t.elim.flow}
            </div>
          </div>
          <Entity name="AG Panamá" ccy="EMP4 · USD" delay={22} />
        </div>
        <Panel style={{ flex: 1, padding: "30px 36px", opacity: j, transform: `translateY(${(1 - j) * 30}px)` }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 20, color: C.muted, letterSpacing: 2, textTransform: "uppercase" }}>{t.elim.journal}</div>
          {[
            [t.elim.dr, "15,000.00", "", dr],
            [t.elim.cr, "", "15,000.00", cr],
          ].map(([label, d, c, p]) => (
            <div
              key={label as string}
              style={{ display: "flex", fontFamily: FONT.mono, fontSize: 26, padding: "18px 0", borderBottom: `1px solid ${C.line}`, opacity: p as number }}
            >
              <span style={{ flex: 1 }}>{label}</span>
              <span style={{ width: 170, textAlign: "right" }}>{d}</span>
              <span style={{ width: 170, textAlign: "right" }}>{c}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22, opacity: ok, transform: `scale(${0.9 + 0.1 * ok})`, transformOrigin: "left" }}>
            <span style={{ width: 38, height: 38, borderRadius: 19, background: C.positive, color: C.bg, display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 28, color: C.positive, fontWeight: 500 }}>{t.elim.balanced}</span>
            <span style={{ fontFamily: FONT.mono, fontSize: 22, color: C.muted, marginLeft: "auto" }}>Σ Dr = Σ Cr</span>
          </div>
        </Panel>
      </div>
      <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 18, opacity: e08, transform: `translateY(${(1 - e08) * 20}px)` }}>
        <SevBadge sev="WARNING" />
        <span style={{ fontSize: 30 }}>{t.elim.e08}</span>
      </div>
    </Scene>
  );
}

export function Inspector({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const n = t.inspector.chain.length;
  const sheet = useIn(40 + n * 22);
  const naive = useIn(60 + n * 22 + 30);
  return (
    <Scene duration={duration}>
      <Kicker>{t.inspector.kicker}</Kicker>
      <Title size={70}>{t.inspector.title}</Title>
      <div style={{ display: "flex", gap: 80, marginTop: 56 }}>
        <div style={{ flex: "0 0 720px", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 21,
              top: 24,
              width: 3,
              height: interpolate(frame, [30, 30 + (n - 1) * 22], [0, (n - 1) * 104], clamp),
              background: C.blue,
            }}
          />
          {t.inspector.chain.map(([a, b], i) => {
            const p = useIn(26 + i * 22, 15);
            const last = i === n - 1;
            return (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: 30, height: 104, opacity: p, transform: `translateX(${(1 - p) * 30}px)` }}>
                <span style={{ width: 45, height: 45, borderRadius: 23, border: `3px solid ${last ? C.positive : C.blue}`, background: last ? C.positive : C.bg, flexShrink: 0, zIndex: 1 }} />
                <div>
                  <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 34, color: last ? C.positive : C.ink }}>{a}</div>
                  <div style={{ fontFamily: FONT.mono, fontSize: 21, color: C.muted, marginTop: 4 }}>{b}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, opacity: sheet, transform: `translateY(${(1 - sheet) * 30}px)` }}>
          <Panel style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", fontFamily: FONT.mono, fontSize: 19, color: C.muted, borderBottom: `1px solid ${C.line}` }}>05_AG_Espana.csv</div>
            {[
              ["79", "2027;9", "621", "Arrendamientos y cánones", "17.100,00"],
              ["80", "2027;9", "627", "Publicidad y propaganda", "11400.00"],
              ["81", "2027;9", "681", "Amortización del inmov.", "9.500,00"],
            ].map((row) => {
              const hl = row[0] === "80";
              return (
                <div key={row[0]} style={{ display: "flex", fontFamily: FONT.mono, fontSize: 22, padding: "16px 24px", background: hl ? C.blueSoft : "transparent", borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ width: 56, color: C.muted }}>{row[0]}</span>
                  <span style={{ width: 110, color: hl ? C.ink : C.muted }}>{row[1]}</span>
                  <span style={{ width: 70, color: hl ? C.ink : C.muted }}>{row[2]}</span>
                  <span style={{ flex: 1, color: hl ? C.ink : C.muted }}>{row[3]}</span>
                  <span style={{ color: hl ? C.ink : C.muted, outline: hl ? `3px solid ${C.blue}` : "none", outlineOffset: 6, borderRadius: 2 }}>{row[4]}</span>
                </div>
              );
            })}
          </Panel>
          <div style={{ marginTop: 18, fontFamily: FONT.mono, fontSize: 20, color: C.blue, textAlign: "right" }}>↑ {t.inspector.raw}</div>
          <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 16, opacity: naive }}>
            <SevBadge sev="WARNING" />
            <span style={{ fontSize: 28 }}>{t.inspector.naive}</span>
          </div>
        </div>
      </div>
    </Scene>
  );
}

const FINGERPRINT = "9c41e07b · 5af2d813 · 0e6b77c4";

export function Confidence({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const typed = (s: string, from: number, cps = 2.2) => s.slice(0, Math.max(0, Math.floor((frame - from) * cps)));
  const same = useIn(70, 12);
  const pub = useIn(84, 10);
  const q = useIn(56);
  const answerFrom = 96;
  const foot = useIn(170);
  return (
    <Scene duration={duration}>
      <Kicker>{t.confidence.kicker}</Kicker>
      <Title size={70}>{t.confidence.title}</Title>
      <div style={{ display: "flex", gap: 60, marginTop: 50 }}>
        <div style={{ flex: "0 0 640px", display: "flex", flexDirection: "column", gap: 20 }}>
          {[0, 1].map((k) => (
            <Rise key={k} delay={14 + k * 18}>
              <Panel style={{ padding: "22px 28px", borderColor: same > 0.5 ? C.positive : C.line }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: 20, color: C.muted }}>
                  <span>{`${t.confidence.run} #${41 + k}`}</span>
                  <span>{k === 0 ? "2026-11-21 09:12" : "2026-11-21 09:47"}</span>
                </div>
                <div style={{ fontFamily: FONT.mono, fontSize: 30, marginTop: 10 }}>{typed(FINGERPRINT, 20 + k * 18, 1.4)}</div>
              </Panel>
            </Rise>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8, opacity: same }}>
            <span style={{ width: 36, height: 36, borderRadius: 18, background: C.positive, color: C.bg, display: "grid", placeItems: "center", fontSize: 24, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 28, color: C.positive }}>{t.confidence.identical}</span>
            <span
              style={{
                marginLeft: "auto",
                opacity: pub,
                transform: `scale(${0.8 + 0.2 * pub})`,
                fontFamily: FONT.mono,
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: 2,
                color: C.positive,
                border: `2px solid ${C.positive}`,
                padding: "6px 14px",
                borderRadius: 8,
              }}
            >
              {t.confidence.published}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Rise delay={44}>
            <div style={{ fontFamily: FONT.display, fontWeight: 500, fontSize: 34, marginBottom: 22 }}>{t.confidence.mcpTitle}</div>
          </Rise>
          <div style={{ opacity: q, transform: `translateY(${(1 - q) * 20}px)`, marginLeft: "auto", maxWidth: 720, background: C.panel2, borderRadius: "22px 22px 6px 22px", padding: "20px 26px", fontSize: 26 }}>
            {t.confidence.q}
          </div>
          <div style={{ marginTop: 18, maxWidth: 820, minHeight: 150, background: C.blueSoft, border: `1px solid ${C.blue}55`, borderRadius: "22px 22px 22px 6px", padding: "20px 26px", fontSize: 26, lineHeight: 1.4, opacity: frame > answerFrom ? 1 : 0 }}>
            {typed(t.confidence.a, answerFrom, 2.6)}
          </div>
          <div style={{ marginTop: 20, fontFamily: FONT.mono, fontSize: 19, color: C.muted, opacity: foot }}>{t.confidence.mcp}</div>
        </div>
      </div>
    </Scene>
  );
}

export function Close({ t, duration }: { t: Copy; duration: number }) {
  const frame = useCurrentFrame();
  const logo = useIn(4, 14);
  const line = useIn(26);
  const sub = useIn(50);
  const out = interpolate(frame, [duration - 40, duration], [1, 0], clamp);
  return (
    <Scene duration={duration} grid={false}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40, opacity: logo, transform: `scale(${0.85 + 0.15 * logo})` }}>
          <Symbol size={150} color={C.blue} />
          <Wordmark width={430} />
        </div>
        <div style={{ marginTop: 60, fontFamily: FONT.display, fontWeight: 700, fontSize: 60, textAlign: "center", maxWidth: 1400, lineHeight: 1.15, opacity: line, transform: `translateY(${(1 - line) * 20}px)` }}>
          {t.close.line}
        </div>
        <div style={{ marginTop: 30, fontSize: 30, color: C.muted, opacity: sub }}>{t.close.sub}</div>
      </AbsoluteFill>
    </Scene>
  );
}
