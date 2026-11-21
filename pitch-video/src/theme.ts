import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Brand tokens from app/globals.css (dark marketing palette).
export const C = {
  bg: "#161b1a",
  panel: "#1e2523",
  panel2: "#252d2b",
  line: "rgba(230,221,208,0.12)",
  ink: "#e6ddd0",
  muted: "rgba(230,221,208,0.58)",
  blue: "#5562ec",
  blueSoft: "rgba(85,98,236,0.16)",
  blocker: "#ef6a5b",
  warning: "#e3a53c",
  info: "#7f8cf2",
  positive: "#45b07f",
};

export const FONT = {
  display: "Excon, sans-serif",
  body: "Synonym, sans-serif",
  mono: "'JetBrains Mono', Consolas, 'Courier New', monospace",
};

for (const [family, file, weight] of [
  ["Excon", "Excon-500.woff2", "500"],
  ["Excon", "Excon-700.woff2", "700"],
  ["Synonym", "Synonym-400.woff2", "400"],
  ["Synonym", "Synonym-500.woff2", "500"],
] as const) {
  loadFont({ family, url: staticFile(`fonts/${file}`), weight });
}

// Music is 100 BPM in 4/4: one bar = 2.4 s = 72 frames at 30 fps. Scenes start on bar lines.
export const FPS = 30;
export const BAR = 72;
export const TIMELINE = {
  hook: [0, 3],
  chaos: [3, 6],
  reveal: [6, 8],
  pipeline: [8, 12],
  findings: [12, 16],
  fx: [16, 19],
  elim: [19, 22],
  inspector: [22, 26],
  confidence: [26, 29],
  close: [29, 32],
} as const;
export const TOTAL_FRAMES = 32 * BAR;
