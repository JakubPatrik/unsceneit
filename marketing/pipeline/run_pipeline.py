#!/usr/bin/env python3
"""unscene.it social pipeline: lint -> render -> host -> Buffer. See README.md.

`run` and `queue` are dry runs without --live. With --live, posts go to Buffer as
drafts; only `--mode queue` schedules real publishing, and only for creatives a
human marked "approved": true. The `upload` command makes videos public as soon
as you call it, since that's all it does.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv

import claims
import hosting
import render
from buffer_api import SERVICES, BufferClient, BufferError, build_post_input

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
CREATIVES = HERE / "content" / "creatives.json"
SEGMENTS = HERE / "content" / "segments.json"
REMOTION = HERE.parent / "remotion"
OUTPUT_DIR = HERE / "generated_assets"
LEDGER = HERE / "ledger.json"

CHANNEL_ENV = {
    "youtube": "BUFFER_CHANNEL_YOUTUBE",
    "tiktok": "BUFFER_CHANNEL_TIKTOK",
    "instagram": "BUFFER_CHANNEL_INSTAGRAM",
    "twitter": "BUFFER_CHANNEL_X",
}
UTM_SOURCE = {"youtube": "youtube", "tiktok": "tiktok", "instagram": "instagram", "twitter": "x"}


class PipelineError(RuntimeError):
    pass


# --- Data ---------------------------------------------------------------------


def load_content(only: list[str] | None = None) -> tuple[str, list[dict], dict]:
    data = json.loads(CREATIVES.read_text())
    segments = {k: v for k, v in json.loads(SEGMENTS.read_text()).items() if not k.startswith("_")}
    creatives = data["creatives"]
    if only:
        unknown = set(only) - {c["id"] for c in creatives}
        if unknown:
            raise PipelineError(f"Unknown creative id: {', '.join(sorted(unknown))}")
        creatives = [c for c in creatives if c["id"] in only]
    return data["batch"], creatives, segments


def load_ledger() -> dict:
    """What already happened. It's what makes re-running safe: a post recorded
    here is never sent again."""
    if LEDGER.exists():
        return json.loads(LEDGER.read_text())
    return {"assets": {}, "posts": {}}


def save_ledger(ledger: dict) -> None:
    tmp = LEDGER.with_suffix(".tmp")
    tmp.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n")
    tmp.replace(LEDGER)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def caption_for(creative: dict, service: str, batch: str) -> str:
    link = "https://unscene.it/?" + urlencode(
        {
            "utm_source": UTM_SOURCE[service],
            "utm_medium": "social",
            "utm_campaign": batch,
            "utm_content": creative["id"],
        }
    )
    return creative["captions"][service].replace("{link}", link)


def buffer_client() -> BufferClient:
    key = os.getenv("BUFFER_API_KEY")
    if not key:
        raise PipelineError("BUFFER_API_KEY isn't set (see .env.pipeline.example)")
    return BufferClient(key)


# --- Stages -------------------------------------------------------------------


def stage_lint(creatives: list[dict], segments: dict) -> list[dict]:
    """Prints every issue and returns the creatives that are free of errors."""
    clean = []
    for creative in creatives:
        issues = claims.lint_creative(creative, segments)
        for issue in issues:
            print(f"  {issue.level.upper():7} {creative['id']} / {issue.field}: {issue.message}")
        if claims.has_errors(issues):
            print(f"  BLOCKED {creative['id']}")
        else:
            clean.append(creative)
    print(f"Lint: {len(clean)} of {len(creatives)} creatives pass.")
    return clean


def stage_render(creatives: list[dict], segments: dict, ledger: dict, force: bool = False) -> None:
    for creative in creatives:
        out = OUTPUT_DIR / f"{creative['id']}.mp4"
        asset = ledger["assets"].setdefault(creative["id"], {})
        current = render.fingerprint(creative, segments, REMOTION)
        if out.exists() and asset.get("fingerprint") == current and not force:
            print(f"Render: {creative['id']} is unchanged, skipping.")
            continue
        info = render.render(creative, segments, REMOTION, out)
        asset["fingerprint"] = current
        save_ledger(ledger)
        print(f"Render: {out.relative_to(HERE)} ({info['duration']}s, {info['size_mb']} MB)")


def pending_services(creative_id: str, ledger: dict) -> list[str]:
    """Configured platforms this creative hasn't been sent to yet."""
    return [s for s in SERVICES if os.getenv(CHANNEL_ENV[s]) and f"{creative_id}:{s}" not in ledger["posts"]]


