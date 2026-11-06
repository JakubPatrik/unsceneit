# Marketing TODO

Where marketing stands, and what's next. As of Nov 5, 2026.

**Working:** the pipeline in `pipeline/` and the videos in `remotion/`. Six videos are rendered. `personal-01` is live on YouTube, sent through the full path: Supabase, Buffer draft, publish, cleanup.

## 1. Finish the first batch

- [ ] Send the other five to YouTube, spaced out so they can be compared: `gore-01`, `liveai-01`, `modest-01`, `parents-01`, `spiders-01`. Use `run --live --only <id>`, or `run --live` for all five.
- [ ] Run `cleanup` after each one publishes. Hosted videos stay in Supabase until then.
- [ ] Decide on the cursor in `modest-01` and `spiders-01`: the line talks about one filter while the cursor is near "Blood & gore". Fix by finding a better moment in the footage, or leave it.
- [ ] Decide on sound. The videos are silent, so try music on one and compare.

## 2. Measure

Do this before making more videos, or the next batch is guesswork.

- [ ] Confirm where the UTM tags show up (`utm_source`, `utm_campaign`, `utm_content`), on the site and in the Chrome Web Store dashboard. Not checked yet.
- [ ] Note the starting numbers: installs, waitlist signups, YouTube views.
- [ ] After the batch has been up about a week, compare the angles. Which hook gets watched through, and which brings visits?

## 3. Add platforms

Add one at a time, and send a single video first, since none of these have been tried yet.

- [ ] TikTok: connect in Buffer, add `BUFFER_CHANNEL_TIKTOK`, put unscene.it in the bio.
- [ ] Instagram Reels: same, with `BUFFER_CHANNEL_INSTAGRAM`.
- [ ] X: same, with `BUFFER_CHANNEL_X`.

Videos already sent to YouTube get uploaded again for the new platform, and `run --live` then sends them only there.

## 4. Competitor research

First pass done on Nov 5, 2026, saved in `pipeline/research/hooks.json`. The main finding: BePresent's top ads are founders telling a personal story on camera, while ours are product demos.

- [ ] Shorts and TikTok search by hand: your audience's terms, looking for videos far above their channel's usual views. AdKit doesn't cover organic.
- [ ] Re-check AdKit later. Free-text ad search timed out, and its video analysis failed on AdKit's side.

## 5. Next batch

- [ ] Record the founder video on your phone, using `scripts/founder-story-01.md`.
- [ ] Add a talking-head video type to Remotion, with word-by-word captions, product cuts and the end card.
- [ ] Find 5 to 10 small creators in the phobia, parenting or modest-viewing spaces who might genuinely use it. Opal and Tactiq both credit creators for their growth.
- [ ] Pitch the story to writers who cover trigger warnings and family viewing. Does The Dog Die broke out through press like this.
- [ ] Run the agent (`pipeline/PIPELINE_AGENT_PROMPT.md`) for new creatives, doubling down on the angles that worked.
- [ ] Record fresh footage if the angles need it. There's no shot yet of a scene actually being blurred mid-video without third-party footage, which is the product's main moment. It needs footage you're allowed to post.
- [ ] Other formats in `remotion/` as needed, such as a landscape demo or store promo.

## 6. Automate, once the above works

- [ ] Run the agent and `cleanup` on a schedule.
- [ ] Move from Buffer drafts to `--mode queue`, if reviewing every draft becomes the bottleneck. That mode has never been run, so test it on one video.

## 7. Reddit

Still manual, on purpose. See `reddit/REDDIT_MARKETING_PLAN.md`, `REDDIT_WARMUP_COMMENTS.md` and `REDDIT_POST_DRAFTS.md`.

- [ ] Continue the warm-up, then post the drafts. The drafts and plan predate these video changes, so check them against `STORY.md` first.

## Housekeeping

- [ ] `STORY.md` still lists suggestive dancing under the Sensual & revealing filter, while ad copy no longer mentions it. Fine if that's only about ads.
