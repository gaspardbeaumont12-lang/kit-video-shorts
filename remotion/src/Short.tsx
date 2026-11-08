import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { C, Camera, Captions, Flash, Paper, ProgressBar, Scene, SceneShell, TL } from "./kit";
import { SCENES } from "./scenes";

export const Short: React.FC = () => {
  const scenes = TL.scenes as Scene[];
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper, overflow: "hidden" }}>
      <Camera>
        <Paper />
        {scenes.map((s, i) => {
          const Comp = SCENES[s.type];
          const next = scenes[i + 1];
          const exit = next ? next.enter : "none";
          return (
            <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} layout="none">
              <SceneShell scene={s} exit={exit}>{Comp ? <Comp scene={s} /> : null}</SceneShell>
            </Sequence>
          );
        })}
      </Camera>
      <Flash />
      <ProgressBar />
      <Captions />
    </AbsoluteFill>
  );
};