def stage_host(creatives: list[dict], ledger: dict) -> None:
    for creative in creatives:
        if not pending_services(creative["id"], ledger):
            print(f"Host: {creative['id']} has been sent to every configured platform, skipping.")
            continue
        path = OUTPUT_DIR / f"{creative['id']}.mp4"
        if not path.exists():
            raise PipelineError(f"{creative['id']} isn't rendered yet")
        sha = file_sha256(path)
        asset = ledger["assets"].setdefault(creative["id"], {})
        if asset.get("sha256") == sha and asset.get("public_url"):
            hosting.verify_public_url(asset["public_url"])
            print(f"Host: {creative['id']} is already hosted.")
            continue
        asset["public_url"], asset["storage_path"] = hosting.host(path, sha)
        asset["sha256"] = sha
        save_ledger(ledger)
        print(f"Host: {creative['id']} -> {asset['public_url']}")


def stage_cleanup(ledger: dict, client: BufferClient) -> None:
    """Deletes a hosted video once it's no longer needed. Buffer fetches the file
    when the post goes out, so drafts and queued posts still need it: only Buffer's
    own `sent` status, on every post of a creative, makes deleting safe."""
    hosted = {cid: asset for cid, asset in ledger["assets"].items() if asset.get("storage_path")}
    if not hosted:
        print("Cleanup: no hosted videos to check.")
        return
    org = os.getenv("BUFFER_ORG_ID")
    if not org:
        raise PipelineError("BUFFER_ORG_ID isn't set")
    channel_ids = sorted({post["channel_id"] for post in ledger["posts"].values()})
    fresh = client.posts(org, channel_ids) if channel_ids else {}

    for creative_id, asset in hosted.items():
        posts = [post for key, post in ledger["posts"].items() if key.startswith(f"{creative_id}:")]
        statuses = [fresh.get(post["post_id"], {}).get("status") for post in posts]
        pending = pending_services(creative_id, ledger)
        if not posts or pending or any(status != "sent" for status in statuses):
            reason = f"still to send to {', '.join(pending)}" if pending else f"post status: {statuses or 'none'}"
            print(f"Cleanup: keeping {creative_id} ({reason}).")
            continue
        hosting.delete(asset["storage_path"])
        del asset["storage_path"], asset["public_url"]
        save_ledger(ledger)
        print(f"Cleanup: deleted the hosted video for {creative_id}.")


def check_channels(client: BufferClient) -> dict[str, str]:
    """Stops a post reaching the wrong brand's channel: every configured ID must
    be in this organization and on the expected network."""
    org = os.getenv("BUFFER_ORG_ID")
    if not org:
        raise PipelineError("BUFFER_ORG_ID isn't set (run `channels` to find it)")
    channels = {c["id"]: c for c in client.channels(org)}
    configured = {}
    for service in SERVICES:
        channel_id = os.getenv(CHANNEL_ENV[service])
        if not channel_id:
            print(f"Buffer: {CHANNEL_ENV[service]} isn't set, skipping {service}.")
            continue
        channel = channels.get(channel_id)
        if channel is None:
            raise PipelineError(f"{CHANNEL_ENV[service]} isn't a channel in organization {org}")
        if channel["service"] != service:
            raise PipelineError(f"{CHANNEL_ENV[service]} is a {channel['service']} channel, expected {service}")
        if channel.get("isQueuePaused"):
            print(f"Buffer: warning, the {service} queue is paused, so queued posts won't go out.")
        configured[service] = channel_id
    if not configured:
        raise PipelineError("No BUFFER_CHANNEL_* values are set")
    return configured


