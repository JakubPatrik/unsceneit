# SceneMod Backend (Supabase)

The backend for the SceneMod extension: Postgres for skip data, an Edge Function that classifies frames, and later Auth.

```
Chrome / Edge extension                    scripts/classify-video.mjs (trusted, secret key)
   │  publishable key (read-only, RLS)        │  sampled frames
   ▼                                          ▼
Supabase
   ├─ Postgres     content_filters, videos, skip_ranges   ← live
   ├─ Edge Fn      classify-frames → OpenAI Decisions API → skip_ranges   ← deployed
   ├─ Realtime     skip_ranges inserts            ← enabled, not yet used by the extension
   └─ Auth         user sign-in                   ← later
```

The extension is distributed through the browser stores, so the only thing we host is this Supabase project. There's no local setup: everything runs against the hosted project.

## Schema

| Table | Columns | Notes |
|---|---|---|
| `admins` | `user_id` → `auth.users`, `created_at` | Admin accounts. They own the built-in filters and curate the shared library. Today it's the founder's account. `is_admin()` and `is_admin_user(uid)` power the access rules. |
| `content_filters` | `id`, `user_id` (owner), `key`, `label`, `prompt`, `category`, `min_age`, `sort_order`, `created_at` | Filters a viewer can turn on (PRD §2). **Built-ins** belong to an admin; any other filter is private to the user who created it. `key` is a slug such as `gore`, unique **per owner**, so two users can both have a `gore` filter. `prompt` is the yes/no question `classify-frames` asks the Decisions API about each frame. `category` is `age` or `trigger`; `min_age` is set only for age filters. |
| `videos` | `id`, `title`, `youtube_id`, `priority`, `created_at`, plus generated `title_norm` and `title_tsv` | The shared library. A video is found by `youtube_id` (unique, 11 characters) or by its **title**. `title_norm` is the title lowercased with punctuation stripped (`normalize_title`), and `title_tsv` is its full-text form. Both are maintained by Postgres. Higher `priority` wins ties. |
| `skip_ranges` | `id`, `video_id`, `filter_id` → `content_filters.id`, `start_s`, `end_s`, `created_at` | Seconds. Flagged content plays inside `[start_s, end_s)`. Each range has exactly one filter, referenced by **id**, never by key. |

**Filters and overlaps:** ranges with different filters may overlap. For example, a video can have gore from 30 to 45s and 15+ from 35 to 60s. The extension only acts on ranges whose `filter_id` the user enabled in the popup; settings store filter ids. Overlapping enabled ranges chain together, so with both enabled, 30s jumps to 60s.

**Age filters:** an age filter's tag means "unsuitable below `min_age`". Choosing "Under N" in the popup enables every age filter with `min_age >= N`, so Under 12 also covers 15+ and 18+ scenes. Age filters are built-in only.

**Access (RLS), checked against production with simulated users:**

| Caller | Can |
|---|---|
| Anyone (the extension, signed out) | Read built-in filters (without prompts), all videos, and ranges of built-in filters. Nothing else. |
| Signed-in user | All of the above, plus their own filters (see, add, edit, delete), but only **trigger** filters, never age. Sees ranges of their own filters. Can't read prompts or touch built-ins, videos or ranges. |
| Admin | Everything above, plus manage all built-in filters, videos and ranges. Doesn't see other users' private filters. |
| Secret key (`classify-frames`, scripts) | Bypasses RLS. |

Prompts stay server-side: no client can read `prompt`, but users can write their own. `user_id` can't be set by clients; it always defaults to the caller.

**Database functions (RPC):**
- `find_video(p_youtube_id, p_titles)`: the best match for what's playing, returning at the first hit. Returns `{ video, ranges: [{start_s, end_s, filter_id, key}] }`, or null.
  1. **YouTube id:** unique index.
  2. **Exact normalized title:** btree index on `title_norm`. "Sintel!" matches "sintel".
  3. **Library title inside the page title:** every run of up to 12 consecutive words of the page title (`title_spans`) is looked up on the same btree index. So "Tears of Steel – Blender Open Movie (4K)" finds "Tears of Steel". The longest match wins, and titles under 4 characters only match exactly, so "Up" won't match "Wake up call".
