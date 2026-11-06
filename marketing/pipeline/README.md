# unscene.it social pipeline

Turns product footage and `STORY.md`-approved copy into vertical videos, and sends them to Buffer for YouTube Shorts, TikTok, Instagram Reels and X. [../AGENT.md](../AGENT.md) is the blueprint for how it all works and why. This file covers setup and day-to-day use.

```
1. Research   AdKit MCP, read-only -> research/hooks.json        (agent)
2. Write      content/creatives.json                             (agent)
3. Lint       claims.py enforces STORY.md's "Claims to avoid"
4. Render     1080x1920 MP4s in generated_assets/ (../remotion)
5. Host       public URL in Supabase Storage                     --live
6. Buffer     drafts by default                                  --live
7. Publish    a human approves, in Buffer or with --mode queue
8. Clean up   hosted video deleted once Buffer reports it sent
9. Convert    store install -> unscene.it/welcome (already live, no changes needed)
```

## Setup

```bash
cd marketing/pipeline
uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt
(cd ../remotion && npm i --loglevel=error)
cp .env.pipeline.example .env.pipeline   # Then fill it in.
.venv/bin/python run_pipeline.py check
```

Needs Node, ffprobe and `data/promo-video-1.mp4`, which is gitignored and so only exists on your machine.

To go live you also need to:

1. Connect the unscene.it channels in Buffer and create an API key at https://publish.buffer.com/settings/api.
2. Run `run_pipeline.py channels` and copy the IDs into `.env.pipeline`. Platforms left empty are skipped.
3. Add your Supabase secret key to `.env.pipeline`. The public `marketing-media` bucket is created on the first upload.
4. Research needs the AdKit connector available to the agent. It uses the one AdKit project on the plan (EligioAI), read-only.
5. Add unscene.it to your TikTok and Instagram bios, since links in those captions aren't clickable.

## Running it

```bash
.venv/bin/python run_pipeline.py run                  # Lint, render, print the plan. Sends nothing.
.venv/bin/python run_pipeline.py run --live           # Also host the videos and create Buffer drafts.
.venv/bin/python run_pipeline.py status               # Asset, platform, status, next posting time.
```

Other commands: `check`, `channels`, `lint`, `render`, `upload`, `queue`, `cleanup`. Add `--only <id>` to limit one to a creative, except `check`, `channels`, `status` and `cleanup`.

To run the agent on the whole thing: `claude "$(cat PIPELINE_AGENT_PROMPT.md)"` from this folder.

**Hand-edited videos** such as `social-01` have their own Remotion composition, so their creative has `"hand_edited": true` and no beats. Export the video to `generated_assets/<id>.mp4` yourself, since `render` never touches it. Lint checks only its captions, so a person checks the footage. Send one with `run --only <id> --live`.

## Publishing

| Command | What happens |
|---|---|
| `run` | Nothing leaves your machine |
| `run --live` | Videos become public at their hosting URLs. Buffer gets drafts, and nothing publishes |
| `queue --live --mode queue` | Creatives with `"approved": true` join Buffer's queue and **publish on its schedule** |

The agent never sets `approved` or uses `--mode queue` on its own. You can publish by scheduling the drafts in Buffer, or by setting `"approved": true` and using `--mode queue` for creatives that have no draft yet.

Buffer fetches each video when its post goes out, so the hosted file has to stay until then. `cleanup` deletes it only after Buffer reports every post of that creative as `sent`, and only if no configured platform is still waiting for it. `run --live` also cleans up at the end, but a post published after that needs another `cleanup` run. Adding a platform later uploads the video again if needed.

`ledger.json` records everything sent, so re-running never posts twice. Keep it in git. A creative already sent as a draft is skipped by `--mode queue` too: schedule that draft in Buffer. To post a changed version, give it a new `id`.

## Editing

- **Copy:** `content/creatives.json`. Each beat is one footage segment with one line of text (up to 64 characters).
- **Footage:** `content/segments.json` is an allowlist, so lint rejects any other segment. Check a new segment's first, middle and last frames, because cuts to other clips can sit right next to product footage.
- **Look and motion:** `../remotion/src/social-clip/`. Preview with `npm run dev` in `../remotion`. Any change there re-renders the videos on the next run.
- **Claim rules:** `claims.py`. Keep it in line with `STORY.md` when the product changes, for example when Pro launches.
- **Tests:** `.venv/bin/python -m unittest discover tests`. They run offline.

Videos are silent because the source audio is a voice-over for the long demo. Adding trending audio in the TikTok or Instagram app before publishing a draft will likely help reach.

## What's been tested for real

The full path has run live once, on YouTube: Supabase upload, Buffer draft, publishing from Buffer, `status` and `cleanup`. TikTok, Instagram and X haven't been tried, and neither has `--mode queue`, so send one creative first when adding any of them. `status` may show last-known values for drafts if Buffer's posts query leaves them out.
