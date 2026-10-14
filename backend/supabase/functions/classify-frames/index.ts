// classify-frames: turns sampled video frames into skip ranges.
//
// POST /functions/v1/classify-frames   (secret key only — see auth below)
// {
//   "video": { "title": "Sintel", "youtube_id": "eRsGyueVLvQ" },   // youtube_id optional
//                                          // or "video_id": "<uuid>"
//   "interval_s": 1,                       // spacing between sampled frames
//   "filter_ids": ["<uuid>", ...],         // optional; default = all built-in filters
//   "persist": false,                      // optional; false = dry run, no DB writes, video not needed
//   "frames": [{ "t": 30, "image": "data:image/jpeg;base64,..." }, ...]
// }
//
// Each frame is sent to the OpenAI Decisions API with one predicate question
// per filter (content_filters.prompt). The response has a boolean per frame
// and filter id (plus the filters' keys/labels for display). Consecutive
// flagged frames become skip_ranges rows; re-analysing a stretch of a video
// replaces that stretch's old ranges for these filters (replace_skip_ranges).
// Realtime broadcasts new rows to subscribed viewers.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  answerProbabilities,
  answersByFilterId,
  buildRanges,
  type ClassifiedFrame,
  type DecisionAnswer,
  flaggedFilters,
  frameDecisions,
  mockAnswers,
  questionName,
  selectFilters,
} from "./ranges.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MOCK = Deno.env.get("MOCK_DECISIONS") === "true" || !OPENAI_API_KEY;
const MODEL = Deno.env.get("DECISIONS_MODEL") ?? "gpt-6-luna";
const THRESHOLD = Number(Deno.env.get("FLAG_THRESHOLD") ?? "0.5");
const CONCURRENCY = 4;
const MAX_FRAMES = 120;

type Filter = { id: string; key: string; label: string; prompt: string };
type Frame = { t: number; image: string };

async function decide(image: string, filters: Filter[]): Promise<DecisionAnswer[]> {
  const res = await fetch("https://api.openai.com/v1/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "A single frame sampled from a movie." },
            { type: "input_image", image_url: image },
          ],
        },
      ],
      questions: filters.map((f, i) => ({
        type: "predicate",
        name: questionName(i),
        instructions: f.prompt,
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Decisions API ${res.status}: ${await res.text()}`);
  }
  const { answers } = await res.json();
  return answersByFilterId(answers, filters.map((f) => f.id));
}

// Images in one Decisions request are shared evidence for every question,
// so each frame needs its own request; run a few at a time.
async function classifyFrames(frames: Frame[], filters: Filter[]): Promise<ClassifiedFrame[]> {
  const out: ClassifiedFrame[] = [];
  for (let i = 0; i < frames.length; i += CONCURRENCY) {
    const batch = frames.slice(i, i + CONCURRENCY);
    const answers = await Promise.all(
      batch.map((f) => (MOCK ? mockAnswers(f.t, filters) : decide(f.image, filters)))
    );
    batch.forEach((f, j) =>
      out.push({
        t: f.t,
        flags: flaggedFilters(answers[j], THRESHOLD),
        probabilities: answerProbabilities(answers[j]),
      })
    );
  }
  return out;
}

function validate(body: any): string | null {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  if (body.persist !== undefined && typeof body.persist !== "boolean") {
    return "persist must be a boolean";
  }
  const persist = body.persist !== false;
  if (persist && !body.video_id) {
    const v = body.video;
    if (typeof v?.title !== "string" || !v.title.trim()) return "Provide video_id, or video.title";
    if (v.youtube_id && !YOUTUBE_ID.test(v.youtube_id)) return "video.youtube_id must be an 11-character YouTube id";
  }
  if (body.interval_s !== undefined && !(body.interval_s > 0)) return "interval_s must be > 0";
  const ids = body.filter_ids;
  if (
    ids !== undefined &&
    !(Array.isArray(ids) && ids.length && ids.every((id: unknown) => typeof id === "string" && UUID.test(id)))
  ) {
    return "filter_ids must be a non-empty array of filter ids (uuids)";
  }
  const frames = body.frames;
  if (!Array.isArray(frames) || !frames.length) return "frames must be a non-empty array";
  if (frames.length > MAX_FRAMES) return `At most ${MAX_FRAMES} frames per request`;
  for (const f of frames) {
    if (typeof f?.t !== "number" || f.t < 0) return "Each frame needs t >= 0 (seconds)";
    if (typeof f.image !== "string" || !f.image.startsWith("data:image/")) {
      return "Each frame needs image as a base64 data URL";
    }
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const json = (data: unknown, status = 200) => Response.json(data, { status });

// The video's real title from YouTube (oEmbed, no key needed), or null. Page
// titles can't be trusted: YouTube updates the URL before document.title when
// moving to the next video, so the page may still show the previous title.
async function youtubeTitle(youtubeId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${youtubeId}`
    )}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const { title } = await res.json();
    return typeof title === "string" && title.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}