- `video_with_ranges(p_video_id)`: the same shape for one video. Used after a manual pick.
- `search_videos(p_query)`: up to 10 videos for the manual pick. It uses full-text search with word prefixes on a GIN index (`title_tsv`), so "tears ste" or "steel tears" finds Tears of Steel. When that finds nothing, it falls back to trigram similarity (`pg_trgm`) for typos.
- `upsert_video(p_title, p_youtube_id)`: the video for an indexing run. It finds it by YouTube id, else by exact normalized title, else creates it. Used by `classify-frames`.
- `replace_skip_ranges(video, filter_ids, from, to, ranges)`: atomically replaces a video's ranges for those filters inside `[from, to)`. Parts of old ranges outside the window are kept. Service role and admins only.

The lookups run with the caller's permissions, so access rules still decide which ranges come back.

**Files:**
- `supabase/migrations/20261011000000_init.sql`: the whole schema (tables, RLS, grants, Realtime publication), plus the `content_filters` rows. Those rows are reference data the popup needs, so they ship to the hosted project too.

`init.sql` is applied to production, so don't edit it any more. Schema changes go in new migrations: run `supabase migration new <name>`, then `backend/scripts/deploy.sh`.

## Edge Function: `classify-frames`

`supabase/functions/classify-frames/` takes frames sampled from a video and does the following:
1. Sends each frame to the [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions) (`POST /v1/decisions`, `gpt-6-luna`). Each request asks one `predicate` question per filter, using `content_filters.prompt`. It asks about every built-in filter, or only the ones listed in `filter_ids`. Questions are named `f0`, `f1`… and mapped back to filter ids, because keys aren't unique across users.
2. Counts a filter as flagged when its probability is at or above `FLAG_THRESHOLD`, which defaults to 0.5. A refusal also counts as flagged, so the scene is skipped.
3. Merges consecutive flagged frames into ranges, one set per filter. Ranges for different filters may overlap.
4. Inserts the ranges into `skip_ranges`, creating the `videos` row if needed. Realtime then broadcasts them.

Each frame needs its own request, because the Decisions API treats all images in one request as shared evidence for every question. The function sends 4 requests at a time and accepts at most 120 frames per call.

**Auth:** `withSupabase({ auth: ["secret"] })`. Only callers with the project's secret key can use it, so holders of the public key can't trigger paid OpenAI calls. When user auth and credits exist, add `@supabase/server`'s signed-in-user auth mode here and charge credits in the function.

**Request:**

```json
{
  "video": { "title": "Sintel", "youtube_id": "eRsGyueVLvQ" },
  "interval_s": 1,
  "filter_ids": ["<content_filters.id>", "..."],
  "persist": true,
  "frames": [{ "t": 30, "image": "data:image/jpeg;base64,..." }]
}
```

The video is found by `youtube_id` (optional) or its title through `upsert_video`, and created if it's new. Use `"video_id": "<uuid>"` instead of `video` for an existing video. **Re-running replaces:** with `persist`, the stretch from the first frame to one interval past the last is re-indexed, so old ranges there are replaced for the filters asked about, never duplicated. Leave out `filter_ids` to evaluate every built-in filter. In live mode, send only the viewer's active filters, since each filter is one more question per frame. Unknown ids get a 400 before any OpenAI call. `"persist": false` makes a dry run: it classifies and returns the results but writes nothing, and `video` isn't required. The debug overlay uses this.

The response lists the filters it asked about, a yes/no per frame and filter id, and the ranges it inserted:

