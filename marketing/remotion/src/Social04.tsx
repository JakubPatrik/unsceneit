import { colorCorrection } from '@remotion/effects/color-correction';
import { zoomBlur } from '@remotion/effects/zoom-blur';
import { Audio, Video } from '@remotion/media';
import React from 'react';
import { AbsoluteFill, Sequence, Track, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { FadeIn, Frame, Leak, ReelCaptions } from './reel-parts';
import { CLAMP, color } from './social-clip/theme';

const SOURCE = 'IMG_0323.mov';
// The recording's audio with rumble and room noise removed, then compressed and
// levelled. The laptop's film sound is in it too. Regenerate with:
// ffmpeg -i public/IMG_0323.mov -vn -ac 1 -ar 48000 -af "highpass=f=85,afftdn=nf=-32:tn=1,acompressor=threshold=-26dB:ratio=3:attack=8:release=140:makeup=4,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000" -c:a pcm_s16le public/IMG_0323-voice.wav
const VOICE = 'IMG_0323-voice.wav';

/** Punch-in centres. */
const FACE = '48% 40%';
const CENTRE = '50% 45%';
const SCREEN = '50% 45%';
const DIALOG = '50% 52%';
/** "Hidden: Blood & gore" over the torn-up body (0:06.5 in the clip). */
const LABEL_BODY = '65% 55%';
/** The same label over the bear attack (4:26.5 in the clip). */
const LABEL_ATTACK = '53% 56%';

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
 * The Revenant bear attack reel. Script: marketing/scripts/founder-story-04.md.
 * The take was unscripted, and every line of it is kept. From 25s to 33.4s the
 * attack plays unblurred after its flagged stretch ends, so from the river shot
 * to the whip back, picture and voice are cut separately: the picture stays on
 * blurred footage while the voice drops its pauses. The founder chose to keep
 * "define any filter… any kind of content", though STORY.md lists custom
 * filters as not in the alpha.
 */
export const Social04: React.FC = () => {
	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Track name="Shots">
				{/* Talking head, alternating wide and tight. */}
				<Sequence name="Hook" durationInFrames={54}>
					<Frame at={[0, 54]} zoom={[1, 1.05]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Hook captions" style={CAPTIONS} captions={[
						{ text: "You", startMs: 0, endMs: 300, timestampMs: 150, confidence: null },
						{ text: " forgot", startMs: 300, endMs: 620, timestampMs: 460, confidence: null },
						{ text: " how", startMs: 620, endMs: 940, timestampMs: 780, confidence: null },
						{ text: " brutal", startMs: 940, endMs: 1800, timestampMs: 1370, confidence: null },
					]} />
				</Sequence>
				<Sequence name="The Revenant" from={54} trimBefore={70} durationInFrames={48}>
					<Frame at={[70, 118]} zoom={[1.22, 1.26]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="The Revenant captions" style={CAPTIONS} captions={[
						{ text: "The", startMs: 2330, endMs: 2640, timestampMs: 2485, confidence: null },
						{ text: " Revenant", startMs: 2640, endMs: 3100, timestampMs: 2870, confidence: null },
						{ text: " actually", startMs: 3100, endMs: 3540, timestampMs: 3320, confidence: null },
						{ text: " is", startMs: 3540, endMs: 3933, timestampMs: 3737, confidence: null },
					]} />
				</Sequence>
				{/* The real phone whip, pushed with a blur burst. */}
				<Sequence name="Into whip" from={102} trimBefore={118} durationInFrames={17}>
					<Frame at={[118, 135]} zoom={[1.26, 1.34]} origin={CENTRE}>
						<Footage look="face" burst={[118, 135, 150]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Into whip captions" style={CAPTIONS} captions={[
						{ text: "So", startMs: 4140, endMs: 4500, timestampMs: 4320, confidence: null },
					]} />
				</Sequence>
				{/* The demo. */}
				<Sequence name="Whip lands" from={119} trimBefore={135} durationInFrames={30}>
					<Frame at={[135, 150]} zoom={[1.2, 1.02]} origin={SCREEN} snap>
						<Footage look="screen" burst={[118, 135, 150]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Whip lands captions" style={CAPTIONS} captions={[
						{ text: "I", startMs: 4900, endMs: 5260, timestampMs: 5080, confidence: null },
						{ text: " built", startMs: 5260, endMs: 5500, timestampMs: 5380, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Filter dialog" from={149} trimBefore={165} durationInFrames={68}>
					<Frame at={[165, 233]} zoom={[1.12, 1.28]} origin={DIALOG}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Filter dialog captions" style={CAPTIONS} captions={[
						{ text: "an", startMs: 5500, endMs: 5600, timestampMs: 5550, confidence: null },
						{ text: " extension", startMs: 5600, endMs: 5900, timestampMs: 5750, confidence: null },
						{ text: " that", startMs: 5900, endMs: 6660, timestampMs: 6280, confidence: null },
						{ text: " hides", startMs: 6660, endMs: 7120, timestampMs: 6890, confidence: null },
						{ text: " a", startMs: 7120, endMs: 7460, timestampMs: 7290, confidence: null },
						{ text: " couple", startMs: 7460, endMs: 7600, timestampMs: 7530, confidence: null },
						{ text: " of", startMs: 7600, endMs: 7767, timestampMs: 7683, confidence: null },
					]} />
				</Sequence>
				<Sequence name="River" from={217} trimBefore={233} durationInFrames={15}>
					<Frame at={[233, 248]} zoom={[1, 1.02]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="River captions" style={CAPTIONS} captions={[
						{ text: "scenes", startMs: 7767, endMs: 8267, timestampMs: 8017, confidence: null },
					]} />
				</Sequence>
				{/* Picture only from here: the voice is on its own track below. */}
				<Sequence name="River plays on" from={232} trimBefore={272} durationInFrames={112}>
					<Frame at={[272, 384]} zoom={[1.02, 1.08]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
				</Sequence>
				{/* The extension's blur fades in at 12.8s: punch in on its label. */}
				{/* Ends at 18.53s, before the seek at 18.6s. */}
				<Sequence name="Body gets hidden" from={344} trimBefore={384} durationInFrames={172}>
					<Frame at={[384, 400]} zoom={[1.08, 1.35]} origin={LABEL_BODY} snap>
						<Footage look="screen" burst={[384, 388, 398]} />
					</Frame>
				</Sequence>
				{/*
				 * The jump to the attack. Starts at 19.15s, after the 0.4s the
				 * extension showed the film unblurred following the seek, and ends
				 * at 24.9s, before the blur lifts at 24.95s.
				 */}
				<Sequence name="Bear attack hidden" from={516} trimBefore={575} durationInFrames={172}>
					<Frame at={[575, 595]} zoom={[1.1, 1.35]} origin={LABEL_ATTACK} snap>
						<Footage look="screen" burst={[575, 579, 590]} />
					</Frame>
				</Sequence>
				{/*
				 * Back on camera, picture and voice in sync again. The whip starts
				 * at 33.5s: 25s to 33.4s show the attack unblurred, then paused.
				 */}
				<Sequence name="Whip back" from={688} trimBefore={1005} durationInFrames={18}>
					<Frame at={[1005, 1023]} zoom={[1.3, 1.2]} origin={CENTRE}>
						<Footage look="face" burst={[1005, 1023, 1036]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Whip back captions" style={CAPTIONS} captions={[
						{ text: "can", startMs: 33360, endMs: 33600, timestampMs: 33480, confidence: null },
						{ text: " do", startMs: 33600, endMs: 33820, timestampMs: 33710, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Define any filter" from={706} trimBefore={1023} durationInFrames={122}>
					<Frame at={[1023, 1040]} zoom={[1.2, 1.04]} origin={FACE} snap>
						<Footage look="face" burst={[1005, 1023, 1036]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Define any filter captions" style={CAPTIONS} captions={[
						{ text: "You", startMs: 34400, endMs: 34880, timestampMs: 34640, confidence: null },
						{ text: " could", startMs: 34880, endMs: 35100, timestampMs: 34990, confidence: null },
						{ text: " define", startMs: 35100, endMs: 35420, timestampMs: 35260, confidence: null },
						{ text: " any", startMs: 35420, endMs: 35740, timestampMs: 35580, confidence: null },
						{ text: " filter", startMs: 35740, endMs: 36120, timestampMs: 35930, confidence: null },
						{ text: " of", startMs: 36120, endMs: 36320, timestampMs: 36220, confidence: null },
						{ text: " whatever", startMs: 36320, endMs: 36600, timestampMs: 36460, confidence: null },
						{ text: " bothers", startMs: 36600, endMs: 37000, timestampMs: 36800, confidence: null },
						{ text: " you", startMs: 37000, endMs: 37280, timestampMs: 37140, confidence: null },
						{ text: " annoys", startMs: 37280, endMs: 37820, timestampMs: 37550, confidence: null },
						{ text: " you", startMs: 37820, endMs: 38150, timestampMs: 37985, confidence: null },
					]} />
				</Sequence>
				{/* The 1.2s pause before "and then" is cut. */}
				<Sequence name="Any kind of content" from={828} trimBefore={1179} durationInFrames={109}>
					<Frame at={[1179, 1288]} zoom={[1.22, 1.26]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Any kind of content captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 39380, endMs: 39860, timestampMs: 39620, confidence: null },
						{ text: " then", startMs: 39860, endMs: 40040, timestampMs: 39950, confidence: null },
						{ text: " apply", startMs: 40040, endMs: 40360, timestampMs: 40200, confidence: null },
						{ text: " it", startMs: 40360, endMs: 40700, timestampMs: 40530, confidence: null },
						{ text: " for", startMs: 40700, endMs: 41380, timestampMs: 41040, confidence: null },
						{ text: " any", startMs: 41380, endMs: 41560, timestampMs: 41470, confidence: null },
						{ text: " kind", startMs: 41560, endMs: 41740, timestampMs: 41650, confidence: null },
						{ text: " of", startMs: 41740, endMs: 41900, timestampMs: 41820, confidence: null },
						{ text: " content", startMs: 41900, endMs: 42180, timestampMs: 42040, confidence: null },
						{ text: " that", startMs: 42180, endMs: 42380, timestampMs: 42280, confidence: null },
						{ text: " you're", startMs: 42380, endMs: 42580, timestampMs: 42480, confidence: null },
						{ text: " gonna", startMs: 42580, endMs: 42700, timestampMs: 42640, confidence: null },
						{ text: " see", startMs: 42700, endMs: 42933, timestampMs: 42817, confidence: null },
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

			<Track name="Lifted voice">
				<Sequence name="Torn-up body" from={232} trimBefore={272} durationInFrames={116}>
					<Voice />
					<ReelCaptions name="Torn-up body captions" style={CAPTIONS} captions={[
						{ text: "For", startMs: 9100, endMs: 9420, timestampMs: 9260, confidence: null },
						{ text: " example", startMs: 9420, endMs: 9720, timestampMs: 9570, confidence: null },
						{ text: " here", startMs: 9720, endMs: 10160, timestampMs: 9940, confidence: null },
						{ text: " at", startMs: 10160, endMs: 10340, timestampMs: 10250, confidence: null },
						{ text: " the", startMs: 10340, endMs: 10420, timestampMs: 10380, confidence: null },
						{ text: " very", startMs: 10420, endMs: 10600, timestampMs: 10510, confidence: null },
						{ text: " beginning", startMs: 10600, endMs: 11020, timestampMs: 10810, confidence: null },
						{ text: " there's", startMs: 11020, endMs: 11880, timestampMs: 11450, confidence: null },
						{ text: " a", startMs: 11880, endMs: 12060, timestampMs: 11970, confidence: null },
						{ text: " torn-up", startMs: 12060, endMs: 12440, timestampMs: 12250, confidence: null },
						{ text: " body", startMs: 12440, endMs: 12933, timestampMs: 12687, confidence: null },
					]} />
				</Sequence>
				<Sequence name="That gets hidden" from={348} trimBefore={430} durationInFrames={39}>
					<Voice />
					<ReelCaptions name="That gets hidden captions" style={CAPTIONS} captions={[
						{ text: "that", startMs: 14420, endMs: 15060, timestampMs: 14740, confidence: null },
						{ text: " gets", startMs: 15060, endMs: 15260, timestampMs: 15160, confidence: null },
						{ text: " hidden", startMs: 15260, endMs: 15633, timestampMs: 15447, confidence: null },
					]} />
				</Sequence>
				<Sequence name="The actual fight" from={387} trimBefore={469} durationInFrames={56}>
					<Voice />
					<ReelCaptions name="The actual fight captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 15633, endMs: 16360, timestampMs: 16000, confidence: null },
						{ text: " then", startMs: 16360, endMs: 16500, timestampMs: 16430, confidence: null },
						{ text: " the", startMs: 16500, endMs: 16640, timestampMs: 16570, confidence: null },
						{ text: " actual", startMs: 16640, endMs: 16960, timestampMs: 16800, confidence: null },
						{ text: " fight", startMs: 16960, endMs: 17500, timestampMs: 17230, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Fighting the bear" from={443} trimBefore={639} durationInFrames={77}>
					<Voice />
					<ReelCaptions name="Fighting the bear captions" style={CAPTIONS} captions={[
						{ text: "when", startMs: 21340, endMs: 21600, timestampMs: 21470, confidence: null },
						{ text: " Leonardo", startMs: 21600, endMs: 22120, timestampMs: 21860, confidence: null },
						{ text: " is", startMs: 22120, endMs: 22340, timestampMs: 22230, confidence: null },
						{ text: " fighting", startMs: 22340, endMs: 22680, timestampMs: 22510, confidence: null },
						{ text: " the", startMs: 22680, endMs: 22900, timestampMs: 22790, confidence: null },
						{ text: " bear", startMs: 22900, endMs: 23120, timestampMs: 23010, confidence: null },
						{ text: " on", startMs: 23120, endMs: 23300, timestampMs: 23210, confidence: null },
						{ text: " the", startMs: 23300, endMs: 23460, timestampMs: 23380, confidence: null },
						{ text: " ground", startMs: 23460, endMs: 23867, timestampMs: 23663, confidence: null },
					]} />
				</Sequence>
				{/* "you know" is dropped, and the pause after "not". */}
				<Sequence name="Probably not" from={520} trimBefore={755} durationInFrames={30}>
					<Voice />
					<ReelCaptions name="Probably not captions" style={CAPTIONS} captions={[
						{ text: "probably", startMs: 25167, endMs: 25620, timestampMs: 25393, confidence: null },
						{ text: " not", startMs: 25620, endMs: 26167, timestampMs: 25893, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Safe with your kid" from={550} trimBefore={797} durationInFrames={63}>
					<Voice />
					<ReelCaptions name="Safe with your kid captions" style={CAPTIONS} captions={[
						{ text: "entirely", startMs: 26567, endMs: 27240, timestampMs: 26903, confidence: null },
						{ text: " safe", startMs: 27240, endMs: 27680, timestampMs: 27460, confidence: null },
						{ text: " to", startMs: 27680, endMs: 27900, timestampMs: 27790, confidence: null },
						{ text: " watch", startMs: 27900, endMs: 28060, timestampMs: 27980, confidence: null },
						{ text: " with", startMs: 28060, endMs: 28240, timestampMs: 28150, confidence: null },
						{ text: " your", startMs: 28240, endMs: 28380, timestampMs: 28310, confidence: null },
						{ text: " kid", startMs: 28380, endMs: 28667, timestampMs: 28520, confidence: null },
					]} />
				</Sequence>
				{/* "and" is dropped, and the pauses after "so this" and "is not". */}
				<Sequence name="So this" from={613} trimBefore={909} durationInFrames={17}>
					<Voice />
					<ReelCaptions name="So this captions" style={CAPTIONS} captions={[
						{ text: "So", startMs: 30300, endMs: 30560, timestampMs: 30430, confidence: null },
						{ text: " this", startMs: 30560, endMs: 30867, timestampMs: 30713, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Is not" from={630} trimBefore={940} durationInFrames={18}>
					<Voice />
					<ReelCaptions name="Is not captions" style={CAPTIONS} captions={[
						{ text: "is", startMs: 31333, endMs: 31600, timestampMs: 31467, confidence: null },
						{ text: " not", startMs: 31600, endMs: 31933, timestampMs: 31767, confidence: null },
					]} />
				</Sequence>
				<Sequence name="The only thing" from={648} trimBefore={965} durationInFrames={40}>
					<Voice />
					<ReelCaptions name="The only thing captions" style={CAPTIONS} captions={[
						{ text: "the", startMs: 32167, endMs: 32420, timestampMs: 32290, confidence: null },
						{ text: " only", startMs: 32420, endMs: 32620, timestampMs: 32520, confidence: null },
						{ text: " thing", startMs: 32620, endMs: 32800, timestampMs: 32710, confidence: null },
						{ text: " that", startMs: 32800, endMs: 32940, timestampMs: 32870, confidence: null },
						{ text: " the", startMs: 32940, endMs: 33040, timestampMs: 32990, confidence: null },
						{ text: " extension", startMs: 33040, endMs: 33360, timestampMs: 33200, confidence: null },
						{ text: " can", startMs: 33360, endMs: 33500, timestampMs: 33430, confidence: null },
					]} />
				</Sequence>
			</Track>

			<Track name="Name">
				<Sequence name="Name over the last shot" from={877} durationInFrames={60}>
					<NamePill />
				</Sequence>
			</Track>

			<Track name="Light leaks">
				<Sequence name="Leak on whip" from={104} durationInFrames={40}>
					<Leak duration={40} seed={3} />
				</Sequence>
				<Sequence name="Leak on the jump to the attack" from={512} durationInFrames={30}>
					<Leak duration={30} seed={5} />
				</Sequence>
				<Sequence name="Leak on whip back" from={690} durationInFrames={30}>
					<Leak duration={30} seed={7} />
				</Sequence>
			</Track>

			<Track name="Sound effects">
				<Audio name="Whip" src="https://remotion.media/whoosh.wav" from={100} volume={0.4} />
				<Audio name="Blur on the body" src="https://remotion.media/whip.wav" from={344} volume={0.35} />
				<Audio name="Jump to the attack" src="https://remotion.media/whoosh.wav" from={512} volume={0.3} />
				<Audio name="Whip back" src="https://remotion.media/whoosh.wav" from={684} volume={0.3} />
				<Audio name="Name" src="https://remotion.media/ding.wav" from={877} volume={0.2} />
			</Track>
		</AbsoluteFill>
	);
};
