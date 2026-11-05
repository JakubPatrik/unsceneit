"""Gets a rendered video to a public URL, which is what Buffer needs.

Buffer has no upload endpoint: it fetches the file from this URL when the post
goes out. So the URL is only a pickup point, and has to keep working until then.
"""

import os
from pathlib import Path

import requests

DEFAULT_BUCKET = "marketing-media"


class HostingError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(os.getenv("MEDIA_BASE_URL") or _supabase())


def _supabase() -> tuple[str, dict, str] | None:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY", "")
    if not url or not key:
        return None
    return url, {"Authorization": f"Bearer {key}", "apikey": key}, os.getenv("SUPABASE_BUCKET") or DEFAULT_BUCKET


def host(path: Path, sha256: str) -> tuple[str, str | None]:
    """Returns (public URL, storage path), after checking that the URL really works.
    The storage path is None for files we can't delete, under MEDIA_BASE_URL."""
    base = os.getenv("MEDIA_BASE_URL", "").rstrip("/")
    if base:
        url, storage_path = f"{base}/{path.name}", None
    else:
        url, storage_path = _upload_to_supabase(path, sha256)
    verify_public_url(url)
    return url, storage_path


def _ensure_public_bucket(url: str, headers: dict, bucket: str) -> None:
    existing = requests.get(f"{url}/storage/v1/bucket/{bucket}", headers=headers, timeout=30)
    if existing.status_code == 200:
        if not existing.json().get("public"):
            raise HostingError(f'Supabase bucket "{bucket}" exists but is private; Buffer needs a public one')
        return
    created = requests.post(
        f"{url}/storage/v1/bucket",
        headers=headers,
        json={"id": bucket, "name": bucket, "public": True, "allowed_mime_types": ["video/mp4"]},
        timeout=30,
    )
    if created.status_code != 200:
        raise HostingError(f"Couldn't create Supabase bucket, HTTP {created.status_code}: {created.text[:300]}")


def _upload_to_supabase(path: Path, sha256: str) -> tuple[str, str]:
    config = _supabase()
    if not config:
        raise HostingError("No media host: set SUPABASE_SECRET_KEY (or MEDIA_BASE_URL) in .env.pipeline")
    url, headers, bucket = config
    _ensure_public_bucket(url, headers, bucket)
    # The hash in the name keeps the URL stable for a queued post even if this
    # creative is re-rendered later: the new render gets its own URL.
    object_name = f"{path.stem}-{sha256[:12]}.mp4"
    with path.open("rb") as video:
        response = requests.post(
            f"{url}/storage/v1/object/{bucket}/{object_name}",
            headers={**headers, "Content-Type": "video/mp4", "x-upsert": "true"},
            data=video,
            timeout=600,
        )
    if response.status_code != 200:
        raise HostingError(f"Supabase upload failed, HTTP {response.status_code}: {response.text[:300]}")
    return f"{url}/storage/v1/object/public/{bucket}/{object_name}", f"{bucket}/{object_name}"


def delete(storage_path: str) -> None:
    config = _supabase()
    if not config:
        raise HostingError("Can't delete from Supabase: SUPABASE_SECRET_KEY isn't set")
    url, headers, _ = config
    response = requests.delete(f"{url}/storage/v1/object/{storage_path}", headers=headers, timeout=30)
    if response.status_code != 200:
        raise HostingError(f"Supabase delete failed, HTTP {response.status_code}: {response.text[:300]}")


def verify_public_url(url: str) -> None:
    """Buffer's bar for media: public, direct, HTTPS. It fails silently otherwise."""
    if not url.startswith("https://"):
        raise HostingError(f"Media URL must be HTTPS: {url}")
    with requests.get(url, stream=True, allow_redirects=False, timeout=30) as response:
        content_type = response.headers.get("Content-Type", "")
        if response.status_code != 200 or not content_type.startswith("video/"):
            raise HostingError(
                f"{url} isn't a direct public video (HTTP {response.status_code}, Content-Type {content_type!r})"
            )
