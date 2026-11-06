import { colorCorrection } from '@remotion/effects/color-correction';
import { zoomBlur } from '@remotion/effects/zoom-blur';
import { Audio, Video } from '@remotion/media';
import React from 'react';
import {
	AbsoluteFill,
	Sequence,
	Track,
	interpolate,
	staticFile,
	useCurrentFrame,
} from 'remotion';
import { FadeIn, Frame, Leak, ReelCaptions } from './reel-parts';
import { EndCard } from './social-clip/SocialClip';
import { CLAMP, FONT_FAMILY } from './social-clip/theme';

const SOURCE = 'IMG_0272.MOV';
// The recording's audio with rumble and room noise removed, then compressed and
// levelled. Regenerate with:
// ffmpeg -i public/IMG_0272.MOV -vn -ac 1 -ar 48000 -af "highpass=f=85,afftdn=nf=-32:tn=1,acompressor=threshold=-26dB:ratio=3:attack=8:release=140:makeup=4,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000" -c:a pcm_s16le public/IMG_0272-voice.wav
const VOICE = 'IMG_0272-voice.wav';

/** Punch-in centres. A low origin pushes the dialog up, clear of the captions. */
const FACE = '48% 40%';
const SCREEN = '50% 45%';
const DIALOG = '58% 76%';
const XENIA = '72% 44%';
const PRESCAN = '30% 44%';
const BLUR = '60% 56%';

/** Above the platforms' 400px of bottom UI, and clear of their right-hand buttons. */
const CAPTIONS = { top: 1320, left: 100 } as const;

