"""Offline tests for the rules that protect against bad posts. No network needed.

Run from marketing/pipeline: .venv/bin/python -m unittest discover tests
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import claims  # noqa: E402
import run_pipeline as rp  # noqa: E402
from buffer_api import BufferClient, BufferError, build_post_input  # noqa: E402

SEGMENTS = {"thumbs": {}}


def creative(text="Your filters.", caption="Hides what you pick on unscene.it.", **extra):
    return {
        "id": "test-01",
        "beats": [{"segment": "thumbs", "text": text}],
        "captions": {
            "youtube_title": "A title",
            "youtube": caption,
            "tiktok": caption,
            "instagram": caption,
            "twitter": caption,
        },
        **extra,
    }


def errors_for(**kwargs):
    return [i for i in claims.lint_creative(creative(**kwargs), SEGMENTS) if i.level == "error"]


class ClaimsTest(unittest.TestCase):
    def test_clean_copy_passes(self):
        self.assertEqual(errors_for(), [])

    def test_banned_claims_are_errors(self):
        for text in [
            "Works on Netflix",
            "It works on any video",
            "100% accurate",
            "Guaranteed to catch them",
            "Nothing leaves your device",
            "Adjust the sensitivity",
            "Make custom filters",
            "Powered by OpenAI",
            "Now on Firefox",
            "It skips the scene",
            "Your screenings help other viewers",
        ]:
            with self.subTest(text=text):
                self.assertTrue(errors_for(caption=text))

    def test_live_ai_needs_its_limit(self):
        self.assertTrue(errors_for(caption="Turn on live AI"))
        self.assertEqual(errors_for(caption="Live AI, 20 free minutes a month"), [])

    def test_blurred_not_skipped_wording_is_allowed(self):
        self.assertEqual(errors_for(caption="Nothing is skipped"), [])

    def test_brand_spelling(self):
        for text in ["Try Unscene.it", "unscene it now", "Unscene is great"]:
            with self.subTest(text=text):
                self.assertTrue(errors_for(caption=text))

    def test_x_length_counts_utf16_and_the_link(self):
        self.assertEqual(errors_for(caption="a" * 280), [])
        self.assertTrue(errors_for(caption="a" * 281))
        self.assertEqual(claims.utf16_len("🙂"), 2)
        self.assertTrue(errors_for(caption="🙂" * 141))
        self.assertTrue(errors_for(caption="a" * 190 + " {link}"))

    def test_footage_outside_the_allowlist_is_blocked(self):
        bad = creative()
        bad["beats"][0]["segment"] = "movie-trailer"
        self.assertTrue(claims.has_errors(claims.lint_creative(bad, SEGMENTS)))

    def test_shipped_creatives_pass(self):
        _, creatives, segments = rp.load_content()
        for item in creatives:
            with self.subTest(id=item["id"]):
                issues = claims.lint_creative(item, segments)
                self.assertEqual([i for i in issues if i.level == "error"], [])
                self.assertFalse(item["approved"], "only a human approves a creative")


class PostInputTest(unittest.TestCase):
    def test_draft_flag_only_in_draft_mode(self):
        draft = build_post_input(creative(), "twitter", "c", "https://x/v.mp4", "t", "draft")
        queued = build_post_input(creative(), "twitter", "c", "https://x/v.mp4", "t", "queue")
        self.assertTrue(draft["saveToDraft"])
        self.assertNotIn("saveToDraft", queued)
        self.assertEqual(queued["mode"], "addToQueue")

    def test_youtube_has_required_metadata_and_is_not_made_for_kids(self):
        post = build_post_input(creative(), "youtube", "c", "https://x/v.mp4", "t", "draft")
        youtube = post["metadata"]["youtube"]
        self.assertEqual(youtube["title"], "A title")
        self.assertTrue(youtube["categoryId"])
        self.assertIs(youtube["madeForKids"], False)

    def test_instagram_is_a_reel(self):
        post = build_post_input(creative(), "instagram", "c", "https://x/v.mp4", "t", "draft")
        self.assertEqual(post["metadata"]["instagram"], {"type": "reel", "shouldShareToFeed": True})

    def test_caption_link_has_utm(self):
        item = creative(caption="See {link}")
        text = rp.caption_for(item, "twitter", "batch-1")
        self.assertIn("utm_source=x", text)
        self.assertIn("utm_campaign=batch-1", text)
        self.assertIn("utm_content=test-01", text)


class FakeClient:
    def __init__(self, fail=False):
        self.sent = []
        self.fail = fail

    def channels(self, _org):
        return [
            {"id": "yt", "service": "youtube"},
            {"id": "tt", "service": "tiktok"},
            {"id": "ig", "service": "instagram"},
            {"id": "xx", "service": "twitter"},
        ]

    def create_post(self, post_input):
        if self.fail:
            raise BufferError("limit reached")
        self.sent.append(post_input)
        return {"id": f"post-{len(self.sent)}", "status": "draft", "dueAt": None}


ENV = {
    "BUFFER_ORG_ID": "org",
    "BUFFER_CHANNEL_YOUTUBE": "yt",
    "BUFFER_CHANNEL_TIKTOK": "tt",
    "BUFFER_CHANNEL_INSTAGRAM": "ig",
    "BUFFER_CHANNEL_X": "xx",
}


class QueueGuardsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        tmp = Path(self.tmp.name)
        video = tmp / "test-01.mp4"
        video.write_bytes(b"video")
        self.ledger = {
            "assets": {"test-01": {"public_url": "https://host/v.mp4", "sha256": rp.file_sha256(video)}},
            "posts": {},
        }
        for patcher in (
            mock.patch.object(rp, "OUTPUT_DIR", tmp),
            mock.patch.object(rp, "LEDGER", tmp / "ledger.json"),
            mock.patch.dict(os.environ, ENV),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def run_queue(self, item, mode="draft", live=True, client=None):
        client = client or FakeClient()
        failures = rp.stage_queue([item], "b", self.ledger, mode, live, client)
        return client, failures

    def test_posts_are_recorded_in_the_patched_ledger_only(self):
        real = rp.HERE / "ledger.json"
        before = real.read_bytes() if real.exists() else None
        self.run_queue(creative())
        self.assertEqual(real.read_bytes() if real.exists() else None, before)
        self.assertEqual(len(json.loads(rp.LEDGER.read_text())["posts"]), 4)

    def test_dry_run_sends_nothing(self):
        client, _ = self.run_queue(creative(approved=True), live=False)
        self.assertEqual(client.sent, [])
        self.assertEqual(self.ledger["posts"], {})

    def test_draft_mode_sends_to_each_channel_as_a_draft(self):
        client, failures = self.run_queue(creative())
        self.assertEqual(failures, 0)
        self.assertEqual(len(client.sent), 4)
        self.assertTrue(all(p["saveToDraft"] for p in client.sent))

    def test_queue_mode_refuses_unapproved_creatives(self):
        client, _ = self.run_queue(creative(approved=False), mode="queue")
        self.assertEqual(client.sent, [])

    def test_queue_mode_sends_approved_creatives_for_real(self):
        client, _ = self.run_queue(creative(approved=True), mode="queue")
        self.assertEqual(len(client.sent), 4)
        self.assertTrue(all("saveToDraft" not in p for p in client.sent))

    def test_rerun_does_not_post_twice(self):
        first, _ = self.run_queue(creative())
        second, _ = self.run_queue(creative())
        self.assertEqual(len(first.sent), 4)
        self.assertEqual(second.sent, [])

    def test_failed_post_is_not_recorded_so_it_can_be_retried(self):
        _, failures = self.run_queue(creative(), client=FakeClient(fail=True))
        self.assertEqual(failures, 4)
        self.assertEqual(self.ledger["posts"], {})

    def test_changed_render_is_not_sent_with_the_old_url(self):
        (rp.OUTPUT_DIR / "test-01.mp4").write_bytes(b"new render")
        client, failures = self.run_queue(creative())
        self.assertEqual(client.sent, [])
        self.assertEqual(failures, 4)

    def test_channel_on_the_wrong_network_stops_everything(self):
        with mock.patch.dict(os.environ, {"BUFFER_CHANNEL_X": "yt"}):
            with self.assertRaises(rp.PipelineError):
                self.run_queue(creative())

    def test_channel_from_another_organization_stops_everything(self):
        with mock.patch.dict(os.environ, {"BUFFER_CHANNEL_X": "someone-elses"}):
            with self.assertRaises(rp.PipelineError):
                self.run_queue(creative())


class CleanupTest(unittest.TestCase):
    """Deleting too early would make Buffer fail the post when it fetches the file."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.ledger = {
            "assets": {"a": {"public_url": "https://host/a.mp4", "storage_path": "bucket/a.mp4", "sha256": "x"}},
            "posts": {"a:youtube": {"post_id": "p1", "channel_id": "yt"}},
        }
        env = {"BUFFER_ORG_ID": "org", "BUFFER_CHANNEL_YOUTUBE": "yt"}
        unset = ("BUFFER_CHANNEL_TIKTOK", "BUFFER_CHANNEL_INSTAGRAM", "BUFFER_CHANNEL_X")
        patchers = [
            mock.patch.object(rp, "LEDGER", Path(self.tmp.name) / "ledger.json"),
            mock.patch.dict(os.environ, env),
            mock.patch.object(rp.hosting, "delete"),
        ]
        for patcher in patchers:
            started = patcher.start()
            self.addCleanup(patcher.stop)
        self.delete = started
        for name in unset:
            os.environ.pop(name, None)

    def run_cleanup(self, status):
        client = mock.Mock()
        client.posts.return_value = {"p1": {"id": "p1", "status": status}} if status else {}
        rp.stage_cleanup(self.ledger, client)

    def test_deletes_once_buffer_says_sent(self):
        self.run_cleanup("sent")
        self.delete.assert_called_once_with("bucket/a.mp4")
        self.assertNotIn("public_url", self.ledger["assets"]["a"])
        self.assertNotIn("storage_path", self.ledger["assets"]["a"])

    def test_keeps_the_file_for_every_other_status(self):
        for status in ("draft", "scheduled", "sending", "needs_approval", "error", None):
            with self.subTest(status=status):
                self.run_cleanup(status)
                self.delete.assert_not_called()

    def test_keeps_the_file_while_another_platform_still_needs_it(self):
        with mock.patch.dict(os.environ, {"BUFFER_CHANNEL_X": "xx"}):
            self.run_cleanup("sent")
        self.delete.assert_not_called()

    def test_files_it_cant_delete_are_ignored(self):
        del self.ledger["assets"]["a"]["storage_path"]
        self.run_cleanup("sent")
        self.delete.assert_not_called()

    def test_sent_creative_is_not_uploaded_again(self):
        with mock.patch.object(rp.hosting, "host") as host:
            rp.stage_host([{"id": "a"}], self.ledger)
        host.assert_not_called()


