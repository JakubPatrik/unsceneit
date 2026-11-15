import { colorCorrection } from '@remotion/effects/color-correction';
import { zoomBlur } from '@remotion/effects/zoom-blur';
import { Audio, Video } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, Track, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FadeIn, Frame, Leak, ReelCaptions } from './reel-parts';
import { CLAMP, color } from './social-clip/theme';

const SOURCE = 'IMG_0334.mov';
// The recording's audio with rumble and room noise removed, then compressed and
// levelled. The laptop's music is in it too, but very quiet. Regenerate with:
// ffmpeg -i public/IMG_0334.mov -vn -ac 1 -ar 48000 -af "highpass=f=85,afftdn=nf=-32:tn=1,acompressor=threshold=-26dB:ratio=3:attack=8:release=140:makeup=4,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000" -c:a pcm_s16le public/IMG_0334-voice.wav
const VOICE = 'IMG_0334-voice.wav';

/** Punch-in centres. */
const FACE = '48% 35%';
const CENTRE = '50% 45%';
const SCREEN = '50% 45%';
const DIALOG = '55% 56%';
/** "Hidden: Sensual & revealing content", right of centre on the laptop. */
const LABEL = '66% 58%';

/** Above the platforms' 400px of bottom UI, and clear of their right-hand buttons. */
const CAPTIONS = { top: 1320, left: 100 } as const;

const LOOKS = {
	/** Daylight from a window: hold the highlights, keep the skin. */
	face: {
		temperature: -0.03,
		highlights: -0.3,
		whites: -0.15,
		contrast: 1.1,
		saturation: 1.04,
		vibrance: 0.1,
	},
	/** Cuts the window glare lifting the laptop's blacks. */
	screen: {
		temperature: -0.08,
		blacks: -0.2,
		shadows: -0.08,
		highlights: -0.15,
		contrast: 1.12,
		saturation: 1.02,
	},
} as const;

/**
 * The recording, graded. Inside a trimmed <Sequence>, useCurrentFrame() returns
 * the source frame, so `burst` is in source frames too: [start, peak, end] of a
 * radial blur that sells a whip or a reveal.
 */
const Footage: React.FC<{
	readonly look: keyof typeof LOOKS;
	readonly burst?: readonly [number, number, number];
}> = ({ look, burst }) => {
	const frame = useCurrentFrame();
	return (
		<Video
			src={staticFile(SOURCE)}
			muted
			style={{
				position: 'absolute',
				width: 2160,
				height: 3840,
				scale: 0.5,
				translate: '-540px -960px',
			}}
			effects={[
				colorCorrection(LOOKS[look]),
				zoomBlur({
					amount: burst ? interpolate(frame, burst, [0, 45, 0], CLAMP) : 0,
					disabled: !burst || frame < burst[0] || frame > burst[2],
				}),
			]}
		/>
	);
};

const Voice: React.FC = () => <Audio src={staticFile(VOICE)} />;

/** The name and where it works, over the last shot instead of an end card. */
const NamePill: React.FC = () => (
	<FadeIn frames={8}>
		<div
			style={{
				position: 'absolute',
				top: 230,
				left: 0,
				right: 0,
				display: 'flex',
				justifyContent: 'center',
			}}
		>
			<div
				style={{
					padding: '18px 34px',
					borderRadius: 30,
					backgroundColor: 'rgb(9 10 16 / 0.78)',
					textAlign: 'center',
					letterSpacing: '-0.02em',
				}}
			>
				<div style={{ fontSize: 76, fontWeight: 700, color: '#fff' }}>
					unscene<span style={{ color: color.xenia }}>.it</span>
				</div>
				<div style={{ fontSize: 40, fontWeight: 500, opacity: 0.85 }}>
					Free · YouTube in Chrome
				</div>
			</div>
		</div>
	</FadeIn>
);

/**
 * "Gata Only" music video reel, Sensual & revealing content filter. Script:
 * marketing/scripts/founder-story-05.md. Picture and voice stay in sync; the
 * cuts only drop pauses, and the 3.7s wait for the first blur.
 */
