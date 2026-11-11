"""Thin client for Buffer's GraphQL API (https://developers.buffer.com).

Mutations are never retried automatically: a timeout can hide a post that was in
fact created, and a blind retry would publish it twice.
"""

import requests

ENDPOINT = "https://api.buffer.com"

# Our name for each platform -> Buffer's Channel.service value.
SERVICES = ("youtube", "tiktok", "instagram", "twitter")

# Frame used as the cover on platforms that support choosing one. Far enough in
# that the first beat's text is on screen.
THUMBNAIL_OFFSET_MS = 1500

YOUTUBE_CATEGORY_SCIENCE_TECH = "28"

CREATE_POST = """
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id status dueAt } }
    ... on MutationError { message }
  }
}
"""

ORGANIZATIONS = "query { account { organizations { id name } } }"

CHANNELS = """
query Channels($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) {
    id name displayName service isQueuePaused
  }
}
"""

POSTS = """
query Posts($organizationId: OrganizationId!, $channelIds: [ChannelId!]) {
  posts(first: 100, input: {
    organizationId: $organizationId
    filter: { channelIds: $channelIds }
    sort: [{ field: dueAt, direction: desc }]
  }) {
    edges { node { id status dueAt channelId } }
  }
}
"""


class BufferError(RuntimeError):
    pass


def build_post_input(
    creative: dict, service: str, channel_id: str, media_url: str, text: str, mode: str, due_at: str | None = None
) -> dict:
    """The CreatePostInput for one creative on one channel. mode: draft | queue.
    due_at (ISO 8601) publishes at that time instead of the next queue slot."""
    video: dict = {"url": media_url}
    if service in ("instagram", "tiktok"):
        video["metadata"] = {"thumbnailOffset": THUMBNAIL_OFFSET_MS}

    post = {
        "text": text,
        "channelId": channel_id,
        "schedulingType": "automatic",
        "mode": "addToQueue",
        "assets": [{"video": video}],
        "aiAssisted": True,  # The copy is drafted by the marketing agent.
    }
    if mode == "draft":
        post["saveToDraft"] = True
    elif due_at:
        post["mode"] = "customScheduled"
        post["dueAt"] = due_at

    if service == "youtube":
        post["metadata"] = {
            "youtube": {
                "title": creative["captions"]["youtube_title"],
                "categoryId": YOUTUBE_CATEGORY_SCIENCE_TECH,
                # The audience is adults choosing filters, parents included, so
                # this is not "made for kids" content under YouTube's rules.
                "madeForKids": False,
            }
        }
    elif service == "instagram":
        post["metadata"] = {"instagram": {"type": "reel", "shouldShareToFeed": True}}
    return post


class BufferClient:
    def __init__(self, api_key: str, session=None):
        self._key = api_key
        self._http = session or requests.Session()

    def _gql(self, query: str, variables: dict | None = None) -> dict:
        response = self._http.post(
            ENDPOINT,
            json={"query": query, "variables": variables or {}},
            headers={"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"},
            timeout=60,
        )
        if response.status_code != 200:
            raise BufferError(f"HTTP {response.status_code}: {response.text[:300]}")
        body = response.json()
        # GraphQL reports auth and server failures in `errors`, still with HTTP 200.
        if body.get("errors"):
            raise BufferError("; ".join(e.get("message", "unknown error") for e in body["errors"]))
        return body["data"]

    def organizations(self) -> list[dict]:
        return self._gql(ORGANIZATIONS)["account"]["organizations"]

    def channels(self, organization_id: str) -> list[dict]:
        return self._gql(CHANNELS, {"organizationId": organization_id})["channels"]

    def create_post(self, post_input: dict) -> dict:
        result = self._gql(CREATE_POST, {"input": post_input})["createPost"]
        if "post" not in result:
            raise BufferError(result.get("message", "createPost failed without a message"))
        return result["post"]

    def posts(self, organization_id: str, channel_ids: list[str]) -> dict[str, dict]:
        data = self._gql(POSTS, {"organizationId": organization_id, "channelIds": channel_ids})
        return {edge["node"]["id"]: edge["node"] for edge in data["posts"]["edges"]}
