import { Social01 } from "./Social01";
import { Social02 } from "./Social02";
import { Composition, Folder } from "remotion";
import { SocialClip } from "./social-clip/SocialClip";
import { FPS, HEIGHT, WIDTH, clipFrames, creatives } from "./social-clip/content";

/** One composition per creative in marketing/pipeline/content/creatives.json. */
export const RemotionRoot: React.FC = () => {
  return (
    <>
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
        <Composition
          id="social-01"
          component={Social01}
          durationInFrames={965}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="social-02"
          component={Social02}
          durationInFrames={770}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>
    </>
  );
};
