// Makes the footage that segments.json uses available in public/footage/.
// Remotion doesn't serve symlinks from public/, so these are hard links: real
// files to Remotion, with no second copy on disk. Re-linking on every run picks
// up a re-exported source. The footage is gitignored in data/ and here.
import { existsSync, linkSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const repo = join(root, "..", "..");
const segments = JSON.parse(readFileSync(join(root, "..", "pipeline", "content", "segments.json"), "utf8"));
const sources = new Set(
  Object.entries(segments)
    .filter(([name]) => !name.startsWith("_"))
    .map(([, segment]) => segment.source),
);

const outDir = join(root, "public", "footage");
mkdirSync(outDir, { recursive: true });

for (const source of sources) {
  const from = join(repo, source);
  if (!existsSync(from)) {
    console.error(`Missing source footage: ${from}`);
    process.exit(1);
  }
  const to = join(outDir, basename(source));
  rmSync(to, { force: true });
  linkSync(from, to);
}
