import { Composition } from "remotion";
import { DecideEatsOpening, openingConfig } from "./opening-animation";

export const RemotionRoot = () => {
  return (
    <Composition
      id="DecideEatsOpening"
      component={DecideEatsOpening}
      durationInFrames={openingConfig.durationInFrames}
      fps={openingConfig.fps}
      width={openingConfig.width}
      height={openingConfig.height}
    />
  );
};
