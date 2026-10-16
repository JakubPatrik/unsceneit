# unscene.it Backend (Supabase)

The backend for the unscene.it extension: Postgres for flagged-scene data, an Edge Function that classifies frames, and later Auth.

```
Chrome / Edge extension                    scripts/classify-video.mjs (trusted, secret key)
   │  publishable key (read-only, RLS)        │  sampled frames
   ▼                                          ▼
Supabase
   ├─ Postgres     content_filters, videos, frame_scans     ← live
   ├─ Edge Fn      classify-frames → OpenAI Decisions API → frame_scans   ← deployed
   └─ Auth         user sign-in                   ← later
```

The extension is distributed through the browser stores, so the only thing we host is this Supabase project. There's no local setup: everything runs against the hosted project.

## Schema

| Table | Columns | Notes |
|---|---|---|
| `admins` | `user_id` → `auth.users`, `created_at` | Admin accounts. They own the built-in filters and curate the shared library. Today it's the founder's account. `is_admin()` and `is_admin_user(uid)` power the access rules. |
| `content_filters` | `id`, `user_id` (owner), `key`, `label`, `prompt`, `category`, `min_age`, `sort_order`, `created_at` | Filters a viewer can turn on (PRD §2). **Built-ins** belong to an admin; any other filter is private to the user who created it. `key` is a slug such as `gore`, unique **per owner**, so two users can both have a `gore` filter. `prompt` is the yes/no question `classify-frames` asks the Decisions API about each frame. `category` is `age` or `trigger`; `min_age` is set only for age filters. |
| `videos` | `id`, `title`, `youtube_id`, `priority`, `created_at`, plus generated `title_norm` and `title_tsv` | The shared library. A video is found by `youtube_id` (unique, 11 characters) or by its **title**. `title_norm` is the title lowercased with punctuation stripped (`normalize_title`), and `title_tsv` is its full-text form. Both are maintained by Postgres. Higher `priority` wins ties. |
| `frame_scans` | `video_id`, `filter_id` → `content_filters.id`, `minute`, `probs smallint[60]`, `updated_at`; primary key `(video_id, filter_id, minute)` | The AI's answers, packed one row per video × filter × minute, and **the single source of truth**: flagged scenes and scanned stretches are derived from it when a video is read. Slot `i` is second `minute * 60 + i - 1`: the probability × 1000 (0–1000), `-1` when the AI refused (counts as flagged), or null when it hasn't been analysed. A fully scanned 2-hour film with 6 filters is 720 rows, about 165 KB; one more filter adds about 30 KB. Whether a second is flagged is decided at read time against `flag_threshold()` (500, i.e. 0.5), so changing the threshold rewrites no data and needs no AI. |

**Filters and overlaps:** ranges with different filters may overlap. For example, a video can have gore from 30 to 45s and 15+ from 35 to 60s. The extension only acts on ranges whose `filter_id` the user enabled in the popup; settings store filter ids. Overlapping enabled ranges chain together, so with both enabled, 30 to 60s stays hidden.

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
- `video_with_ranges(p_video_id)`: the same shape for one video. Used after a manual pick, and by `find_video` for its result. Both are derived from `frame_scans` by `frame_ranges(video, flagged_only, pad)`. Reading a fully scanned 2-hour film takes about 100 ms.
  - `ranges`: flagged seconds, each padded by `skip_padding_s()` (0.5 seconds) before and after, with the start clamped at 0. Ranges of the same filter that then overlap or touch are merged. The padding also covers a single clean second between two flagged ones (the two padded ranges touch), so a scene doesn't blink back on for one sample.
  - `scanned`: every analysed second, flagged or not, merged per filter: `[{start_s, end_s, filter_id}]`. Live AI doesn't analyse a second again once it's scanned for every filter the viewer has on. A filter turned on later has no results yet, so it's analysed again. A library video with scans offers live AI for the rest when you choose "Watch with filters" (dev builds only).