def stage_queue(
    creatives: list[dict], batch: str, ledger: dict, mode: str, live: bool, client: BufferClient | None = None
) -> int:
    """Sends posts to Buffer, or prints what would be sent. Returns the failure count."""
    if mode == "queue":
        not_approved = [c["id"] for c in creatives if not c.get("approved")]
        if not_approved:
            print(f"Queue: not approved by a human, skipping: {', '.join(not_approved)}")
        creatives = [c for c in creatives if c.get("approved")]

    channels = {}
    if live:
        client = client or buffer_client()
        channels = check_channels(client)

    failures = 0
    for creative in creatives:
        for service in SERVICES:
            key = f"{creative['id']}:{service}"
            existing = ledger["posts"].get(key)
            if existing:
                print(f"Queue: {key} already sent as {existing['post_id']}, skipping.")
                continue
            text = caption_for(creative, service, batch)
            if not live:
                # With no channels set up yet, preview every platform.
                if os.getenv(CHANNEL_ENV[service]) or not any(os.getenv(name) for name in CHANNEL_ENV.values()):
                    print(f"Queue (dry run, {mode}): {key}\n    {text!r}")
                continue
            if service not in channels:
                continue
            asset = ledger["assets"].get(creative["id"], {})
            path = OUTPUT_DIR / f"{creative['id']}.mp4"
            if not asset.get("public_url") or not path.exists() or file_sha256(path) != asset.get("sha256"):
                print(f"Queue: {key} FAILED: the rendered file isn't hosted (or changed since). Run `upload`.")
                failures += 1
                continue
            post_input = build_post_input(creative, service, channels[service], asset["public_url"], text, mode)
            try:
                post = client.create_post(post_input)
            except BufferError as error:
                print(f"Queue: {key} FAILED: {error}")
                failures += 1
                continue
            ledger["posts"][key] = {
                "post_id": post["id"],
                "channel_id": channels[service],
                "mode": mode,
                "status": post.get("status"),
                "due_at": post.get("dueAt"),
            }
            save_ledger(ledger)
            print(f"Queue: {key} -> {post['id']} ({post.get('status')})")
    return failures


def print_summary(ledger: dict) -> None:
    """The report: asset, platform, queue status and next posting time."""
    posts = ledger["posts"]
    fresh = {}
    org = os.getenv("BUFFER_ORG_ID")
    if posts and os.getenv("BUFFER_API_KEY") and org:
        channel_ids = sorted({p["channel_id"] for p in posts.values()})
        try:
            fresh = BufferClient(os.environ["BUFFER_API_KEY"]).posts(org, channel_ids)
        except BufferError as error:
            print(f"(Showing the last known status. Buffer said: {error})")

    print("| Asset ID | Platform | Buffer post | Status | Next scheduled (UTC) |")
    print("|---|---|---|---|---|")
    if not posts:
        print("| (nothing sent to Buffer yet) | | | | |")
    for key in sorted(posts):
        creative_id, service = key.split(":")
        post = posts[key]
        live = fresh.get(post["post_id"], {})
        status = live.get("status") or post.get("status") or "unknown"
        due = live.get("dueAt") or post.get("due_at") or "not scheduled"
        print(f"| {creative_id} | {service} | {post['post_id']} | {status} | {due} |")