class SupabaseHostingTest(unittest.TestCase):
    ENV = {"SUPABASE_URL": "https://x.supabase.co/", "SUPABASE_SECRET_KEY": "key", "MEDIA_BASE_URL": ""}

    def test_uploads_to_a_public_url_that_keeps_the_hash(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, self.ENV), mock.patch.object(
            rp.hosting.requests, "get"
        ) as get, mock.patch.object(rp.hosting.requests, "post") as post:
            get.return_value = mock.Mock(status_code=200, json=lambda: {"public": True})
            post.return_value = mock.Mock(status_code=200)
            video = Path(tmp) / "a.mp4"
            video.write_bytes(b"v")
            url, storage_path = rp.hosting._upload_to_supabase(video, "abcdef123456789")
        self.assertEqual(url, "https://x.supabase.co/storage/v1/object/public/marketing-media/a-abcdef123456.mp4")
        self.assertEqual(storage_path, "marketing-media/a-abcdef123456.mp4")
        self.assertEqual(post.call_args.kwargs["headers"]["Content-Type"], "video/mp4")

    def test_refuses_a_private_bucket(self):
        with mock.patch.object(rp.hosting.requests, "get") as get:
            get.return_value = mock.Mock(status_code=200, json=lambda: {"public": False})
            with self.assertRaisesRegex(rp.hosting.HostingError, "private"):
                rp.hosting._ensure_public_bucket("https://x", {}, "b")

    def test_redirects_and_non_video_urls_fail_verification(self):
        for status, content_type in ((302, "video/mp4"), (200, "text/html")):
            with self.subTest(status=status), mock.patch.object(rp.hosting.requests, "get") as get:
                response = mock.MagicMock(status_code=status, headers={"Content-Type": content_type})
                response.__enter__.return_value = response
                get.return_value = response
                with self.assertRaises(rp.hosting.HostingError):
                    rp.hosting.verify_public_url("https://x/v.mp4")


class BufferClientTest(unittest.TestCase):
    def client_returning(self, body):
        session = mock.Mock()
        session.post.return_value = mock.Mock(status_code=200, json=lambda: body, text=json.dumps(body))
        return BufferClient("key", session=session), session

    def test_sends_bearer_key_to_the_graphql_endpoint(self):
        client, session = self.client_returning({"data": {"createPost": {"post": {"id": "p"}}}})
        self.assertEqual(client.create_post({"text": "t"})["id"], "p")
        args, kwargs = session.post.call_args
        self.assertEqual(args[0], "https://api.buffer.com")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer key")
        self.assertEqual(kwargs["json"]["variables"], {"input": {"text": "t"}})

    def test_graphql_errors_with_http_200_raise(self):
        client, _ = self.client_returning({"errors": [{"message": "Unauthorized"}]})
        with self.assertRaisesRegex(BufferError, "Unauthorized"):
            client.organizations()

    def test_typed_mutation_error_raises_its_message(self):
        client, _ = self.client_returning({"data": {"createPost": {"message": "Limit reached"}}})
        with self.assertRaisesRegex(BufferError, "Limit reached"):
            client.create_post({})


if __name__ == "__main__":
    unittest.main()