const LOOKS = {
	/** This take is well lit, so the face only needs a little shape and warmth held back. */
	face: {
		highlights: -0.15,
		contrast: 1.06,
		saturation: 1.05,
		vibrance: 0.08,
	},
	/** Cuts the window glare lifting the laptop's blacks, and neutralises its warm cast. */
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

export const Social01: React.FC = () => {
	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Track name="Shots">
				{/* Talking head: pauses cut, alternating wide and tight. */}
				<Sequence name="Hook" durationInFrames={47}>
					<Frame at={[0, 47]} zoom={[1, 1.04]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Hook captions" style={CAPTIONS} captions={[
						{ text: "Everybody", startMs: 0, endMs: 200, timestampMs: 100, confidence: null },
						{ text: " has", startMs: 200, endMs: 400, timestampMs: 300, confidence: null },
						{ text: " that", startMs: 400, endMs: 580, timestampMs: 490, confidence: null },
						{ text: " scene", startMs: 580, endMs: 760, timestampMs: 670, confidence: null },
						{ text: " that", startMs: 760, endMs: 920, timestampMs: 840, confidence: null },
						{ text: " they", startMs: 920, endMs: 1060, timestampMs: 990, confidence: null },
						{ text: " can't", startMs: 1060, endMs: 1240, timestampMs: 1150, confidence: null },
						{ text: " watch", startMs: 1240, endMs: 1567, timestampMs: 1403, confidence: null },
					]} />
				</Sequence>
				<Sequence name="For me" from={47} trimBefore={57} durationInFrames={39}>
					<Frame at={[57, 96]} zoom={[1.2, 1.23]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="For me captions" style={CAPTIONS} captions={[
						{ text: "For", startMs: 1940, endMs: 2080, timestampMs: 2010, confidence: null },
						{ text: " me", startMs: 2080, endMs: 2400, timestampMs: 2240, confidence: null },
						{ text: " it's", startMs: 2400, endMs: 2520, timestampMs: 2460, confidence: null },
						{ text: " that", startMs: 2520, endMs: 2760, timestampMs: 2640, confidence: null },
						{ text: " scene", startMs: 2760, endMs: 3200, timestampMs: 2980, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Parents or partners" from={86} trimBefore={96} durationInFrames={45}>
					<Frame at={[96, 141]} zoom={[1.08, 1.11]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Parents or partners captions" style={CAPTIONS} captions={[
						{ text: "with", startMs: 3200, endMs: 3480, timestampMs: 3340, confidence: null },
						{ text: " my", startMs: 3480, endMs: 3660, timestampMs: 3570, confidence: null },
						{ text: " parents", startMs: 3660, endMs: 3920, timestampMs: 3790, confidence: null },
						{ text: " or", startMs: 3920, endMs: 4120, timestampMs: 4020, confidence: null },
						{ text: " partners", startMs: 4120, endMs: 4700, timestampMs: 4410, confidence: null },
					]} />
				</Sequence>
				<Sequence name="For you" from={131} trimBefore={171} durationInFrames={32}>
					<Frame at={[171, 203]} zoom={[1.06, 1.09]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="For you captions" style={CAPTIONS} captions={[
						{ text: "For", startMs: 5700, endMs: 5900, timestampMs: 5800, confidence: null },
						{ text: " you", startMs: 5900, endMs: 6240, timestampMs: 6070, confidence: null },
						{ text: " it", startMs: 6240, endMs: 6320, timestampMs: 6280, confidence: null },
						{ text: " might", startMs: 6320, endMs: 6420, timestampMs: 6370, confidence: null },
						{ text: " just", startMs: 6420, endMs: 6580, timestampMs: 6500, confidence: null },
						{ text: " be", startMs: 6580, endMs: 6767, timestampMs: 6673, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Blood, gore, violence" from={163} trimBefore={203} durationInFrames={30}>
					<Frame at={[203, 233]} zoom={[1.28, 1.33]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="Blood, gore, violence captions" style={CAPTIONS} captions={[
						{ text: "blood", startMs: 6780, endMs: 7020, timestampMs: 6900, confidence: null },
						{ text: " gore", startMs: 7020, endMs: 7260, timestampMs: 7140, confidence: null },
						{ text: " and", startMs: 7260, endMs: 7380, timestampMs: 7320, confidence: null },
						{ text: " violence", startMs: 7380, endMs: 7767, timestampMs: 7573, confidence: null },
					]} />
				</Sequence>
				<Sequence name="So I built" from={193} trimBefore={244} durationInFrames={56}>
					<Frame at={[244, 300]} zoom={[1.1, 1.14]} origin={FACE}>
						<Footage look="face" />
					</Frame>
					<Voice />
					<ReelCaptions name="So I built captions" style={CAPTIONS} captions={[
						{ text: "So", startMs: 8133, endMs: 8300, timestampMs: 8217, confidence: null },
						{ text: " I", startMs: 8300, endMs: 8400, timestampMs: 8350, confidence: null },
						{ text: " built", startMs: 8400, endMs: 8540, timestampMs: 8470, confidence: null },
						{ text: " a", startMs: 8540, endMs: 8700, timestampMs: 8620, confidence: null },
						{ text: " Chrome", startMs: 8700, endMs: 8880, timestampMs: 8790, confidence: null },
						{ text: " extension", startMs: 8880, endMs: 9200, timestampMs: 9040, confidence: null },
						{ text: " for", startMs: 9200, endMs: 9580, timestampMs: 9390, confidence: null },
						{ text: " YouTube", startMs: 9580, endMs: 10000, timestampMs: 9790, confidence: null },
					]} />
				</Sequence>
				<Sequence name="That solves it, into whip" from={249} trimBefore={300} durationInFrames={18}>
					<Frame at={[300, 318]} zoom={[1.14, 1.24]} origin={FACE}>
						<Footage look="face" burst={[306, 318, 333]} />
					</Frame>
					<Voice />
					<ReelCaptions name="That solves it, into whip captions" style={CAPTIONS} captions={[
						{ text: "That", startMs: 10180, endMs: 10240, timestampMs: 10210, confidence: null },
						{ text: " solves", startMs: 10240, endMs: 10600, timestampMs: 10420, confidence: null },
					]} />
				</Sequence>
				{/* The demo. */}
				<Sequence name="Whip lands on YouTube" from={267} trimBefore={318} durationInFrames={20}>
					<Frame at={[318, 334]} zoom={[1.24, 1.02]} origin={SCREEN} snap>
						<Footage look="screen" burst={[306, 318, 333]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Whip lands on YouTube captions" style={CAPTIONS} captions={[
						{ text: "it", startMs: 10600, endMs: 11267, timestampMs: 10933, confidence: null },
					]} />
				</Sequence>
				{/* Silent here: the voice over this shot is on the Lifted voice track. */}
				<Sequence name="Blurred thumbnails" from={287} trimBefore={338} durationInFrames={40}>
					<Frame at={[338, 378]} zoom={[1.02, 1.1]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
				</Sequence>
				<Sequence name="Choose" from={327} trimBefore={446} durationInFrames={17}>
					<Frame at={[446, 460]} zoom={[1.25, 1.55]} origin={DIALOG} snap>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Choose captions" style={CAPTIONS} captions={[
						{ text: "Choose", startMs: 15060, endMs: 15433, timestampMs: 15247, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Filters, click" from={344} trimBefore={474} durationInFrames={50}>
					<Frame at={[474, 524]} zoom={[1.55, 1.66]} origin={DIALOG}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Filters, click captions" style={CAPTIONS} captions={[
						{ text: "filters", startMs: 15800, endMs: 16020, timestampMs: 15910, confidence: null },
						{ text: " that", startMs: 16020, endMs: 16340, timestampMs: 16180, confidence: null },
						{ text: " you", startMs: 16340, endMs: 16440, timestampMs: 16390, confidence: null },
						{ text: " want", startMs: 16440, endMs: 16580, timestampMs: 16510, confidence: null },
						{ text: " to", startMs: 16580, endMs: 16700, timestampMs: 16640, confidence: null },
						{ text: " apply", startMs: 16700, endMs: 17467, timestampMs: 17083, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Watch with those filters" from={394} trimBefore={524} durationInFrames={69}>
					<Frame at={[524, 593]} zoom={[1.06, 1.14]} origin={SCREEN}>
						<Footage look="screen" burst={[572, 582, 592]} />
					</Frame>
					<Voice />
					<ReelCaptions name="Watch with those filters captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 17580, endMs: 17820, timestampMs: 17700, confidence: null },
						{ text: " just", startMs: 17820, endMs: 18020, timestampMs: 17920, confidence: null },
						{ text: " watch", startMs: 18020, endMs: 18440, timestampMs: 18230, confidence: null },
						{ text: " it", startMs: 18440, endMs: 18680, timestampMs: 18560, confidence: null },
						{ text: " with", startMs: 18680, endMs: 19000, timestampMs: 18840, confidence: null },
						{ text: " those", startMs: 19000, endMs: 19180, timestampMs: 19090, confidence: null },
						{ text: " filters", startMs: 19180, endMs: 19767, timestampMs: 19473, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Xenia up here" from={463} trimBefore={603} durationInFrames={57}>
					<Frame at={[603, 660]} zoom={[1.1, 1.16]} origin={XENIA}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Xenia up here captions" style={CAPTIONS} captions={[
						{ text: "Xenia", startMs: 20520, endMs: 20680, timestampMs: 20600, confidence: null },
						{ text: " up", startMs: 20680, endMs: 20820, timestampMs: 20750, confidence: null },
						{ text: " here", startMs: 20820, endMs: 21240, timestampMs: 21030, confidence: null },
						{ text: " our", startMs: 21240, endMs: 21290, timestampMs: 21265, confidence: null },
						{ text: " AI", startMs: 21280, endMs: 22000, timestampMs: 21640, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Pre-scans" from={520} trimBefore={660} durationInFrames={51}>
					<Frame at={[660, 711]} zoom={[1.3, 1.36]} origin={PRESCAN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Pre-scans captions" style={CAPTIONS} captions={[
						{ text: "pre-scans", startMs: 22120, endMs: 22380, timestampMs: 22250, confidence: null },
						{ text: " the", startMs: 22380, endMs: 22580, timestampMs: 22480, confidence: null },
						{ text: " following", startMs: 22580, endMs: 22820, timestampMs: 22700, confidence: null },
						{ text: " 10", startMs: 22820, endMs: 23120, timestampMs: 22970, confidence: null },
						{ text: " seconds", startMs: 23120, endMs: 23700, timestampMs: 23410, confidence: null },
					]} />
				</Sequence>
				{/* Sintel: the blur lands as he says "first 40 seconds". */}
				<Sequence name="In this Blender movie" from={571} trimBefore={949} durationInFrames={96}>
					<Frame at={[949, 1045]} zoom={[1, 1.08]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="In this Blender movie captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 31633, endMs: 31820, timestampMs: 31727, confidence: null },
						{ text: " so", startMs: 31820, endMs: 31980, timestampMs: 31900, confidence: null },
						{ text: " for", startMs: 31980, endMs: 32140, timestampMs: 32060, confidence: null },
						{ text: " example", startMs: 32140, endMs: 32380, timestampMs: 32260, confidence: null },
						{ text: " in", startMs: 32380, endMs: 32740, timestampMs: 32560, confidence: null },
						{ text: " this", startMs: 32740, endMs: 32900, timestampMs: 32820, confidence: null },
						{ text: " Blender", startMs: 32900, endMs: 33180, timestampMs: 33040, confidence: null },
						{ text: " movie", startMs: 33180, endMs: 33440, timestampMs: 33310, confidence: null },
						{ text: " there's", startMs: 33440, endMs: 33860, timestampMs: 33650, confidence: null },
						{ text: " been", startMs: 33860, endMs: 34020, timestampMs: 33940, confidence: null },
						{ text: " a", startMs: 34020, endMs: 34160, timestampMs: 34090, confidence: null },
						{ text: " lot", startMs: 34160, endMs: 34280, timestampMs: 34220, confidence: null },
						{ text: " of", startMs: 34280, endMs: 34400, timestampMs: 34340, confidence: null },
						{ text: " violence", startMs: 34400, endMs: 34833, timestampMs: 34617, confidence: null },
					]} />
				</Sequence>
				<Sequence name="First 40 seconds" from={667} trimBefore={1045} durationInFrames={41}>
					<Frame at={[1045, 1086]} zoom={[1.14, 1.2]} origin={SCREEN}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="First 40 seconds captions" style={CAPTIONS} captions={[
						{ text: "in", startMs: 34833, endMs: 35320, timestampMs: 35077, confidence: null },
						{ text: " the", startMs: 35320, endMs: 35460, timestampMs: 35390, confidence: null },
						{ text: " first", startMs: 35460, endMs: 35620, timestampMs: 35540, confidence: null },
						{ text: " 40", startMs: 35620, endMs: 35940, timestampMs: 35780, confidence: null },
						{ text: " seconds", startMs: 35940, endMs: 36200, timestampMs: 36070, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Blur hits" from={708} trimBefore={1086} durationInFrames={16}>
					<Frame at={[1088, 1100]} zoom={[1.2, 1.34]} origin={SCREEN} snap>
						<Footage look="screen" burst={[1088, 1092, 1102]} />
					</Frame>
					<Voice />
				</Sequence>
				<Sequence name="And" from={724} trimBefore={1113} durationInFrames={17}>
					<Frame at={[1113, 1130]} zoom={[1.12, 1.14]} origin={BLUR}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="And captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 37190, endMs: 37667, timestampMs: 37428, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Nicely blurred" from={741} trimBefore={1141} durationInFrames={52}>
					<Frame at={[1141, 1193]} zoom={[1.26, 1.36]} origin={BLUR}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Nicely blurred captions" style={CAPTIONS} captions={[
						{ text: "that", startMs: 38033, endMs: 38240, timestampMs: 38137, confidence: null },
						{ text: " gets", startMs: 38240, endMs: 38440, timestampMs: 38340, confidence: null },
						{ text: " nicely", startMs: 38440, endMs: 39330, timestampMs: 38885, confidence: null },
						{ text: " blurred", startMs: 39330, endMs: 39767, timestampMs: 39548, confidence: null },
					]} />
				</Sequence>
				<Sequence name="And hidden" from={793} trimBefore={1201} durationInFrames={20}>
					<Frame at={[1201, 1221]} zoom={[1.4, 1.44]} origin={BLUR}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="And hidden captions" style={CAPTIONS} captions={[
						{ text: "and", startMs: 40033, endMs: 40240, timestampMs: 40137, confidence: null },
						{ text: " hidden", startMs: 40240, endMs: 40700, timestampMs: 40470, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Watching with kids" from={813} trimBefore={1235} durationInFrames={42}>
					<Frame at={[1235, 1277]} zoom={[1.16, 1.22]} origin={BLUR}>
						<Footage look="screen" />
					</Frame>
					<Voice />
					<ReelCaptions name="Watching with kids captions" style={CAPTIONS} captions={[
						{ text: "in", startMs: 41167, endMs: 41360, timestampMs: 41263, confidence: null },
						{ text: " case", startMs: 41360, endMs: 41480, timestampMs: 41420, confidence: null },
						{ text: " you're", startMs: 41480, endMs: 41700, timestampMs: 41590, confidence: null },
						{ text: " watching", startMs: 41700, endMs: 41960, timestampMs: 41830, confidence: null },
						{ text: " with", startMs: 41960, endMs: 42160, timestampMs: 42060, confidence: null },
						{ text: " kids", startMs: 42160, endMs: 42567, timestampMs: 42363, confidence: null },
					]} />
				</Sequence>
				<Sequence name="Video returns" from={855} trimBefore={1292} durationInFrames={26}>
					<Frame at={[1292, 1318]} zoom={[1.06, 1.1]} origin={SCREEN}>
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

			{/* "Press play" is lifted from a later moment, to sit over him clicking the thumbnail. */}
			<Track name="Lifted voice">
				<Sequence name="Press play" from={301} trimBefore={404} durationInFrames={22}>
					<Voice />
					<ReelCaptions name="Press play captions" style={CAPTIONS} captions={[
						{ text: "press", startMs: 13500, endMs: 13740, timestampMs: 13620, confidence: null },
						{ text: " play", startMs: 13740, endMs: 14200, timestampMs: 13970, confidence: null },
					]} />
				</Sequence>
			</Track>

			{/* Sintel is CC BY, which requires this credit. */}
			<Track name="Credit">
				<Sequence name="Sintel credit" from={571} durationInFrames={310}>
					<div
						style={{
							position: 'absolute',
							top: 150,
							left: 70,
							color: '#fff',
							fontFamily: FONT_FAMILY,
							fontSize: 30,
							fontWeight: 500,
							textShadow: '0 2px 10px rgb(0 0 0 / 0.8)',
						}}
					>
						Sintel © Blender Foundation, CC BY
					</div>
				</Sequence>
			</Track>

			<Track name="Light leaks">
				<Sequence name="Leak on whip" from={255} durationInFrames={40}>
					<Leak duration={40} seed={3} />
				</Sequence>
				<Sequence name="Leak into end card" from={868} durationInFrames={30}>
					<Leak duration={30} seed={5} />
				</Sequence>
			</Track>

			<Track name="End card">
				<Sequence name="End card" from={875} durationInFrames={90}>
					<FadeIn frames={10}>
						<EndCard allWhite />
					</FadeIn>
				</Sequence>
			</Track>

			<Track name="Sound effects">
				<Audio name="Whip" src="https://remotion.media/whoosh.wav" from={253} volume={0.4} />
				<Audio name="Click on thumbnail" src="https://remotion.media/mouse-click.wav" from={321} volume={0.5} />
				<Audio name="Click on Watch with filters" src="https://remotion.media/mouse-click.wav" from={390} volume={0.5} />
				<Audio name="Whip to Xenia" src="https://remotion.media/whoosh.wav" from={440} volume={0.25} />
				<Audio name="Blur hits" src="https://remotion.media/whip.wav" from={710} volume={0.45} />
				<Audio name="Into end card" src="https://remotion.media/whoosh.wav" from={868} volume={0.3} />
				<Audio name="End card" src="https://remotion.media/ding.wav" from={886} volume={0.2} />
			</Track>
		</AbsoluteFill>
	);
};
