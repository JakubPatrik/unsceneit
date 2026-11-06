# unscene.it marketing pipeline: blueprint

How the automated social pipeline works, for anyone changing it or running it. Setup commands are in [pipeline/README.md](pipeline/README.md). The agent's run instructions are in [pipeline/PIPELINE_AGENT_PROMPT.md](pipeline/PIPELINE_AGENT_PROMPT.md). Open work is in [TODO.md](TODO.md).

[STORY.md](../STORY.md) is the source of truth for every claim and for positioning. If this file and STORY.md disagree about the product, STORY.md wins.

## Overview

```
┌────────────────────────────────────────────────────────┐
│ 1. Research (agent, AdKit MCP, read-only)              │
│    Competitor angles -> pipeline/research/hooks.json   │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Write (agent)                                       │
│    New creatives -> pipeline/content/creatives.json    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Lint (claims.py)                                    │
│    STORY.md's "Claims to avoid". Errors block a video  │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Render (Remotion)                                   │
│    1080x1920 MP4s -> pipeline/generated_assets/        │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 5. Host (Supabase Storage)                     --live  │
│    Public URL for Buffer to fetch the video from       │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 6. Send (Buffer GraphQL API)                   --live  │
│    Drafts by default. One post per channel             │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 7. Publish (a human)                                   │
│    In Buffer, or with --mode queue if approved         │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 8. Clean up (cleanup)                                  │
│    Hosted video deleted once Buffer says it's sent     │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│ 9. Convert (already live, not part of the pipeline)    │
│    Site -> Chrome Web Store -> unscene.it/welcome      │
└────────────────────────────────────────────────────────┘
```

Steps 1 and 2 are the agent's judgment. Steps 3 to 6 and 8 are `run_pipeline.py`. Step 7 is always a person's decision.

## Rules

These hold however the pipeline is run.

- **A person decides what publishes.** `--live` only creates Buffer drafts. `--mode queue` publishes on Buffer's schedule, and only for creatives with `"approved": true`. The agent never sets `approved` and never uses `--mode queue` unless the founder asks in that session.
- **Claims come from STORY.md.** Lint errors block a video, and the fix is to rewrite the copy, not to change `claims.py`.
- **Only allowlisted footage.** `content/segments.json` is the only footage a video can use, and lint rejects anything else.
- **No third-party footage.** The promo recordings contain the *28 Years Later* trailer and a Gordon Ramsay clip, which risk copyright claims. Segments must also keep out the founder's facecam.
- **The screen must match the line.** That includes the cursor: don't pair "Xenia can screen it live" with a cursor on "Watch unfiltered".
- **Never post twice.** `ledger.json` records every post, and anything in it is skipped. Failed mutations aren't retried automatically, because a timeout can hide a post that was created.
- **Delete only after `sent`.** See Host and clean up.
- **The right account only.** Every channel ID is checked against the Buffer organization and network before anything is sent. The AdKit plan allows one project, so research uses the existing EligioAI project, read-only: never add to its watchlist or boards.
- **Paid ads and direct posting are out of scope.** AdKit is read-only library research. Reddit stays manual (see `reddit/`).

## Stages

### 1. Research

The agent uses `adkit_library` and records angles and patterns in `research/hooks.json`, under `ads_reviewed`. It takes the angle and writes its own wording, and it never invents ad data. If the library fails, it carries on from the existing angles and says so.

What's worked so far: find an advertiser with `entity: "advertisers"`, then search its ads with `advertiserId` and `sort: "spend"`, and open the best with `action: "get"`. Free-text ad search timed out every time on Nov 5, 2026, and `analyze` failed on AdKit's side, so review video from frames of the ad's `mediaUrl`.

AdKit shows paid ads on Meta, Google and LinkedIn, not organic posts, and has few direct competitors in it. Organic research is separate: YouTube Studio data first, then Shorts and TikTok search by hand. `organic_references` in `hooks.json` holds what's been learned.

AdKit is only reachable through its MCP tools, so this step belongs to the agent and not the script. AdKit showed no video generation, which is why rendering is separate.

### 2. Write

`content/creatives.json` holds each creative:

```json
{
  "id": "gore-01",
  "angle": "triggers",
  "audience": "Viewers avoiding blood and gore",
  "approved": false,
  "beats": [{ "segment": "thumbs", "text": "Want the story without the gore?" }],
  "captions": {
    "youtube_title": "...",
    "youtube": "... {link}",
    "tiktok": "...",
    "instagram": "...",
    "twitter": "... {link}"
  }
}
```

- **Beats:** one footage segment with one line of text, up to 64 characters. The first beat is the hook.
- **`{link}`:** expands to the homepage with UTM tags (`utm_source`, `utm_medium=social`, `utm_campaign`, `utm_content`). Use it on YouTube and X. TikTok and Instagram captions name unscene.it instead, since links there aren't clickable.
- **Ids:** a new version gets a new `id`, because the ledger tracks posts by id.

**Positioning:** lead with personal scene filtering. "Distraction-free focus" is Unhook's position, not ours. Describe the Sensual & revealing filter as covering revealing and sexualized content, without singling out dancing.

### 3. Lint

`claims.py` checks copy, overlay length, caption limits (counted in UTF-16, as Buffer does) and footage against the allowlist. Errors block a creative. Warnings print for the reviewer. Keep it in line with STORY.md as the product changes, for example when Pro launches.

### 4. Render

The Remotion project in `remotion/` turns every creative into a composition automatically, and reads the same `creatives.json` and `segments.json`. It uses Eligio's setup and versions.