- `search_videos(p_query)`: up to 10 videos for the manual pick. It uses full-text search with word prefixes on a GIN index (`title_tsv`), so "tears ste" or "steel tears" finds Tears of Steel. When that finds nothing, it falls back to trigram similarity (`pg_trgm`) for typos.
- `upsert_video(p_title, p_youtube_id, p_title_is_canonical)`: the video for an indexing run. It finds it by YouTube id, else by exact normalized title, else creates it. The title only changes when it came from YouTube itself (canonical). Used by `classify-frames`.

The lookups run with the caller's permissions, so access rules still decide which ranges come back.

**Files:**
- `supabase/migrations/20261011000000_init.sql`: admins and content filters (tables, RLS, grants), plus the built-in `content_filters` rows. Those rows are reference data the popup needs, so they ship to the hosted project too.
- `supabase/migrations/20261014100000_video_library.sql`: the video library. It covers `videos`, title helpers and indexes, the derived ranges, lookup, search and `upsert_video`. It replaced the earlier skip-range schema, whose migrations were removed and marked reverted on production.
- `supabase/migrations/20261014110000_frame_scans.sql`: packs the AI's answers into per-minute rows (`frame_scans`, replacing `frame_results`). It adds `flag_threshold()` and `save_frame_probs`.
- `supabase/migrations/20261014120000_drop_frame_scans_model.sql`: drops the unused `frame_scans.model` column.

All are applied to production, so don't edit them any more. Schema changes go in new migrations: run `supabase migration new <name>`, then `backend/scripts/deploy.sh`.

## Edge Function: `classify-frames`

`supabase/functions/classify-frames/` takes frames sampled from a video and does the following:
1. **Stored answers first:** with `persist`, it finds the video and looks up `frame_scans` for the requested frames. Stored answers are used at no cost, and the AI is asked only the questions a frame has no stored answer for. A new video gets every filter. An already scanned video with a filter added later, such as a user's custom filter, gets only that filter. The answers it already has for the built-in filters are kept, not re-asked. The response reports `frames_from_library` (fully answered from the database) and `questions_asked` (frame × filter questions sent to the AI).
2. Sends each remaining frame to the [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions) (`POST /v1/decisions`, `gpt-6-luna`). Each request asks one `predicate` question per filter, using `content_filters.prompt`. It asks about every built-in filter, or only the ones listed in `filter_ids`. Questions are named `f0`, `f1`… and mapped back to filter ids, because keys aren't unique across users.
3. Counts a filter as flagged when its probability is at or above `flag_threshold()` in the database, the only copy of the threshold. A refusal also counts as flagged, so the scene is hidden.
4. Stores the probabilities for every second each frame stands for, flagged or not, with `save_frame_probs`. That's one statement per request, which fills in slots of the per-minute rows. Re-analysing a second overwrites its slot. When saving, frame times and `interval_s` must be whole seconds.
5. Returns the frames' flagged scenes as ranges, one set per filter. Ranges for different filters may overlap. A single unflagged frame between two frames flagged for the same filter is treated as flagged (`MAX_BRIDGED_CLEAN_FRAMES` in `ranges.ts`), so the scene doesn't blink back on for one sample.

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

The video is found by `youtube_id` (optional) or its title through `upsert_video`, and created if it's new. Use `"video_id": "<uuid>"` instead of `video` for an existing video. **Re-running costs nothing:** with `persist`, frames already answered for every filter come from `frame_scans` instead of the AI. Leave out `filter_ids` to evaluate every built-in filter. In live mode, send only the viewer's active filters, since each filter is one more question per frame. Unknown ids get a 400 before any OpenAI call. `"persist": false` makes a dry run: it classifies and returns the results but writes nothing, and `video` isn't required. The debug overlay uses this.

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

Production is the **UnSceneIt** Supabase project (`sankeqoeuociotbufbsb`, ca-central-1; named before the unscene.it rebrand), and `extension/config.js` points to it.

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