```json
{
  "video_id": "…", "mock": false, "persisted": true, "frames_classified": 2,
  "filters": [{ "id": "<gore id>", "key": "gore", "label": "Blood & gore" }, { "id": "<15 id>", "key": "rated_15", "label": "15+ content" }],
  "decisions": [
    { "t": 30, "filters": { "<gore id>": true, "<15 id>": false }, "probabilities": { "<gore id>": 0.91, "<15 id>": 0.12 } },
    { "t": 31, "filters": { "<gore id>": true, "<15 id>": true },  "probabilities": { "<gore id>": 0.88, "<15 id>": 0.64 } }
  ],
  "ranges": [
    { "filter_id": "<gore id>", "filter_key": "gore", "start_s": 30, "end_s": 32 },
    { "filter_id": "<15 id>", "filter_key": "rated_15", "start_s": 31, "end_s": 32 }
  ]
}
```

**Pure logic:** `ranges.ts` holds the range building, threshold and mock logic. Its tests run under Node, so Deno isn't needed:

```bash
node --experimental-strip-types --test backend/supabase/functions/classify-frames/ranges.test.ts
```

### Classifying a video into the library

```bash
node backend/scripts/classify-video.mjs ~/Movies/sintel.mp4 \
  --title "Sintel" --youtube eRsGyueVLvQ \
  --every 1 --start 0 --duration 60
```

The script needs a working `ffmpeg` and the linked Supabase CLI. It samples one 512px JPEG every `--every` seconds and sends the frames to the production function in batches of 30. The flagged ranges land in the shared library. It gets the URL from the linked project, and the secret key from `supabase projects api-keys --reveal` or `$SUPABASE_SECRET_KEY`. Afterwards, any viewer of that video with matching filters enabled gets those scenes handled.

**Cost control:** keep `--duration` short while testing. Each sampled frame is one paid Decisions request, priced on input tokens only. `MOCK_DECISIONS` exists in the function for testing, but `deploy.sh` refuses to deploy it.

**Re-indexing:** running it again for the same video replaces the old ranges for the analysed stretch. Batches cover separate stretches, so they don't wipe each other.

## Performance

Benchmarked on production (2026-10-14) with 50,000 videos, inside a rolled-back transaction. Times are database-side, averaged over 300 calls (50 for the slow cases). Each call from the extension also pays a network round trip to ca-central-1, and lookups are cached for 5 minutes.

| Call | Time | Index used |
|---|---|---|
| `find_video` by YouTube id | 0.1 ms | `videos_youtube_id_key` |
| `find_video` exact title ("big buck bunny!") | 0.2 ms | `videos_title_norm_idx` |
| `find_video` title inside page title ("Tears of Steel – Blender Open Movie (4K)") | 0.5 ms | `videos_title_norm_idx`, about 28 word-span probes |
| `find_video` miss (the common case) | 0.5 ms | same |
| `search_videos` ("tears ste", "steel tears") | 2.7 ms | `videos_title_tsv_idx` (GIN) |
| `search_videos` typo fallback ("tears of steal") | 12 ms | `videos_title_norm_trgm_idx` (GIN) |
| `search_videos` worst case ("film", matching all 50k) | 31 ms | GIN, then sorting every match |

An earlier version that used trigram word similarity for "title inside page title" timed out at this size, because that operator can't use the index from the column side. The word-span approach replaced it.

## Deploying to a hosted project

Production is the **SceneMod** project (`sankeqoeuociotbufbsb`, ca-central-1), and `extension/config.js` points to it.

**One-time setup** (in `backend/`):

```bash
supabase login
supabase link --project-ref sankeqoeuociotbufbsb
```

**Every deploy:**

```bash
backend/scripts/deploy.sh            # migrations + secrets + function + smoke test
backend/scripts/deploy.sh --skip-db  # same, without supabase db push
```

The script runs these steps:
1. Applies pending migrations with `supabase db push`. This asks for the database password unless `SUPABASE_DB_PASSWORD` is set.
2. Uploads the Edge Function secrets from `supabase/functions/.env`. It refuses to run if `OPENAI_API_KEY` is empty or `MOCK_DECISIONS=true`, so mock mode never reaches production.
3. Deploys `classify-frames`.
4. Smoke-tests with requests that make no OpenAI calls and cost nothing:
   - the secret key reaches the function (400 on an empty body)
   - the publishable key is refused (401)
   - presets are readable with the publishable key
