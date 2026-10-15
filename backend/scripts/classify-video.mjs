#!/usr/bin/env node
// Samples frames from a local video file with ffmpeg and sends them to the
// production classify-frames Edge Function, which stores the flagged ranges
// in the shared library. Requires ffmpeg, Node 18+ and a linked Supabase CLI
// (`supabase link`). Each frame is a paid Decisions API call.
//
//   node scripts/classify-video.mjs <video-file> --title "Sintel" \
//     [--youtube eRsGyueVLvQ] [--every 1] [--start 0] [--duration 60] [--url <function URL>]
//
// The video is found by --youtube (its YouTube id) if given, else by its
// title, or created. Re-running replaces the old ranges for the analysed
// stretch.
//
// The URL defaults to the linked project; the secret key comes from
// $SUPABASE_SECRET_KEY or `supabase projects api-keys --reveal` (kept in memory).

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const BATCH_SIZE = 30; // frames per request (keeps bodies ~1–2 MB)

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" },
    youtube: { type: "string" },
    every: { type: "string", default: "1" },
    start: { type: "string", default: "0" },
    duration: { type: "string" },
    url: { type: "string" },
  },
});

const file = positionals[0];
if (!file || !opts.title) {
  console.error('Usage: classify-video.mjs <video-file> --title "..." [--youtube <id>] [--every 1] [--start 0] [--duration N]');
  process.exit(1);
}
const every = Number(opts.every);
const start = Number(opts.start);

const backendDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function linkedRef() {
  try {
    return readFileSync(join(backendDir, "supabase/.temp/project-ref"), "utf8").trim();
  } catch {
    console.error("Not linked: run `supabase link --project-ref <ref>` in backend/, or pass --url");
    process.exit(1);
  }
}

const functionUrl = opts.url ?? `https://${linkedRef()}.supabase.co/functions/v1/classify-frames`;

function secretKey() {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  // --reveal: without it the CLI returns secret keys masked.
  const out = execFileSync(
    "supabase",
    ["projects", "api-keys", "--project-ref", linkedRef(), "--reveal", "-o", "json"],
    { cwd: backendDir, encoding: "utf8" }
  );
  const keys = JSON.parse(out.slice(out.indexOf("[")));
  return keys.find((k) => k.type === "secret").api_key;
}

// 1. Extract frames: one every `every` seconds, 512px wide JPEGs.
const dir = mkdtempSync(join(tmpdir(), "unsceneit-frames-"));
try {
  execFileSync("ffmpeg", [
    "-loglevel", "error",
    "-ss", String(start),
    ...(opts.duration ? ["-t", opts.duration] : []),
    "-i", file,
    "-vf", `fps=1/${every},scale=512:-2`,
    "-q:v", "5",
    join(dir, "f_%05d.jpg"),
  ]);
  const frames = readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((name, i) => ({
      t: start + i * every,
      image: `data:image/jpeg;base64,${readFileSync(join(dir, name)).toString("base64")}`,
    }));
  console.log(`Extracted ${frames.length} frames (every ${every}s from ${start}s)`);

  // 2. Send in batches. Ranges split at batch edges touch, and the
  // extension chains touching ranges, so the result is the same.
  const key = secretKey();
  for (let i = 0; i < frames.length; i += BATCH_SIZE) {
    const batch = frames.slice(i, i + BATCH_SIZE);
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        video: { title: opts.title, youtube_id: opts.youtube ?? null },
        interval_s: every,
        frames: batch,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed (${res.status}):`, data);
      process.exit(1);
    }
    console.log(
      `Batch ${i / BATCH_SIZE + 1}: ${data.frames_classified} frames${data.mock ? " (mock)" : ""}, video ${data.video_id}`
    );
    for (const r of data.ranges) console.log(`  ${r.filter_id.padEnd(9)} ${r.start_s}s – ${r.end_s}s`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