The extension's logic lives in `extension/logic.js`, which doesn't use `chrome.*` or the DOM. That covers which ranges hide a moment (including overlapping ranges), movie matching, age presets, seek clamping and video picking. Its tests use Node's built-in test runner and need no install:

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
3. **Manual pick:** when a video isn't found, the dialog's library search calls `search_videos`. Picking a result saves it for that page (`chrome.storage.local.manualMatches`, newest 200), and the tab's frames look up again through `video_with_ranges`.
4. **Playback gate** (`content.js` + `notice.js`, from `document_start`): a video plays **only after the viewer chooses**. From the moment it appears, it's held (paused) under a blurred cover. While the library is checked, Xenia, the bot in the top-right corner, says "Checking this video against your filters…" with a spinner in its bubble. Then the dialog with the choices appears:
   - **Found:** **Watch with filters** (library scenes are hidden) or **Watch without filters** (nothing is hidden).
   - **Not found:** **Turn on live AI filter** (Pro) or **Watch without filters**, plus a library search for videos listed under another name. Picking one counts as "with filters".
   - **Your filters in the dialog:** both dialogs include a "Your filters" picker (an age-limit dropdown plus trigger chips), the same synced setting as the popup. **Watch with filters** and **Turn on live AI filter** stay disabled until at least one filter is picked; **Watch without filters** always works. In the found dialog, the count of scenes that will be hidden follows the picker. If live AI somehow runs with no filters, its loader closes and playback continues, instead of spinning.
   - **Every choice removes the cover and starts playback.** **Live AI** first keeps the video paused and covered while the dialog flies into the bot. The bot says "Pre-screening the first 10 seconds…" in its bubble, with capture/analysis progress. Later pauses ("Waiting for analysis…") look the same, over a dimmed copy of the frame. The bot's thinking face (a spinning ring, eyes glancing and hopping) shows only while frames are actually out to the AI, during playback too. Replaying stretches that are already scanned keeps the normal face. Changing filters mid-video only analyses again when a newly turned-on filter wasn't among those already answered; live AI answers every built-in filter, so switching between built-ins costs nothing. Any play is undone. As soon as those seconds have results, it unblurs and autoplays, then keeps screening ahead. The window is `PRESCAN_WINDOW_S` in `extension/prescan.js` (10), the only place to change it.
     - **Slow answers:** live AI stays on. After `max(15 s, 1.5 s × window)`, playback starts anyway, and the pre-scan pauses wherever results are still missing.
     - **Can't run at all** (no filters, no stream access until a page reload, a non-capturable video): it switches itself off, plays, and says why.
   - **Xenia, the unscene.it bot:** after any choice, the dialog morphs (shrinks and slides) into Xenia, a small round bot in the player's top-right corner: a flat circle with two white pill eyes that blink. It's **purple** while filtering (with filters on a library video, or live AI), with a small sideways glance, and **grey** when off (without filters). The colour fades between states. Status messages appear as a short speech bubble next to it. **Clicking the bot** pauses the video and re-opens the dialog over the blurred player, so the viewer can change filters or switch mode mid-video; the next choice resumes playback. The bot re-appears if the page re-renders and leaves with the video.
   - **Debug panel toggle (dev builds only):** in an unpacked build with `config.dev.js`, the dialogs end with a **Show live AI debug panel** switch (`chrome.storage.local.showDebugPanel`, off by default). It shows or hides the look-ahead's panel in the player's top-left corner; live AI itself and its "Hidden: …" labels work either way. Store builds never show the switch or the panel.
   - **Close (✕)** in the dialog's top-right corner: on first open it means **watch without filters**, so the viewer is never left with a paused, blurred video. When the dialog was re-opened from the bot, it **cancels**: the previous choice stays and playback resumes. If live AI was already running, it resumes straight away (no new pre-screen): results already cover all built-in filters, so filter changes apply at once.
   - **Watch without filters** is hands-off: nothing is hidden, paused or analysed for that video, including the dev look-ahead and debug capture. Live AI stops if it was on. Only the idle bot remains, to turn filters back on.
   - **Which video:** one per frame, `mainVideo()` in `content.js`, used by the gate, the look-ahead and the debug panel. On YouTube it's the main player's video on a `/watch` page, or a YouTube player embedded in another site (`/embed/`). Every other YouTube page (home, search, channels, Shorts) only has hover previews, so nothing there is gated, looked up, analysed or saved; `background.js` also refuses to save live AI results from a YouTube page without a video id. Elsewhere it's the biggest video on the page (at least 200×100, `pickMainVideo` in `logic.js`), even if a smaller ad or preview is playing.
   - **YouTube watch pages** (and embeds) are gated **by page**: the id in the URL is known before any `<video>` exists. The cover sits on the player box (`#movie_player`), not the `<video>`. A stylesheet (`html[data-unsceneit-hold]`) keeps the player blurred and YouTube's play button hidden from first paint, so nothing shows through while YouTube builds, resizes or swaps elements. Every 100 ms, undecided gates are re-held (paused, cover up). The overlay never blinks. It renders in the browser's **top layer** (Popover API), so no page element paints over it. It has its own non-animated **view-transition group**, because YouTube swaps its loading skeleton for the app with a View Transition, which would otherwise cross-fade the overlay. It also covers the skeleton's thumbnail (`#player-placeholder`), follows the player every frame, and if the page removes it, a watcher on its parent puts it back in the same task, before paint. It also draws at the player's last position (remembered per tab in `sessionStorage`) while a new page's player is still laying out, and a URL that briefly loses the video id mid-navigation must stay without one for 500 ms before the gate is dropped. Lookups on YouTube use the video id only, because the page title can still be the previous video's right after navigating. The hidden hover-preview player is never gated.
   - **Other sites** would gate only the page's main video (the biggest), with an inline blur plus the cover. The manifest currently runs the extension on `https://www.youtube.com/*` only (including YouTube players embedded in other sites), so this path is kept for later but unused.
   - **Live AI (Pro):** in store builds the button reads "coming soon" until sign-in and credits exist. In **dev builds** (unpacked, with `config.dev.js`) it's on by default. It analyses all built-in filters, saves their ranges to the library (with the title fetched from YouTube), and blurs only the viewer's active filters.
