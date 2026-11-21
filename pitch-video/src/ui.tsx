import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SYMBOL, WORDMARK } from "./brand-paths";
import { C, FONT } from "./theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Spring progress 0→1 starting at `delay` frames into the current sequence. */
export function useIn(delay = 0, damping = 18) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.7 } });
}

/** Rise + fade for an element entering at `delay`. */
export function Rise({
  delay = 0,
  y = 28,
  children,
  style,
}: {
  delay?: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const p = useIn(delay);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
}

/** Scene frame: background, subtle ledger grid, fade in and out at the cut. */
export function Scene({ children, duration, grid = true }: { children: React.ReactNode; duration: number; grid?: boolean }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, duration - 8, duration], [0, 1, 1, 0], clamp);
  const drift = frame * 0.15;
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {grid && (
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`,
            backgroundSize: "96px 96px",
            backgroundPosition: `${drift}px ${drift}px`,
            opacity: 0.35,
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      )}
      <AbsoluteFill style={{ opacity, padding: "110px 140px", fontFamily: FONT.body, color: C.ink }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Kicker({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <Rise delay={delay} y={12}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 24,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: C.blue,
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ width: 36, height: 3, background: C.blue, display: "inline-block" }} />
        {children}
      </div>
    </Rise>
  );
}

export function Title({ children, delay = 4, size = 76 }: { children: React.ReactNode; delay?: number; size?: number }) {
  return (
    <Rise delay={delay}>
      <h1 style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: size, lineHeight: 1.05, margin: 0, letterSpacing: -1.5, maxWidth: 1500 }}>
        {children}
      </h1>
    </Rise>
  );
}

const SEV_COLOR = { BLOCKER: C.blocker, WARNING: C.warning, INFO: C.info } as const;
export function SevBadge({ sev }: { sev: keyof typeof SEV_COLOR }) {
  const c = SEV_COLOR[sev];
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: 1.5,
        color: c,
        border: `1.5px solid ${c}`,
        background: `${c}1f`,
        padding: "4px 10px",
        borderRadius: 6,
      }}
    >
      {sev}
    </span>
  );
}

export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 18,
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Symbol({ size, color = C.ink }: { size: number; color?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" width={size} height={size} fill={color}>
      {SYMBOL.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  );
}

export function Wordmark({ width, color = C.ink }: { width: number; color?: string }) {
  return (
    <svg viewBox="0 0 1299.4 343.9" width={width} height={(width * 343.9) / 1299.4} fill={color}>
      {WORDMARK.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  );
}
