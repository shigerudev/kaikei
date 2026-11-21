import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COPY, Lang } from "./copy";
import { Chaos, Hook, Reveal } from "./scenes/Intro";
import { Findings, Fx, Pipeline } from "./scenes/Engine";
import { Close, Confidence, Elimination, Inspector } from "./scenes/Trust";
import { BAR, C, TIMELINE, TOTAL_FRAMES } from "./theme";

export type PitchProps = { lang: Lang };

export function Pitch({ lang }: PitchProps) {
  const t = COPY[lang];
  const frame = useCurrentFrame();
  const scenes: [keyof typeof TIMELINE, React.FC<{ t: typeof t; lang: Lang; duration: number }>][] = [
    ["hook", Hook],
    ["chaos", Chaos],
    ["reveal", Reveal],
    ["pipeline", Pipeline],
    ["findings", Findings],
    ["fx", Fx],
    ["elim", Elimination],
    ["inspector", Inspector],
    ["confidence", Confidence],
    ["close", Close],
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Audio
        src={staticFile("music.wav")}
        volume={(f) => interpolate(f, [0, 10, TOTAL_FRAMES - 10, TOTAL_FRAMES], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
      {scenes.map(([key, Comp]) => {
        const [a, b] = TIMELINE[key];
        const duration = (b - a) * BAR;
        return (
          <Sequence key={key} from={a * BAR} durationInFrames={duration} name={key}>
            <Comp t={t} lang={lang} duration={duration} />
          </Sequence>
        );
      })}
      <ProgressBar frame={frame} />
    </AbsoluteFill>
  );
}

function ProgressBar({ frame }: { frame: number }) {
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${(frame / TOTAL_FRAMES) * 100}%`, background: C.blue, opacity: 0.6 }} />;
}
