import { colorCorrection } from '@remotion/effects/color-correction';
import { zoomBlur } from '@remotion/effects/zoom-blur';
import { Audio, Video } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, Track, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FadeIn, Frame, Leak, ReelCaptions } from './reel-parts';
import { CLAMP, color } from './social-clip/theme';

const SOURCE = 'IMG_0312.mov';
// The recording's audio with rumble and room noise removed, then compressed and
// levelled. The laptop's film sound is in it too, and it drops out while the
// extension mutes the hidden scene. Regenerate with:
// ffmpeg -i public/IMG_0312.mov -vn -ac 1 -ar 48000 -af "highpass=f=85,afftdn=nf=-32:tn=1,acompressor=threshold=-26dB:ratio=3:attack=8:release=140:makeup=4,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000" -c:a pcm_s16le public/IMG_0312-voice.wav
const VOICE = 'IMG_0312-voice.wav';

/** Punch-in centres. */
const FACE = '46% 42%';
const CENTRE = '50% 45%';
const SCREEN = '50% 45%';
/** The "Hidden: Blood & gore" label, left of centre on the laptop. */
const LABEL = '31% 52%';

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

/** Star Wars cantina reel. Script: marketing/scripts/founder-story-03.md. */
export const Social03: React.FC = () => {
	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Track name="Shots">
				{/* Talking head, alternating wide and tight. */}
				<Sequence name="Hook" durationInFrames={63}>
					<Frame at={[0, 63]} zoom={[1, 1.05]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Hook captions" style={CAPTIONS} captions={[
						{ text: "You", startMs: 0, endMs: 140, timestampMs: 70, confidence: null },
						{ text: " forgot", startMs: 140, endMs: 500, timestampMs: 320, confidence: null },
						{ text: " this", startMs: 500, endMs: 800, timestampMs: 650, confidence: null },
						{ text: " scene", startMs: 800, endMs: 1060, timestampMs: 930, confidence: null },
						{ text: " was", startMs: 1060, endMs: 1280, timestampMs: 1170, confidence: null },
						{ text: " in", startMs: 1280, endMs: 1440, timestampMs: 1360, confidence: null },
						{ text: " Star", startMs: 1440, endMs: 1680, timestampMs: 1560, confidence: null },
						{ text: " Wars", startMs: 1680, endMs: 2100, timestampMs: 1890, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Everybody" from={63} trimBefore={82} durationInFrames={55}>
					<Frame at={[82, 137]} zoom={[1.22, 1.26]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Everybody captions" style={CAPTIONS} captions={[
						{ text: "Everybody", startMs: 2800, endMs: 3020, timestampMs: 2910, confidence: null },
						{ text: " has", startMs: 3020, endMs: 3220, timestampMs: 3120, confidence: null },
						{ text: " a", startMs: 3220, endMs: 3400, timestampMs: 3310, confidence: null },
						{ text: " scene", startMs: 3400, endMs: 3540, timestampMs: 3470, confidence: null },
						{ text: " that", startMs: 3540, endMs: 3700, timestampMs: 3620, confidence: null },
						{ text: " they", startMs: 3700, endMs: 3860, timestampMs: 3780, confidence: null },
						{ text: " can't", startMs: 3860, endMs: 4160, timestampMs: 4010, confidence: null },
						{ text: " watch", startMs: 4160, endMs: 4567, timestampMs: 4360, confidence: null },
					]} />
				</Sequence>
				<Sequence name="For me" from={118} trimBefore={158} durationInFrames={54}>
					<Frame at={[158, 212]} zoom={[1.04, 1.08]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="For me captions" style={CAPTIONS} captions={[
						{ text: "For", startMs: 5340, endMs: 5520, timestampMs: 5430, confidence: null },
						{ text: " me", startMs: 5520, endMs: 5980, timestampMs: 5750, confidence: null },
						{ text: " it", startMs: 5980, endMs: 6100, timestampMs: 6040, confidence: null },
						{ text: " might", startMs: 6100, endMs: 6300, timestampMs: 6200, confidence: null },
						{ text: " be", startMs: 6300, endMs: 6460, timestampMs: 6380, confidence: null },
						{ text: " that", startMs: 6460, endMs: 6660, timestampMs: 6560, confidence: null },
						{ text: " scene", startMs: 6660, endMs: 7067, timestampMs: 6860, confidence: null },
					]} />
				</Sequence>
				{/* Whisper is unsure here: "for you" or "for me". Check by ear at 7.2s. */}
				<Sequence name="For you" from={172} trimBefore={212} durationInFrames={47}>
					<Frame at={[212, 259]} zoom={[1.26, 1.3]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="For you captions" style={CAPTIONS} captions={[
						{ text: "for", startMs: 7080, endMs: 7180, timestampMs: 7130, confidence: null },
						{ text: " you", startMs: 7180, endMs: 7320, timestampMs: 7250, confidence: null },
						{ text: " it", startMs: 7320, endMs: 7420, timestampMs: 7370, confidence: null },
						{ text: " might", startMs: 7420, endMs: 7560, timestampMs: 7490, confidence: null },
						{ text: " just", startMs: 7560, endMs: 7740, timestampMs: 7650, confidence: null },
						{ text: " be", startMs: 7740, endMs: 7880, timestampMs: 7810, confidence: null },
						{ text: " blood", startMs: 7880, endMs: 8180, timestampMs: 8030, confidence: null },
						{ text: " and", startMs: 8180, endMs: 8340, timestampMs: 8260, confidence: null },
						{ text: " gore", startMs: 8340, endMs: 8633, timestampMs: 8490, confidence: null },
					]} />
				</Sequence>
				{/* The real phone whip, cut in mid-move and pushed with a blur burst. */}
				<Sequence name="Into whip" from={219} trimBefore={268} durationInFrames={17}>
					<Frame at={[268, 285]} zoom={[1.26, 1.34]} origin={CENTRE}>
						<Footage look="face" burst={[268, 285, 298]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Into whip captions" style={CAPTIONS} captions={[
						{ text: "So", startMs: 9060, endMs: 9140, timestampMs: 9100, confidence: null },
						{ text: " I", startMs: 9140, endMs: 9240, timestampMs: 9190, confidence: null },
						{ text: " built", startMs: 9240, endMs: 9320, timestampMs: 9280, confidence: null },
						{ text: " a", startMs: 9320, endMs: 9500, timestampMs: 9410, confidence: null },
					]} />
				</Sequence>
				{/* The demo. */}
				<Sequence name="Whip lands" from={236} trimBefore={285} durationInFrames={57}>
					<Frame at={[285, 300]} zoom={[1.2, 1.02]} origin={SCREEN} snap>
						<Footage look="screen" burst={[268, 285, 298]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Whip lands captions" style={CAPTIONS} captions={[
						{ text: "Chrome", startMs: 9500, endMs: 9640, timestampMs: 9570, confidence: null },
						{ text: " extension", startMs: 9640, endMs: 10080, timestampMs: 9860, confidence: null },
						{ text: " that", startMs: 10080, endMs: 10480, timestampMs: 10280, confidence: null },
						{ text: " blurs", startMs: 10480, endMs: 10700, timestampMs: 10590, confidence: null },
						{ text: " it", startMs: 10700, endMs: 10880, timestampMs: 10790, confidence: null },
						{ text: " for", startMs: 10880, endMs: 11080, timestampMs: 10980, confidence: null },
						{ text: " you", startMs: 11080, endMs: 11400, timestampMs: 11240, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Checks the scenes" from={293} trimBefore={402} durationInFrames={80}>
					<Frame at={[402, 482]} zoom={[1.08, 1.16]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Checks the scenes captions" style={CAPTIONS} captions={[
						{ text: "It", startMs: 13500, endMs: 13940, timestampMs: 13720, confidence: null },
						{ text: " checks", startMs: 13940, endMs: 14160, timestampMs: 14050, confidence: null },
						{ text: " the", startMs: 14160, endMs: 14340, timestampMs: 14250, confidence: null },
						{ text: " scenes", startMs: 14340, endMs: 14680, timestampMs: 14510, confidence: null },
						{ text: " before", startMs: 14680, endMs: 15120, timestampMs: 14900, confidence: null },
						{ text: " they", startMs: 15120, endMs: 15360, timestampMs: 15240, confidence: null },
						{ text: " reach", startMs: 15360, endMs: 15600, timestampMs: 15480, confidence: null },
						{ text: " you", startMs: 15600, endMs: 16067, timestampMs: 15830, confidence: null },
					]} />
				</Sequence>
				{/* Obi-Wan's lightsaber, in real time. */}
				<Sequence name="The cut-off arm" from={373} trimBefore={518} durationInFrames={66}>
					<Frame at={[518, 584]} zoom={[1, 1.06]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="The cut-off arm captions" style={CAPTIONS} captions={[
						{ text: "And", startMs: 17360, endMs: 17560, timestampMs: 17460, confidence: null },
						{ text: " here", startMs: 17560, endMs: 18120, timestampMs: 17840, confidence: null },
						{ text: " the", startMs: 18120, endMs: 18240, timestampMs: 18180, confidence: null },
						{ text: " cut-off", startMs: 18240, endMs: 18580, timestampMs: 18410, confidence: null },
						{ text: " arm", startMs: 18580, endMs: 18980, timestampMs: 18780, confidence: null },
						{ text: " gets", startMs: 18980, endMs: 19467, timestampMs: 19220, confidence: null },
					]} />
				</Sequence>
				{/* Cut on the frame the extension's blur fades in: punch in on its label. */}
				<Sequence name="Blur hits" from={439} trimBefore={584} durationInFrames={75}>
					<Frame at={[584, 600]} zoom={[1.1, 1.45]} origin={LABEL} snap>
						<Footage look="screen" burst={[584, 588, 598]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Blur hits captions" style={CAPTIONS} captions={[
						{ text: "blurred", startMs: 19467, endMs: 20020, timestampMs: 19740, confidence: null },
						{ text: " and", startMs: 20020, endMs: 20760, timestampMs: 20390, confidence: null },
						{ text: " the", startMs: 20760, endMs: 20900, timestampMs: 20830, confidence: null },
						{ text: " movie", startMs: 20900, endMs: 21160, timestampMs: 21030, confidence: null },
						{ text: " keeps", startMs: 21160, endMs: 21480, timestampMs: 21320, confidence: null },
						{ text: " going", startMs: 21480, endMs: 21967, timestampMs: 21720, confidence: null },
					]} />
				</Sequence>
				{/* The blur lifts at about 23.2s and the film's sound comes back. No voice. */}
				<Sequence name="Film comes back" from={514} trimBefore={690} durationInFrames={33}>
					<Frame at={[690, 723]} zoom={[1.02, 1.08]} origin={SCREEN}>
						<Footage look="screen" burst={[712, 723, 736]} />
					</Frame>
					<Voice />
				</Sequence>
				<Sequence name="Watching with kids" from={547} trimBefore={723} durationInFrames={93}>
					<Frame at={[723, 745]} zoom={[1.2, 1.04]} origin={FACE} snap>
						<Footage look="face" burst={[712, 723, 736]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Watching with kids captions" style={CAPTIONS} captions={[
						{ text: "Handy", startMs: 24760, endMs: 25200, timestampMs: 24980, confidence: null },
						{ text: " if", startMs: 25200, endMs: 25320, timestampMs: 25260, confidence: null },
						{ text: " you're", startMs: 25320, endMs: 25440, timestampMs: 25380, confidence: null },
						{ text: " watching", startMs: 25440, endMs: 25620, timestampMs: 25530, confidence: null },
						{ text: " with", startMs: 25620, endMs: 25820, timestampMs: 25720, confidence: null },
						{ text: " kids", startMs: 25820, endMs: 26300, timestampMs: 26060, confidence: null },
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
				<Sequence name="Name over the last shot" from={572} durationInFrames={68}>
					<NamePill />
				</Sequence>
			</Track>

			<Track name="Light leaks">
				<Sequence name="Leak on whip" from={221} durationInFrames={40}>
					<Leak duration={40} seed={3} />
				</Sequence>
				<Sequence name="Leak on whip back" from={537} durationInFrames={30}>
					<Leak duration={30} seed={5} />
				</Sequence>
			</Track>

			<Track name="Sound effects">
				<Audio name="Whip" src="https://remotion.media/whoosh.wav" from={217} volume={0.4} />
				<Audio name="Blur on the arm" src="https://remotion.media/whip.wav" from={439} volume={0.35} />
				<Audio name="Whip back" src="https://remotion.media/whoosh.wav" from={535} volume={0.3} />
				<Audio name="Name" src="https://remotion.media/ding.wav" from={572} volume={0.2} />
			</Track>
		</AbsoluteFill>
	);
};