export default {
  // "secret" only: callers must present the project's secret key. Keeps the
  // paid OpenAI calls off-limits to holders of the public publishable key
  // until user auth + credits exist.
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const invalid = validate(body);
    if (invalid) return json({ error: invalid }, 400);

    const db = ctx.supabaseAdmin;
    const intervalS: number = body.interval_s ?? 1;
    const persist = body.persist !== false;

    // Candidate filters: the requested ids, or every built-in (admin-owned)
    // filter. Callers hold the secret key, so they're trusted; once signed-in
    // users can call this, limit candidates to built-ins + the caller's own.
    let query = db.from("content_filters").select("id, key, label, prompt");
    if (body.filter_ids) {
      query = query.in("id", body.filter_ids);
    } else {
      const { data: admins, error } = await db.from("admins").select("user_id");
      if (error) return json({ error: error.message }, 500);
      query = query.in("user_id", admins.map((a) => a.user_id));
    }
    const { data: candidates, error: filtersError } = await query
      .order("category")
      .order("sort_order");
    if (filtersError) return json({ error: filtersError.message }, 500);
    const selected = selectFilters(candidates as Filter[], body.filter_ids);
    if ("error" in selected) return json({ error: selected.error }, 400);
    const filters = selected.filters;

    // Resolve the video: by id, else upsert_video (by youtube_id, else exact
    // normalized title, else a new row). For YouTube the title comes from
    // YouTube itself. Skipped for dry runs.
    let videoId: string | null = body.video_id ?? null;
    if (persist && !videoId) {
      const youtubeId = body.video.youtube_id ?? null;
      const canonical = youtubeId ? await youtubeTitle(youtubeId) : null;
      const { data, error } = await db.rpc("upsert_video", {
        p_title: canonical ?? body.video.title,
        p_youtube_id: youtubeId,
        p_title_is_canonical: canonical !== null,
      });
      if (error) return json({ error: error.message }, 400);
      videoId = data;
    }

    let classified: ClassifiedFrame[];
    try {
      classified = await classifyFrames(body.frames, filters);
    } catch (err) {
      console.error(err);
      return json({ error: String(err) }, 502);
    }

    const ranges = buildRanges(classified, intervalS);
    if (persist) {
      // Re-analysed window: from the first frame to one interval past the last.
      const times = classified.map((f) => f.t);
      const { error } = await db.rpc("replace_skip_ranges", {
        p_video_id: videoId,
        p_filter_ids: filters.map((f) => f.id),
        p_from: Math.min(...times),
        p_to: Math.max(...times) + intervalS,
        p_ranges: ranges,
      });
      if (error) return json({ error: error.message }, 500);
    }

    return json({
      video_id: videoId,
      mock: MOCK,
      persisted: persist,
      frames_classified: classified.length,
      filters: filters.map(({ id, key, label }) => ({ id, key, label })),
      decisions: frameDecisions(classified, filters.map((f) => f.id)),
      ranges: ranges.map((r) => ({ ...r, filter_key: filters.find((f) => f.id === r.filter_id)?.key })),
    });
  }),
};