5. **Acting on ranges:** flagged scenes are **hidden, never skipped**, the same way for library titles and live AI (`prescan.js`; see **Hide, never skip** below). Only ranges whose `filter_id` is enabled count. Preset changes apply immediately. Library titles need no look-ahead: their padded ranges are applied every frame.

## Debug modes (extension)

There are three debug modes: **Off**, **Live analysis overlay**, and **Pre-scan & blur**. They're stored per device in `chrome.storage.local.debugMode`. The popup no longer has controls for them, so to use one, set `debugMode` (`"live"` or `"prescan"`) from the extension's service-worker console with `chrome.storage.local.set({ debugMode: "live" })`. Both active modes call `classify-frames` as a dry run (`persist: false`) with your active filters as `filter_ids`, and show a panel over the video:
- a MOCK or LIVE AI badge and the response time
- the analysed frame, outlined red if any filter flagged it
- a ✓/✗ for each filter with a probability bar
- the last 8 frames
- the database match
- a log of hidden scenes and errors

**Live analysis overlay** (`debug.js`): analyses the frame that's on screen, once per second. It's useful for watching results, but a flagged scene has already been seen when the answer arrives.

**Permissions:** the manifest asks only for `https://www.youtube.com/*` (plus `storage`). The background worker still reaches Supabase without a host permission because both the REST API and `classify-frames` (via `@supabase/server`) send CORS headers (`Access-Control-Allow-Origin: *`).

**On/off per site** (`site.js`, popup header switch): on by default. With the manifest limited to youtube.com, this is effectively the YouTube on/off switch; on other tabs the popup can't see the address and says unscene.it runs on YouTube. Switching it off for the current tab's site adds its hostname (without `www.`) to `chrome.storage.sync.disabledSites`, which covers every page on that hostname; iframes follow the top-level page's site. Off takes effect at once in every open tab of the site: `content.js` releases the page through `shutDown()` (no gate, no Xenia, no blur or mute, look-ahead stopped), `thumbs.js` stops blurring thumbnails and `tee-flag.js` stops stream mirroring. Switching back on reloads the tab, so the gate catches videos from the start.