def cmd_check() -> int:
    """Reports what's ready. Only local tools are required; the rest is for --live."""
    ok = True
    for tool in ("node", "ffprobe"):
        found = shutil.which(tool)
        print(f"{'ok     ' if found else 'MISSING'} {tool}")
        ok = ok and bool(found)
    remotion = render.remotion_binary(REMOTION).exists()
    print(f"{'ok     ' if remotion else 'MISSING'} Remotion (run `npm i` in marketing/remotion)")
    ok = ok and remotion

    _, creatives, segments = load_content()
    for source in sorted({s["source"] for s in segments.values()}):
        exists = (REPO / source).exists()
        print(f"{'ok     ' if exists else 'MISSING'} footage {source}")
        ok = ok and exists

    print(f"{'ok     ' if hosting.is_configured() else 'not set'} media host (needed for --live)")
    if os.getenv("BUFFER_API_KEY"):
        try:
            channels = check_channels(buffer_client())
            print(f"ok      Buffer channels: {', '.join(channels)}")
        except (BufferError, PipelineError) as error:
            print(f"PROBLEM Buffer: {error}")
    else:
        print("not set BUFFER_API_KEY (needed for --live)")
    approved = sum(1 for c in creatives if c.get("approved"))
    print(f"info    {len(creatives)} creatives, {approved} approved for queueing")
    return 0 if ok else 1


def cmd_channels() -> int:
    client = buffer_client()
    for org in client.organizations():
        print(f"Organization {org['name']}: BUFFER_ORG_ID={org['id']}")
        for channel in client.channels(org["id"]):
            label = channel.get("displayName") or channel.get("name")
            print(f"  {channel['service']:<12} {channel['id']}  {label}")
    return 0


def main() -> int:
    load_dotenv(HERE / ".env.pipeline")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="Report which tools, footage and credentials are ready")
    commands.add_parser("channels", help="List Buffer organization and channel IDs")
    commands.add_parser("status", help="Print the summary table")
    commands.add_parser("cleanup", help="Delete hosted videos whose posts Buffer reports as sent")

    def add(name: str, help_text: str, *, sending: bool = False) -> argparse.ArgumentParser:
        sub = commands.add_parser(name, help=help_text)
        sub.add_argument("--only", nargs="+", metavar="ID", help="Limit to these creative ids")
        if name in ("render", "run"):
            sub.add_argument("--force", action="store_true", help="Re-render even if unchanged")
        if sending:
            sub.add_argument("--live", action="store_true", help="Really call external services (default: dry run)")
            sub.add_argument(
                "--mode", choices=("draft", "queue"), default="draft",
                help="draft: Buffer drafts, nothing publishes. queue: approved creatives publish on Buffer's schedule.",
            )
        return sub

    add("lint", "Check all copy against STORY.md's claims rules")
    add("render", "Render 1080x1920 videos to generated_assets/")
    add("upload", "Host rendered videos at public URLs")
    add("queue", "Send to Buffer (dry run unless --live)", sending=True)
    add("run", "lint + render + (with --live) upload + queue", sending=True)
    args = parser.parse_args()

    try:
        if args.command == "check":
            return cmd_check()
        if args.command == "channels":
            return cmd_channels()
        ledger = load_ledger()
        if args.command == "status":
            print_summary(ledger)
            return 0
        if args.command == "cleanup":
            stage_cleanup(ledger, buffer_client())
            return 0

        batch, creatives, segments = load_content(args.only)
        clean = stage_lint(creatives, segments)
        blocked = len(clean) < len(creatives)
        if args.command == "lint":
            return 1 if blocked else 0
        if args.command in ("render", "run"):
            stage_render(clean, segments, ledger, force=args.force)
        if args.command == "upload" or (args.command == "run" and args.live):
            stage_host(clean, ledger)
        failures = 0
        if args.command in ("queue", "run"):
            failures = stage_queue(clean, batch, ledger, args.mode, args.live)
            print_summary(ledger)
        if args.command == "run" and args.live:
            stage_cleanup(ledger, buffer_client())
        return 1 if blocked or failures else 0
    except (PipelineError, BufferError, hosting.HostingError, render.RenderError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