5. Prints the URL and publishable key for `extension/config.js`.

The hosted project gets the schema and the `content_filters` presets, but no videos.

**AI analysis is server-side only for now.** The function accepts only the project's secret key, which must never ship in the extension. So store builds can't call it until sign-in exists. The debug modes work only in an unpacked dev build (see Debug modes). To classify videos into the library, use `scripts/classify-video.mjs` from your machine. Get the secret key with `supabase projects api-keys --reveal`; without `--reveal`, the CLI returns it masked. Letting extension users call the AI needs sign-in and credits first.

## Extension tests

The extension's logic lives in `extension/logic.js`, which doesn't use `chrome.*` or the DOM. That covers skip resolution (including overlapping ranges), movie matching, age presets, seek clamping and video picking. Its tests use Node's built-in test runner and need no install:

```bash
node --test extension/tests/*.test.js    # from the repo root
```

Leave `extension/tests/` out of the store package.

## Key handling

| Key | Where it may live |
|---|---|
| Publishable (`sb_publishable_…`) | Extension. It's public, and RLS limits what it can do. |
| Secret (`sb_secret_…`) | Edge Functions and your machine only: `extension/config.dev.js` for your unpacked dev build, which is gitignored and never packaged. Never in the store build. |
| OpenAI API key | `supabase/functions/.env` on your machine (gitignored), uploaded as an Edge Function secret by `deploy.sh`. |

## How the extension uses this

1. **Filters:** the popup loads the visible `content_filters` (built-ins, without prompts) through the background worker. Enabled filter **ids** are saved to `chrome.storage.sync`.
2. **Lookup:** as soon as a `<video>`'s metadata loads (before it plays), the content script sends the frame's YouTube id (from the URL, if any) and title. The background worker adds the tab's title and calls `find_video`, so only that video is fetched, never the whole library. It takes well under a millisecond on the database, even with 50,000 videos (see Performance). Results are cached for 5 minutes. A new video in the same player (YouTube) triggers a new lookup.
3. **Manual pick:** the popup's **This video** section shows the match, or "Not in the library". The search box calls `search_videos`. Picking a result saves it for that page (`chrome.storage.local.manualMatches`, newest 200), and the tab's frames look up again through `video_with_ranges`.
4. **Playback gate** (`content.js` + `notice.js`, from `document_start`): a video plays **only after the viewer chooses**. From the moment it appears, it's held (paused) under a blurred cover with the SceneMod dialog. The dialog first shows "checking…", then switches **in place** to the choices:
   - **Found:** **Watch with filters** (library scenes are skipped) or **Watch without filters** (nothing is skipped).
   - **Not found:** **Turn on live AI filter** (Pro) or **Watch without filters**, plus a library search for videos listed under another name. Picking one counts as "with filters".
   - **Every choice removes the cover and starts playback.** Live AI first holds behind its own loader while the first 5 seconds are analysed. A pick made in the popup also decides for a waiting video.
   - **YouTube video pages** (watch, embed, Shorts) are gated **by page**: the id in the URL is known before any `<video>` exists. The cover sits on the player box (`#movie_player` / `#shorts-player`), not the `<video>`. A stylesheet (`html[data-scenemod-hold]`) keeps the player blurred and YouTube's play button hidden from first paint, so nothing shows through while YouTube builds, resizes or swaps elements. Every 100 ms, undecided gates are re-held (paused, cover up). Lookups on YouTube use the video id only, because the page title can still be the previous video's right after navigating. The hidden hover-preview player is never gated.
   - **Other sites** are gated per `<video>` (main videos of at least 200×100), with an inline blur plus the cover.
   - **Live AI (Pro):** in store builds the button reads "coming soon" until sign-in and credits exist. In **dev builds** (unpacked, with `config.dev.js`) it's on by default. It analyses all built-in filters, saves their ranges to the library (with the title fetched from YouTube), and blurs only the viewer's active filters.