**Thumbnail blur** (`thumbs.css`, `thumbs.js`): on by default, and the viewer can turn it off under **Thumbnails** in the popup (`chrome.storage.sync.blurThumbnails`).
- **What it blurs:** every video thumbnail and hover preview. That means YouTube images by URL, youtube.com's thumbnail containers (desktop and mobile), and the player's own end-screen, pause, up-next and seek-preview images.
- **Never visible, even for a frame:** the blur is a manifest stylesheet, so Chrome applies it before the first paint. `thumbs.js` only switches it off, with `<html data-unsceneit-thumbs="off">`, once storage says the option is off. So the brief delay before the script runs errs on the blurred side.

**Pre-scan & blur** (`prescan.js`, `mse-tee.js`, `tee-flag.js`): a continuous lookahead of `PRESCAN_WINDOW_S` seconds (10).
- **One initial stall.** On a fresh load, or after seeking past the analysed region, playback pauses behind a loading animation while the next `PRESCAN_WINDOW_S` seconds are captured and analysed in one request.
- **Steady state.** While you watch second *k*, second *k+5* is captured and analysed, one request per second. There are no further pauses unless analysis falls behind, which triggers a "Waiting for analysis…" stall. The video's final second never stalls (the last partial second often can't be captured); when a video ends, any stall ends and Xenia rests (grey) until it plays again. Seconds already analysed aren't requested again after seeking back.
- **Hide, never skip.** This applies whenever the viewer watches with filters, with or without live AI. Flagged scenes, from the AI or the database, stay hidden while they play, with a "Hidden: gore" label. Hiding starts 0.5 seconds early and ends 0.5 seconds late, because a scene can begin or end between samples (library ranges already come padded from the database, by `skip_padding_s()`; live AI ranges by `PRESCAN_BLUR_PAD_S` in `prescan.js`). Seeking past a scene would break the lookahead. How it hides comes from `chrome.storage.sync.flaggedHandling`. The popup no longer has controls for it, so viewers get the defaults:
  - **Mute audio:** on by default. Only a mute that unscene.it caused is undone afterwards.
  - **Heavy blur** (default), or **Full cover**: an opaque grey layer, so nothing is visible.
- **How future frames are read.** Frames come from a hidden shadow `<video>`, never the visible player:
  - **Plain file URLs** (and blob URLs of ordinary Blobs): the shadow is a clone of the source.
  - **MediaSource players such as YouTube:** `mse-tee.js` runs in the page's main world at document start and mirrors the player's video segments into the shadow. It only does this when `tee-flag.js` has marked the page because Pre-scan is on, so normal browsing is untouched. **Reload video pages after switching Pre-scan on**; otherwise the panel says the lookahead is unavailable.

**Both modes:**
- **Dev builds only.** `classify-frames` accepts only the secret key, which must never ship in the store build. So the debug modes run only in your own unpacked copy:
  1. Run `extension/scripts/dev-setup.sh`. It writes `extension/config.dev.js` with the production secret key, gitignored and readable only by you.
  2. In `chrome://extensions`, use **Load unpacked** and pick `extension/`.
  3. Live AI and the dialog's **Show live AI debug panel** switch are now available. Store installs never see them, and the background worker refuses to analyse unless the extension is loaded unpacked *and* `config.dev.js` exists.
- **Store package:** `extension/scripts/package.sh` builds `dist/unsceneit-<version>.zip`. It leaves out `config.dev.js`, tests and scripts, and aborts if a secret key would end up inside.
- **Cost:** roughly one Decisions request per second of playback, with every active preset as a question in it. Use `MOCK_DECISIONS=true` to work on the UI without spending.
- **Capture limits:** cross-origin videos without CORS can't be captured. DRM (EME) players can't be mirrored or captured.

## Next steps

- **Auth:** add sign-in to the extension with `supabase.auth`, plus a `profiles` / `credits` table keyed by `auth.uid()`.
- **Live indexing from the extension:** capture upcoming frames in the extension (a canvas, or `chrome.tabCapture` for DRM players) and send them to `classify-frames` with the user's sign-in token. The function would accept user calls and charge credits.
- **Realtime in the extension:** add `frame_scans` to the Realtime publication and subscribe for the current `video_id`. A viewer of a video someone else is indexing then gets results as they arrive, without paying for another inference run.
