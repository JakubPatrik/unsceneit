"""Renders a creative to a 1080x1920 MP4 through the Remotion project.

The video itself is defined in marketing/remotion/src/social-clip/, which reads
the same creatives.json and segments.json as this pipeline.
"""

import hashlib
import json
import subprocess
from pathlib import Path

WIDTH, HEIGHT = 1080, 1920
BAND_TOP = 600  # Where the footage band starts; keep in sync with SocialClip.tsx.


class RenderError(RuntimeError):
    pass


def remotion_binary(remotion_dir: Path) -> Path:
    return remotion_dir / "node_modules" / ".bin" / "remotion"


def fingerprint(creative: dict, segments: dict, remotion_dir: Path) -> str:
    """Changes whenever the output would, so unchanged creatives aren't re-rendered."""
    used = {b["segment"]: segments[b["segment"]] for b in creative["beats"]}
    digest = hashlib.sha256(json.dumps({"beats": creative["beats"], "segments": used}, sort_keys=True).encode())
    files = sorted((remotion_dir / "src").rglob("*")) + [remotion_dir / "remotion.config.ts", remotion_dir / "package-lock.json"]
    for path in files:
        if path.is_file():
            digest.update(path.read_bytes())
    return digest.hexdigest()


def render(creative: dict, segments: dict, remotion_dir: Path, out: Path) -> dict:
    if not remotion_binary(remotion_dir).exists():
        raise RenderError(f"Remotion isn't installed: run `npm i` in {remotion_dir}")
    for beat in creative["beats"]:
        _, _, width, height = segments[beat["segment"]]["crop"]
        if WIDTH * height / width > HEIGHT - BAND_TOP:
            raise RenderError(f'Segment "{beat["segment"]}" crop is too tall for the footage band')

    out.parent.mkdir(parents=True, exist_ok=True)
    link = subprocess.run(["node", "scripts/link-footage.mjs"], cwd=remotion_dir, capture_output=True, text=True)
    if link.returncode != 0:
        raise RenderError(link.stderr.strip())

    result = subprocess.run(
        [
            str(remotion_binary(remotion_dir)), "render", "src/index.ts", creative["id"], str(out),
            "--codec=h264", "--crf=20",
            # The footage is muted, and some platforms handle video without an
            # audio stream badly, so this adds a silent track.
            "--enforce-audio-track",
            "--log=error",
        ],
        cwd=remotion_dir, capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RenderError(f"Remotion failed for {creative['id']}: {(result.stderr or result.stdout)[-800:]}")
    return validate(out)


def validate(path: Path) -> dict:
    """Checks the file against what the vertical platforms accept."""
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True, check=True,
    )
    info = json.loads(result.stdout)
    video = next(s for s in info["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in info["streams"])
    duration = float(info["format"]["duration"])
    size_mb = path.stat().st_size / 1_000_000
    problems = []
    if (video["width"], video["height"]) != (WIDTH, HEIGHT):
        problems.append(f"size is {video['width']}x{video['height']}")
    if video["codec_name"] != "h264" or video["pix_fmt"] != "yuv420p":
        problems.append(f"encoding is {video['codec_name']}/{video['pix_fmt']}")
    if not has_audio:
        problems.append("no audio stream")
    if not 3 <= duration <= 60:
        problems.append(f"duration is {duration:.1f}s, wanted 3 to 60s")
    if problems:
        raise RenderError(f"{path.name} failed validation: {', '.join(problems)}")
    return {"duration": round(duration, 1), "size_mb": round(size_mb, 1)}
