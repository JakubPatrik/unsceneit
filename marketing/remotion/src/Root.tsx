import { Composition, Folder } from "remotion";
import { SocialClip } from "./social-clip/SocialClip";
import { FPS, HEIGHT, WIDTH, clipFrames, creatives } from "./social-clip/content";

/** One composition per creative in marketing/pipeline/content/creatives.json. */
export const RemotionRoot: React.FC = () => {
  return (
    <Folder name="social">
      {creatives.map((creative) => (
        <Composition
          key={creative.id}
          id={creative.id}
          component={SocialClip}
          durationInFrames={clipFrames(creative)}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ creative }}
        />
      ))}
    </Folder>
  );
};