export const Social05: React.FC = () => {
	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Track name="Shots">
				{/* Talking head. */}
				<Sequence name="Hook" trimBefore={14} durationInFrames={84}>
					<Frame at={[14, 98]} zoom={[1, 1.05]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Hook captions" style={CAPTIONS} captions={[
						{ text: "You", startMs: 560, endMs: 700, timestampMs: 630, confidence: null },
						{ text: " put", startMs: 700, endMs: 860, timestampMs: 780, confidence: null },
						{ text: " on", startMs: 860, endMs: 1020, timestampMs: 940, confidence: null },
						{ text: " Gata", startMs: 1020, endMs: 1300, timestampMs: 1160, confidence: null },
						{ text: " Only", startMs: 1300, endMs: 1620, timestampMs: 1460, confidence: null },
						{ text: " and", startMs: 1620, endMs: 1920, timestampMs: 1770, confidence: null },
						{ text: " then", startMs: 1920, endMs: 2060, timestampMs: 1990, confidence: null },
						{ text: " your", startMs: 2060, endMs: 2220, timestampMs: 2140, confidence: null },
						{ text: " partner", startMs: 2220, endMs: 2520, timestampMs: 2370, confidence: null },
						{ text: " walks", startMs: 2520, endMs: 2820, timestampMs: 2670, confidence: null },
						{ text: " in", startMs: 2820, endMs: 3267, timestampMs: 3040, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Certain scenes" from={84} trimBefore={109} durationInFrames={17}>
					<Frame at={[109, 126]} zoom={[1.22, 1.25]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Certain scenes captions" style={CAPTIONS} captions={[
						{ text: "There", startMs: 3633, endMs: 3740, timestampMs: 3690, confidence: null },
						{ text: " are", startMs: 3740, endMs: 3880, timestampMs: 3810, confidence: null },
						{ text: " certain", startMs: 3880, endMs: 4200, timestampMs: 4040, confidence: null },
					]} />
				</Sequence>
				{/* The real phone whip, pushed with a blur burst. */}
				<Sequence name="Into whip" from={101} trimBefore={126} durationInFrames={12}>
					<Frame at={[126, 138]} zoom={[1.25, 1.34]} origin={CENTRE}>
						<Footage look="face" burst={[126, 138, 150]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Into whip captions" style={CAPTIONS} captions={[
						{ text: "scenes", startMs: 4200, endMs: 4420, timestampMs: 4310, confidence: null },
						{ text: " that", startMs: 4420, endMs: 4600, timestampMs: 4510, confidence: null },
					]} />
				</Sequence>
				{/* The demo. */}
				<Sequence name="Whip lands" from={113} trimBefore={138} durationInFrames={18}>
					<Frame at={[138, 156]} zoom={[1.2, 1.04]} origin={SCREEN} snap>
						<Footage look="screen" burst={[126, 138, 150]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Whip lands captions" style={CAPTIONS} captions={[
						{ text: "you", startMs: 4620, endMs: 4720, timestampMs: 4670, confidence: null },
						{ text: " would", startMs: 4720, endMs: 4840, timestampMs: 4780, confidence: null },
						{ text: " rather", startMs: 4840, endMs: 5060, timestampMs: 4950, confidence: null },
						{ text: " not", startMs: 5060, endMs: 5200, timestampMs: 5130, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Blurs them for you" from={131} trimBefore={156} durationInFrames={94}>
					<Frame at={[156, 250]} zoom={[1.08, 1.22]} origin={DIALOG}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Blurs them for you captions" style={CAPTIONS} captions={[
						{ text: "see", startMs: 5200, endMs: 5560, timestampMs: 5380, confidence: null },
						{ text: ", so", startMs: 5900, endMs: 6000, timestampMs: 5950, confidence: null },
						{ text: " I", startMs: 6000, endMs: 6100, timestampMs: 6050, confidence: null },
						{ text: " built", startMs: 6100, endMs: 6260, timestampMs: 6180, confidence: null },
						{ text: " an", startMs: 6260, endMs: 6460, timestampMs: 6360, confidence: null },
						{ text: " extension", startMs: 6460, endMs: 6840, timestampMs: 6650, confidence: null },
						{ text: " that", startMs: 6840, endMs: 7320, timestampMs: 7080, confidence: null },
						{ text: " blurs", startMs: 7320, endMs: 7560, timestampMs: 7440, confidence: null },
						{ text: " them", startMs: 7560, endMs: 7760, timestampMs: 7660, confidence: null },
						{ text: " for", startMs: 7760, endMs: 7960, timestampMs: 7860, confidence: null },
						{ text: " you", startMs: 7960, endMs: 8333, timestampMs: 8150, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Select the filter" from={225} trimBefore={262} durationInFrames={31}>
					<Frame at={[262, 293]} zoom={[1.3, 1.36]} origin={DIALOG}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Select the filter captions" style={CAPTIONS} captions={[
						{ text: "Select", startMs: 8820, endMs: 9020, timestampMs: 8920, confidence: null },
						{ text: " the", startMs: 9020, endMs: 9240, timestampMs: 9130, confidence: null },
						{ text: " filter", startMs: 9240, endMs: 9767, timestampMs: 9500, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Watch with filters" from={256} trimBefore={303} durationInFrames={39}>
					<Frame at={[303, 342]} zoom={[1.02, 1.06]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Watch with filters captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 10100, endMs: 10280, timestampMs: 10190, confidence: null },
						{ text: " watch", startMs: 10280, endMs: 10500, timestampMs: 10390, confidence: null },
						{ text: " it", startMs: 10500, endMs: 10620, timestampMs: 10560, confidence: null },
						{ text: " with", startMs: 10620, endMs: 10740, timestampMs: 10680, confidence: null },
						{ text: " filters", startMs: 10740, endMs: 11400, timestampMs: 11070, confidence: null },
					]} />
				</Sequence>
				{/* Jumps 3.7s of the video, to just before the first blur. */}
				<Sequence name="Revealing shots" from={295} trimBefore={452} durationInFrames={40}>
					<Frame at={[452, 492]} zoom={[1.06, 1.12]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Revealing shots captions" style={CAPTIONS} captions={[
						{ text: "The", startMs: 15120, endMs: 15640, timestampMs: 15380, confidence: null },
						{ text: " revealing", startMs: 15640, endMs: 15980, timestampMs: 15810, confidence: null },
						{ text: " shots", startMs: 15980, endMs: 16400, timestampMs: 16190, confidence: null },
					]} />
				</Sequence>
				{/* The extension's blur fades in at 16.4s: punch in on its label. */}
				<Sequence name="Blur hits" from={335} trimBefore={492} durationInFrames={63}>
					<Frame at={[492, 508]} zoom={[1.1, 1.4]} origin={LABEL} snap>
						<Footage look="screen" burst={[492, 496, 506]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Blur hits captions" style={CAPTIONS} captions={[
						{ text: "blur", startMs: 16400, endMs: 16640, timestampMs: 16520, confidence: null },
						{ text: " and", startMs: 16640, endMs: 17380, timestampMs: 17010, confidence: null },
						{ text: " the", startMs: 17380, endMs: 17540, timestampMs: 17460, confidence: null },
						{ text: " song", startMs: 17540, endMs: 17680, timestampMs: 17610, confidence: null },
						{ text: " never", startMs: 17680, endMs: 17940, timestampMs: 17810, confidence: null },
						{ text: " stops", startMs: 17940, endMs: 18500, timestampMs: 18220, confidence: null },
					]} />
				</Sequence>
				<Sequence name="It's called" from={398} trimBefore={572} durationInFrames={37}>
					<Frame at={[572, 609]} zoom={[1.4, 1.44]} origin={LABEL}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="It's called captions" style={CAPTIONS} captions={[
						{ text: "It's", startMs: 19160, endMs: 19420, timestampMs: 19290, confidence: null },
						{ text: " called", startMs: 19420, endMs: 19680, timestampMs: 19550, confidence: null },
						{ text: " unscene.it", startMs: 19680, endMs: 20300, timestampMs: 19990, confidence: null },
					]} />
				</Sequence>
				{/* The blur lifted at 20.4s: the video plays on. */}
				<Sequence name="Grab it free" from={435} trimBefore={622} durationInFrames={76}>
					<Frame at={[622, 698]} zoom={[1.02, 1.08]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Grab it free captions" style={CAPTIONS} captions={[
						{ text: "Grab", startMs: 20840, endMs: 21100, timestampMs: 20970, confidence: null },
						{ text: " it", startMs: 21100, endMs: 21260, timestampMs: 21180, confidence: null },
						{ text: " free", startMs: 21260, endMs: 21540, timestampMs: 21400, confidence: null },
						{ text: " from", startMs: 21540, endMs: 21760, timestampMs: 21650, confidence: null },
						{ text: " the", startMs: 21760, endMs: 21940, timestampMs: 21850, confidence: null },
						{ text: " Chrome", startMs: 21940, endMs: 22120, timestampMs: 22030, confidence: null },
						{ text: " Web", startMs: 22120, endMs: 22300, timestampMs: 22210, confidence: null },
						{ text: " Store", startMs: 22300, endMs: 22580, timestampMs: 22440, confidence: null },
						{ text: " today", startMs: 22580, endMs: 23267, timestampMs: 22920, confidence: null },
					]} />
				</Sequence>
			</Track>

			{/* Darkens the corners, and with them the glare and the laptop's bezel. */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 78% 62% at 50% 46%, transparent 55%, rgb(0 0 0 / 0.42) 100%)',
				}}
			/>

			<Track name="Name">
				<Sequence name="Name over the last shot" from={445} durationInFrames={66}>
					<NamePill />
				</Sequence>
			</Track>

			<Track name="Light leaks">
				<Sequence name="Leak on whip" from={105} durationInFrames={40}>
					<Leak duration={40} seed={3} />
				</Sequence>
			</Track>

			<Track name="Sound effects">
				<Audio name="Whip" src="https://remotion.media/whoosh.wav" from={100} volume={0.4} />
				<Audio name="Blur hits" src="https://remotion.media/whip.wav" from={335} volume={0.35} />
				<Audio name="Name" src="https://remotion.media/ding.wav" from={445} volume={0.2} />
			</Track>
		</AbsoluteFill>
	);
};
