# Reel editing playbook

How `social-01` was edited from a raw iPhone recording. The founder liked the result, so repeat this style on new recordings. [`Social01.tsx`](../remotion/src/Social01.tsx) is the working reference: copy it and replace the shot list. The zooms, light leaks, fade and word-by-word captions are shared, in [`reel-parts.tsx`](../remotion/src/reel-parts.tsx).

To send a finished reel, export it to `pipeline/generated_assets/<id>.mp4` once approved, add a `"hand_edited": true` creative with captions to `pipeline/content/creatives.json`, then run `run --only <id> --live`. See [pipeline/README.md](../pipeline/README.md).

## Order of work

1. **Watch the footage.** Build contact sheets with ffmpeg, then finer ones (4 fps) around the key moments.
2. **Map the speech.** Run silence detection and a word-level transcript.
3. **Cut from the silence map,** then check every kept word against the shots.
4. **Add zooms, grade and voice cleanup.** Then add transitions and sound effects.
5. **Add the end card.**
6. **Add captions last,** once the timing is locked, so they never need retiming.
7. **Review in Remotion Studio.** Don't run any render or still without the founder's approval, including low-res test passes, because they make the Mac very slow.

## Commands

Silence map:

```bash
ffmpeg -i in.wav -af "silencedetect=noise=-35dB:d=0.25" -f null -
```

Transcript, in a throwaway environment so the project gains no dependency. Whisper's packages are already in the `uv` cache, so this should be much quicker than the first run:

```bash
uv run --no-project --with mlx-whisper python run.py   # model: mlx-community/whisper-small.en-mlx, word_timestamps=True
```

Voice cleanup, reaching about -15.6 LUFS in the final mix. It's saved as a separate WAV and played from each shot, with the `<Video>` muted:

```bash
ffmpeg -i public/IN.MOV -vn -ac 1 -ar 48000 -af "highpass=f=85,afftdn=nf=-32:tn=1,acompressor=threshold=-26dB:ratio=3:attack=8:release=140:makeup=4,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000" -c:a pcm_s16le public/IN-voice.wav
```

## The style

**Cuts**
- Remove pauses over about 0.35s and leave about 0.1s around speech. Shorter pauses can stay.
- Remove false starts and restarted sentences.
- Add a zoom change at a natural pause, even where no time is removed, so long takes don't sit still.

**Zooms**
- Alternate wide and tight on each talking-head cut, around 1.0–1.12 and 1.22–1.33, centred on the face.
- Each shot drifts slowly, about 0.03 on a short shot.
- Use eased zooms (`Easing.bezier(0.16, 1, 0.3, 1)`) only for moves the viewer should notice.
- Push in on the UI that matters, up to about 1.6 on a button. Keeping the 4K source means this stays sharp.

**Speed ramps**
- Show the moment that sells the product in real time and speed up around it: 4×, then 2×, then 1× with a zoom and a `zoomBlur` burst, then back to 4×.
- A fast section can't carry voice from the same shot. See "Next recording" below.

**Grade** (`colorCorrection`)
- Face: `temperature -0.03, highlights -0.3, whites -0.15, contrast 1.1, saturation 1.04, vibrance 0.1`.
- Filmed screen: `temperature -0.14, blacks -0.15, highlights -0.15, contrast 1.1, saturation 0.96`.
- These suit that footage, so check them on new footage. Better lighting will need less correction.
- Vignette: a CSS radial gradient above the shots, not an effect on the video, so zooms don't crop it.

**Transitions and sound**
- Whips: exaggerate the real phone movement with a `zoomBlur` burst, a purple `lightLeak` and a whoosh.
- Keep sound effects quiet, at 0.2–0.5 volume: whoosh, click, whip, and a ding on the end card.
- No music is included, because there's no licensed track. Add it in the app when posting, or supply a file.

**End card**
- `<EndCard allWhite />`, from `social-clip/SocialClip.tsx`, in Geist with all text white. It fades in over 10 frames, under a light leak.

## Things that caught us out

- **Font and colour on the end card:** they're inherited from `SocialClip`'s root, so a wrapper must set them or the text turns black and serif.
- **`lightLeak` hue:** `hueShift` runs the opposite way to the docs. 145 is brand purple. 215 is teal and 268 is green.
- **iPhone HDR (10-bit HLG, HEVC):** Chrome tone-maps it correctly, so no converted copy is needed. ffmpeg contact sheets look more washed out than the real render.
- **Frames inside a trimmed `<Sequence>`:** `useCurrentFrame()` returns the source frame, so zoom and burst keyframes are in source frames.
- **Timing with `playbackRate`:** the shot takes `durationInFrames / playbackRate` on the timeline. Keep that a whole number, and update every later `from` plus the duration in `Root.tsx` after any retime.
- **Effects when rendering:** they need `Config.setChromiumOpenGlRenderer("angle")`, already in `remotion.config.ts`.
- **Whisper:** word timings stretch across pauses, so trust the silence map for cut points. It also mishears words, so confirm unclear lines before captioning.

## Next recording

- It should have voiceover throughout, with no silent stretches, and it's intended for posting.
- **Voice over a speed ramp:** `social-01` tied voice to each shot, which works only when the picture and voice share timing. If the founder talks over sped-up footage, put the voice on its own track with its own cuts, and time the picture to it.
- **Check before cutting:** no third-party footage (`marketing/AGENT.md`), and "YouTube in Chrome" stated in the voice or captions so people don't assume Netflix (`founder-story-01.md`).
- **Git:** recordings go in `remotion/public/` and aren't gitignored, so don't commit them.