5. **Acting on ranges:** the content script acts only on ranges whose `filter_id` is enabled. Preset changes apply immediately.

## Debug modes (extension)

The extension popup's **Debug** section has three modes: **Off**, **Live analysis overlay**, and **Pre-scan & blur**. They're stored per device in `chrome.storage.local.debugMode`. Both active modes call `classify-frames` as a dry run (`persist: false`) with your active filters as `filter_ids`, and show a panel over the video:
- a MOCK or LIVE AI badge and the response time
- the analysed frame, outlined red if any filter flagged it
- a ✓/✗ for each filter with a probability bar
- the last 8 frames
- the database match
- a log of skips, blurs and errors

**Live analysis overlay** (`debug.js`): analyses the frame that's on screen, once per second. It's useful for watching results, but a flagged scene has already been seen when the answer arrives.

**Pre-scan & blur** (`prescan.js`, `mse-tee.js`, `tee-flag.js`): a continuous 5-second lookahead.
- **One initial stall.** On a fresh load, or after seeking past the analysed region, playback pauses behind a loading animation while the next 5 seconds are captured and analysed in one request.
- **Steady state.** While you watch second *k*, second *k+5* is captured and analysed, one request per second. There are no further pauses unless analysis falls behind, which triggers a "Waiting for analysis…" stall. Seconds already analysed aren't requested again after seeking back.
- **Hide, never skip.** Flagged scenes, from the AI or the database, stay hidden while they play, with a "Hidden: gore" label. Hiding starts 1 second early, because a scene can begin between samples. Seeking past a scene would break the lookahead. How it hides is set under **Flagged scenes** in the popup, stored in `chrome.storage.sync.flaggedHandling`:
  - **Mute audio:** on by default. Only a mute that SceneMod caused is undone afterwards.
  - **Heavy blur** (default), or **Full cover**: an opaque grey layer, so nothing is visible.
- **How future frames are read.** Frames come from a hidden shadow `<video>`, never the visible player:
  - **Plain file URLs** (and blob URLs of ordinary Blobs): the shadow is a clone of the source.
  - **MediaSource players such as YouTube:** `mse-tee.js` runs in the page's main world at document start and mirrors the player's video segments into the shadow. It only does this when `tee-flag.js` has marked the page because Pre-scan is on, so normal browsing is untouched. **Reload video pages after switching Pre-scan on**; otherwise the panel says the lookahead is unavailable.

**Both modes:**
- **Dev builds only.** `classify-frames` accepts only the secret key, which must never ship in the store build. So the debug modes run only in your own unpacked copy:
  1. Run `extension/scripts/dev-setup.sh`. It writes `extension/config.dev.js` with the production secret key, gitignored and readable only by you.
  2. In `chrome://extensions`, use **Load unpacked** and pick `extension/`.
  3. The popup now shows the **Debug** section. Store installs never see it, and the background worker refuses to analyse unless the extension is loaded unpacked *and* `config.dev.js` exists.
- **Store package:** `extension/scripts/package.sh` builds `dist/scenemod-<version>.zip`. It leaves out `config.dev.js`, tests and scripts, and aborts if a secret key would end up inside.
- **Cost:** roughly one Decisions request per second of playback, with every active preset as a question in it. Use `MOCK_DECISIONS=true` to work on the UI without spending.
- **Capture limits:** cross-origin videos without CORS can't be captured. DRM (EME) players can't be mirrored or captured.

## Next steps

- **Auth:** add sign-in to the extension with `supabase.auth`, plus a `profiles` / `credits` table keyed by `auth.uid()`.
- **Live indexing from the extension:** capture upcoming frames in the extension (a canvas, or `chrome.tabCapture` for DRM players) and send them to `classify-frames` with the user's sign-in token. The function would accept user calls and charge credits.
- **Realtime in the extension:** subscribe to `skip_ranges` inserts for the current `video_id`. A viewer of a video someone else is indexing then gets ranges as they arrive, without paying for another inference run.