- **Output:** 1080x1920, H.264, yuv420p, 30 fps, with a silent audio track. `render.py` validates each file.
- **Layout:** logo and text on top, footage from y=600, and the bottom left clear for platform UI.
- **Crops:** shots of the browser window must include the whole toolbar, because the extension icon lives there. Dialog close-ups start after the recording's zoom finishes, so the toolbar is fully out of frame. The push-in is anchored to the top and only zooms in, so nothing outside a crop can appear.
- **Skipping:** a fingerprint of the beats, segments and Remotion source means unchanged videos aren't rendered again.
- **Footage:** `data/*.mp4` is gitignored, so it only exists on the founder's machine. `scripts/link-footage.mjs` hard-links it into `public/footage/`, since Remotion doesn't serve symlinks.

### 5 and 8. Host and clean up

Buffer has no upload endpoint: it fetches the file from a public URL **when the post goes out**. The URL is only a pickup point, and the video ends up hosted on the platform.

- **Upload:** to the public `marketing-media` bucket in the unscene.it Supabase project, created on first upload. The name includes a content hash, so a re-render can't change the file behind a queued post. Every URL is checked before use: public, direct, HTTPS, and a video.
- **Delete:** `cleanup` deletes a file only when Buffer reports every post of that creative as `sent`, and no configured platform is still waiting for it. Drafts and queued posts keep theirs. Nothing runs in the background, so a post published later waits for the next `cleanup` or `run --live`.
- **Later platforms:** adding one uploads the video again if needed.
- **Alternative:** `MEDIA_BASE_URL` points at a host you sync yourself. Files there are never deleted.

### 6. Send

`buffer_api.py` calls `https://api.buffer.com` with `Authorization: Bearer <key>`. GraphQL reports most failures with HTTP 200, so the client reads `errors` and typed mutation errors.

Each post is a `createPost` per channel, with `schedulingType: automatic` and `mode: addToQueue`, plus `saveToDraft: true` unless using `--mode queue`. Platforms with no channel ID are skipped.

| Platform | Buffer service | Extra input |
|---|---|---|
| YouTube Shorts | `youtube` | `title`, `categoryId` 28, `madeForKids: false` |
| TikTok | `tiktok` | Cover frame at 1.5s |
| Instagram Reels | `instagram` | `type: reel`, `shouldShareToFeed: true`, cover frame at 1.5s |
| X | `twitter` | None |

`madeForKids` stays false: the audience is adults choosing filters, parents included.

### 7. Publish

Open the draft in Buffer, check the video, title and description, and publish. Or set `"approved": true` and use `queue --live --mode queue` for creatives that have no draft yet. A creative already sent as a draft is skipped by that command, so schedule that draft in Buffer.

### 9. Convert

The pipeline doesn't touch this part. Social links go to the homepage, whose buttons go to the Chrome Web Store. The extension opens `unscene.it/welcome/` once after install, with setup steps and the waitlist form. Don't use `/welcome` as a call to action: it isn't indexed and assumes the extension is installed.

## Layout

```
marketing/
├── AGENT.md                     This blueprint
├── TODO.md                      Open work
├── pipeline/
│   ├── run_pipeline.py          CLI and stage logic
│   ├── claims.py                Copy lint
│   ├── render.py                Calls Remotion, validates output
│   ├── hosting.py               Supabase upload, delete, URL checks
│   ├── buffer_api.py            Buffer client and post input
│   ├── content/creatives.json   Copy, approval
│   ├── content/segments.json    Footage allowlist and crops
│   ├── research/hooks.json      Angles and competitor research
│   ├── ledger.json              What's been hosted and sent (keep in git)
│   ├── PIPELINE_AGENT_PROMPT.md The agent's run instructions
│   └── generated_assets/        Rendered videos (gitignored)
├── remotion/
│   └── src/social-clip/         The video: layout, motion, theme
├── scripts/                     Scripts for videos recorded by hand
└── reddit/                      Manual Reddit plan and drafts
```

## Commands

Run from `marketing/pipeline/`, with `.venv/bin/python run_pipeline.py <command>`:

| Command | Does | Leaves the machine? |
|---|---|---|
| `check` | Reports tools, footage and credentials | Read-only Buffer lookup |
| `channels` | Lists Buffer organization and channel IDs | Read-only Buffer lookup |
| `lint` | Checks copy | No |
| `render` | Renders changed videos | No |
| `upload` | Hosts rendered videos | **Yes, files become public** |
| `queue` | Prints what would be sent | No |
| `queue --live` | Creates Buffer drafts | **Yes** |
| `queue --live --mode queue` | Queues approved creatives | **Yes, publishes** |
| `run` | Lint and render, then prints the plan | No |
| `run --live` | Adds upload, drafts and cleanup | **Yes** |
| `status` | Shows asset, platform, status, next time | Read-only Buffer lookup |
| `cleanup` | Deletes hosted videos whose posts are `sent` | **Yes, deletes files** |

Add `--only <id>` to limit `lint`, `render`, `upload`, `queue` or `run` to one creative.

## Configuration

`pipeline/.env.pipeline` is gitignored, and `.env.pipeline.example` lists every value:

- **`BUFFER_API_KEY`, `BUFFER_ORG_ID`:** Buffer access.
- **`BUFFER_CHANNEL_YOUTUBE`, `_TIKTOK`, `_INSTAGRAM`, `_X`:** leave a platform empty to skip it.
- **`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_BUCKET`:** hosting. The secret key has full access to the project, including waitlist data, so it stays in this file only.
- **`MEDIA_BASE_URL`:** optional, replaces Supabase.

## What's been tested live

The full path has run once, on YouTube: Supabase upload, Buffer draft, publishing from Buffer, `status` and `cleanup`.

Not tried yet: TikTok, Instagram, X, and `--mode queue`. Send a single creative first when adding any of them.
