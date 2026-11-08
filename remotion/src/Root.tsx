import React from "react";
import { Composition } from "remotion";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "@fontsource/permanent-marker/400.css";
import { TL } from "./kit";
import { Short } from "./Short";

export const RemotionRoot: React.FC = () => (
  <Composition id="Short" component={Short} durationInFrames={TL.durationInFrames} fps={TL.fps} width={1080} height={1920} />
);
