import { colorCorrection } from '@remotion/effects/color-correction';
import { zoomBlur } from '@remotion/effects/zoom-blur';
import { Audio, Video } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, Track, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FadeIn, Frame, Leak, ReelCaptions } from './reel-parts';
import { EndCard } from './social-clip/SocialClip';
import { CLAMP } from './social-clip/theme';

const SOURCE = 'IMG_0304.MOV';
// The recording's audio with rumble and room noise removed, then compressed and
// levelled. Regenerate with:
// ffmpeg -i public/IMG_0304.MOV -vn -ac 1 -ar 48000 -af "highpass=f=85,afftdn=nf=-32:tn=1,acompressor=threshold=-26dB:ratio=3:attack=8:release=140:makeup=4,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000" -c:a pcm_s16le public/IMG_0304-voice.wav
const VOICE = 'IMG_0304-voice.wav';

/** Punch-in centres. A low origin pushes the dialog up, clear of the captions. */
const FACE = '46% 38%';
const SCREEN = '50% 45%';
const THUMBS = '40% 45%';
const DIALOG = '45% 75%';
const PILL = '54% 52%';

/** Above the platforms' 400px of bottom UI, and clear of their right-hand buttons. */
const CAPTIONS = { top: 1320, left: 100 } as const;

const LOOKS = {
	/** A dim room lit by warm lamps: hold the highlights, keep the skin. */
	face: {
		highlights: -0.2,
		shadows: 0.06,
		contrast: 1.06,
		saturation: 1.04,
		vibrance: 0.08,
	},
	/** Cuts the glare lifting the laptop's blacks, and neutralises its warm cast. */
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

/** Arachnophobia reel on the "You're Aragog" clip. Script: marketing/scripts/founder-story-02.md. */
export const Social02: React.FC = () => {
	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Track name="Shots">
				{/* Talking head, alternating wide and tight. */}
				<Sequence name="Hook" durationInFrames={76}>
					<Frame at={[0, 76]} zoom={[1, 1.05]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Hook captions" style={CAPTIONS} captions={[
						{ text: "The", startMs: 0, endMs: 160, timestampMs: 80, confidence: null },
						{ text: " scary", startMs: 160, endMs: 440, timestampMs: 300, confidence: null },
						{ text: " scene", startMs: 440, endMs: 760, timestampMs: 600, confidence: null },
						{ text: " in", startMs: 760, endMs: 920, timestampMs: 840, confidence: null },
						{ text: " Harry", startMs: 920, endMs: 1080, timestampMs: 1000, confidence: null },
						{ text: " Potter", startMs: 1080, endMs: 1360, timestampMs: 1220, confidence: null },
						{ text: " if", startMs: 1360, endMs: 1660, timestampMs: 1510, confidence: null },
						{ text: " you", startMs: 1660, endMs: 1760, timestampMs: 1710, confidence: null },
						{ text: " hate", startMs: 1760, endMs: 1860, timestampMs: 1810, confidence: null },
						{ text: " spiders", startMs: 1860, endMs: 2533, timestampMs: 2197, confidence: null },
					]} />
				</Sequence>
				<Sequence name="So I built" from={76} trimBefore={76} durationInFrames={44}>
					<Frame at={[76, 120]} zoom={[1.22, 1.26]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="So I built captions" style={CAPTIONS} captions={[
						{ text: "so", startMs: 2590, endMs: 2940, timestampMs: 2765, confidence: null },
						{ text: " I", startMs: 2940, endMs: 3060, timestampMs: 3000, confidence: null },
						{ text: " built", startMs: 3060, endMs: 3220, timestampMs: 3140, confidence: null },
						{ text: " an", startMs: 3220, endMs: 3340, timestampMs: 3280, confidence: null },
						{ text: " extension", startMs: 3340, endMs: 3720, timestampMs: 3530, confidence: null },
						{ text: " that", startMs: 3720, endMs: 4000, timestampMs: 3860, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Into whip" from={120} trimBefore={120} durationInFrames={12}>
					<Frame at={[120, 132]} zoom={[1.26, 1.34]} origin={FACE}>
						<Footage look="face" burst={[120, 132, 146]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Into whip captions" style={CAPTIONS} captions={[
						{ text: "blurs", startMs: 4180, endMs: 4400, timestampMs: 4290, confidence: null },
					]} />
				</Sequence>
				{/* The demo. */}
				<Sequence name="Whip lands" from={132} trimBefore={132} durationInFrames={19}>
					<Frame at={[132, 146]} zoom={[1.2, 1.02]} origin={SCREEN} snap>
						<Footage look="screen" burst={[120, 132, 146]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Whip lands captions" style={CAPTIONS} captions={[
						{ text: "them", startMs: 4420, endMs: 4600, timestampMs: 4510, confidence: null },
						{ text: " for", startMs: 4600, endMs: 4800, timestampMs: 4700, confidence: null },
						{ text: " you", startMs: 4800, endMs: 5033, timestampMs: 4917, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Blurred thumbnails" from={151} trimBefore={167} durationInFrames={83}>
					<Frame at={[167, 250]} zoom={[1.04, 1.16]} origin={THUMBS}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Blurred thumbnails captions" style={CAPTIONS} captions={[
						{ text: "Even", startMs: 5580, endMs: 5740, timestampMs: 5660, confidence: null },
						{ text: " the", startMs: 5740, endMs: 5920, timestampMs: 5830, confidence: null },
						{ text: " thumbnails", startMs: 5920, endMs: 6320, timestampMs: 6120, confidence: null },
						{ text: " come", startMs: 6320, endMs: 6820, timestampMs: 6570, confidence: null },
						{ text: " blurred", startMs: 6820, endMs: 7060, timestampMs: 6940, confidence: null },
						{ text: " so", startMs: 7060, endMs: 7420, timestampMs: 7240, confidence: null },
						{ text: " nothing", startMs: 7420, endMs: 7660, timestampMs: 7540, confidence: null },
						{ text: " jumps", startMs: 7660, endMs: 7940, timestampMs: 7800, confidence: null },
						{ text: " at", startMs: 7940, endMs: 8160, timestampMs: 8050, confidence: null },
						{ text: " you", startMs: 8160, endMs: 8333, timestampMs: 8247, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Press play" from={234} trimBefore={260} durationInFrames={21}>
					<Frame at={[260, 281]} zoom={[1.1, 1.2]} origin={DIALOG}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Press play captions" style={CAPTIONS} captions={[
						{ text: "Press", startMs: 8680, endMs: 8960, timestampMs: 8820, confidence: null },
						{ text: " play", startMs: 8960, endMs: 9367, timestampMs: 9163, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Spider filter" from={255} trimBefore={297} durationInFrames={37}>
					<Frame at={[297, 309]} zoom={[1.3, 1.5]} origin={DIALOG} snap>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Spider filter captions" style={CAPTIONS} captions={[
						{ text: "select", startMs: 9900, endMs: 10120, timestampMs: 10010, confidence: null },
						{ text: " the", startMs: 10120, endMs: 10340, timestampMs: 10230, confidence: null },
						{ text: " spider", startMs: 10340, endMs: 10580, timestampMs: 10460, confidence: null },
						{ text: " filter", startMs: 10580, endMs: 11133, timestampMs: 10857, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Watch with filters" from={292} trimBefore={348} durationInFrames={41}>
					<Frame at={[348, 389]} zoom={[1.5, 1.56]} origin={DIALOG}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Watch with filters captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 11600, endMs: 11780, timestampMs: 11690, confidence: null },
						{ text: " watch", startMs: 11780, endMs: 12340, timestampMs: 12060, confidence: null },
						{ text: " with", startMs: 12340, endMs: 12700, timestampMs: 12520, confidence: null },
						{ text: " them", startMs: 12700, endMs: 12967, timestampMs: 12833, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Spiders get blurred" from={333} trimBefore={401} durationInFrames={87}>
					<Frame at={[401, 420]} zoom={[1.1, 1.36]} origin={PILL} snap>
						<Footage look="screen" burst={[401, 405, 415]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Spiders get blurred captions" style={CAPTIONS} captions={[
						{ text: "The", startMs: 13600, endMs: 13800, timestampMs: 13700, confidence: null },
						{ text: " spiders", startMs: 13800, endMs: 14060, timestampMs: 13930, confidence: null },
						{ text: " get", startMs: 14060, endMs: 14300, timestampMs: 14180, confidence: null },
						{ text: " blurred", startMs: 14300, endMs: 15050, timestampMs: 14675, confidence: null },
						{ text: " and", startMs: 15050, endMs: 15400, timestampMs: 15225, confidence: null },
						{ text: " the", startMs: 15400, endMs: 15520, timestampMs: 15460, confidence: null },
						{ text: " movie", startMs: 15520, endMs: 15700, timestampMs: 15610, confidence: null },
						{ text: " keeps", startMs: 15700, endMs: 15880, timestampMs: 15790, confidence: null },
						{ text: " playing", startMs: 15880, endMs: 16267, timestampMs: 16073, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Spiders only" from={420} trimBefore={488} durationInFrames={83}>
					<Frame at={[488, 571]} zoom={[1, 1.06]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Spiders only captions" style={CAPTIONS} captions={[
						{ text: "Right", startMs: 17040, endMs: 17280, timestampMs: 17160, confidence: null },
						{ text: " now", startMs: 17280, endMs: 17500, timestampMs: 17390, confidence: null },
						{ text: " it", startMs: 17500, endMs: 17720, timestampMs: 17610, confidence: null },
						{ text: " covers", startMs: 17720, endMs: 18120, timestampMs: 17920, confidence: null },
						{ text: " spiders", startMs: 18120, endMs: 18520, timestampMs: 18320, confidence: null },
						{ text: " only", startMs: 18520, endMs: 19033, timestampMs: 18777, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Comment a phobia" from={503} trimBefore={590} durationInFrames={29}>
					<Frame at={[590, 619]} zoom={[1.12, 1.16]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Comment a phobia captions" style={CAPTIONS} captions={[
						{ text: "Comment", startMs: 19840, endMs: 19900, timestampMs: 19870, confidence: null },
						{ text: " phobia", startMs: 19900, endMs: 20633, timestampMs: 20267, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Free, unscene.it" from={532} trimBefore={634} durationInFrames={92}>
					<Frame at={[634, 726]} zoom={[1.22, 1.28]} origin={PILL}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Free, unscene.it captions" style={CAPTIONS} captions={[
						{ text: "I", startMs: 21133, endMs: 21240, timestampMs: 21187, confidence: null },
						{ text: " should", startMs: 21240, endMs: 21400, timestampMs: 21320, confidence: null },
						{ text: " add", startMs: 21400, endMs: 21560, timestampMs: 21480, confidence: null },
						{ text: " next", startMs: 21560, endMs: 22480, timestampMs: 22020, confidence: null },
						{ text: " It's", startMs: 22480, endMs: 22860, timestampMs: 22670, confidence: null },
						{ text: " free", startMs: 22860, endMs: 23460, timestampMs: 23160, confidence: null },
						{ text: " it's", startMs: 23460, endMs: 23580, timestampMs: 23520, confidence: null },
						{ text: " called", startMs: 23580, endMs: 23760, timestampMs: 23670, confidence: null },
						{ text: " unscene.it", startMs: 23760, endMs: 24200, timestampMs: 23980, confidence: null },
					]} />
				</Sequence>
				{/* Silent here: "and works on YouTube in Chrome" plays over it from the Lifted voice track. */}
				<Sequence name="Film comes back" from={624} trimBefore={866} durationInFrames={62}>
					<Frame at={[866, 928]} zoom={[1.02, 1.1]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
				</Sequence>
			</Track>

			{/* Darkens the corners, and with them the glare and the laptop's bezel. */}
			<AbsoluteFill
				style={{
					background:
						'radial-gradient(ellipse 78% 62% at 50% 46%, transparent 55%, rgb(0 0 0 / 0.42) 100%)',
				}}
			/>

			{/* The last line plays over the film coming back, instead of a silent tail. */}
			<Track name="Lifted voice">
				<Sequence name="Works on YouTube" from={624} trimBefore={726} durationInFrames={62}>
					<Voice />
					<ReelCaptions name="Works on YouTube captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 24200, endMs: 24720, timestampMs: 24460, confidence: null },
						{ text: " works", startMs: 24720, endMs: 24940, timestampMs: 24830, confidence: null },
						{ text: " on", startMs: 24940, endMs: 25140, timestampMs: 25040, confidence: null },
						{ text: " YouTube", startMs: 25140, endMs: 25380, timestampMs: 25260, confidence: null },
						{ text: " in", startMs: 25380, endMs: 25920, timestampMs: 25650, confidence: null },
						{ text: " Chrome", startMs: 25920, endMs: 26267, timestampMs: 26093, confidence: null },
					]} />
				</Sequence>
			</Track>

			<Track name="Light leaks">
				<Sequence name="Leak on whip" from={122} durationInFrames={40}>
					<Leak duration={40} seed={3} />
				</Sequence>
				<Sequence name="Leak into end card" from={673} durationInFrames={30}>
					<Leak duration={30} seed={5} />
				</Sequence>
			</Track>

			<Track name="End card">
				<Sequence name="End card" from={680} durationInFrames={90}>
					<FadeIn frames={10}>
						<EndCard allWhite />
					</FadeIn>
				</Sequence>
			</Track>

			<Track name="Sound effects">
				<Audio name="Whip" src="https://remotion.media/whoosh.wav" from={118} volume={0.4} />
				<Audio name="Click on Watch with filters" src="https://remotion.media/mouse-click.wav" from={311} volume={0.5} />
				<Audio name="Blur on the spiders" src="https://remotion.media/whip.wav" from={333} volume={0.35} />
				<Audio name="Into end card" src="https://remotion.media/whoosh.wav" from={673} volume={0.3} />
				<Audio name="End card" src="https://remotion.media/ding.wav" from={691} volume={0.2} />
			</Track>
		</AbsoluteFill>
	);
};
