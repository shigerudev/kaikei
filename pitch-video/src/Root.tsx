import React from "react";
import { Composition } from "remotion";
import { Pitch } from "./Pitch";
import { FPS, TOTAL_FRAMES } from "./theme";

export function Root() {
  return (
    <>
      <Composition id="PitchEN" component={Pitch} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ lang: "en" as const }} />
      <Composition id="PitchES" component={Pitch} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ lang: "es" as const }} />
    </>
  );
}
