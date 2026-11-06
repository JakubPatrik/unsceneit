import type { Caption } from '@remotion/captions';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { lightLeak } from '@remotion/effects/light-leak';
import React, { useMemo } from 'react';
import {
	AbsoluteFill,
	Easing,
	Interactive,
	Solid,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
	type InteractiveTransformProps,
	type InteractivitySchema,
} from 'remotion';
import { CLAMP, FONT_FAMILY, color } from './social-clip/theme';

/**
 * Parts shared by the hand-edited reels. The recipe is in
 * marketing/scripts/reel-editing-playbook.md.
 */

/**
 * Zooms its children from `zoom[0]` to `zoom[1]` over `at`, in source frames.
 * Drifts are linear; `snap` eases out, for moves the viewer should notice.
 */
export const Frame: React.FC<{
	readonly at: readonly [number, number];
	readonly zoom: readonly [number, number];
	readonly origin: string;
	readonly snap?: boolean;
	readonly children: React.ReactNode;
}> = ({ at, zoom, origin, snap, children }) => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill
			style={{
				transformOrigin: origin,
				scale: interpolate(frame, at, zoom, {
					...CLAMP,
					easing: snap ? Easing.bezier(0.16, 1, 0.3, 1) : undefined,
				}),
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

/** A purple light sweep over a transition. */
export const Leak: React.FC<{ readonly duration: number; readonly seed: number }> = ({
	duration,
	seed,
}) => {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	return (
		<Solid
			width={width}
			height={height}
			effects={[
				lightLeak({
					seed,
					// Rotates down from the default orange, so this lands on brand purple.
					hueShift: 145,
					progress: interpolate(frame, [0, duration - 1], [0, 1], CLAMP),
				}),
			]}
		/>
	);
};

export const FadeIn: React.FC<{
	readonly frames: number;
	readonly children: React.ReactNode;
}> = ({ frames, children }) => {
	const frame = useCurrentFrame();
	return (
		<AbsoluteFill
			style={{
				opacity: interpolate(frame, [0, frames], [0, 1], CLAMP),
				fontFamily: FONT_FAMILY,
				color: '#fff',
			}}
		>
			{children}
		</AbsoluteFill>
	);
};

type ReelCaptionsProps = InteractiveTransformProps & {
	readonly captions: Caption[];
};

const reelCaptionsSchema = {
	...Interactive.captionsSchema,
} as const satisfies InteractivitySchema;

/**
 * Word-by-word captions: white text on a dark box, so they stay readable over a
 * white blur, with the spoken word on a purple pill. Timestamps are source time,
 * matching the clock inside a trimmed <Sequence>.
 */
const ReelCaptionsContent: React.FC<ReelCaptionsProps> = ({ captions, style }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const pages = useMemo(
		() =>
			createTikTokStyleCaptions({
				captions,
				combineTokensWithinMilliseconds: 900,
			}).pages,
		[captions],
	);
	const nowMs = (frame / fps) * 1000;
	const page = pages.find(
		(candidate) => nowMs >= candidate.startMs && nowMs < candidate.startMs + candidate.durationMs,
	);

	return (
		<div
			style={{
				position: 'absolute',
				display: 'flex',
				justifyContent: 'center',
				width: 840,
				...style,
			}}
		>
			{page ? (
				<div
					style={{
						padding: '14px 18px',
						borderRadius: 26,
						backgroundColor: 'rgb(9 10 16 / 0.78)',
						color: '#fff',
						fontFamily: FONT_FAMILY,
						fontSize: 68,
						fontWeight: 700,
						letterSpacing: '-0.02em',
						lineHeight: 1.28,
						textAlign: 'center',
						textWrap: 'balance',
						scale: interpolate(nowMs - page.startMs, [0, 120], [0.94, 1], CLAMP),
					}}
				>
					{page.tokens.map((token) => (
						<React.Fragment key={token.fromMs}>
							<span
								style={{
									padding: '2px 8px',
									borderRadius: 16,
									whiteSpace: 'nowrap',
									backgroundColor:
										nowMs >= token.fromMs && nowMs < token.toMs ? color.xenia : 'transparent',
								}}
							>
								{token.text.trim()}
							</span>{' '}
						</React.Fragment>
					))}
				</div>
			) : null}
		</div>
	);
};

export const ReelCaptions = Interactive.create({
	Component: ReelCaptionsContent,
	componentName: '<ReelCaptions>',
	schema: reelCaptionsSchema,
});
