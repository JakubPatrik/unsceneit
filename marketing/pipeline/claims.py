"""Copy lint: enforces STORY.md's "Claims to avoid" on every piece of social copy.

Errors block a creative from leaving the machine. Warnings are printed for the
human reviewer. Keep the rules in sync with STORY.md.
"""

import re
from dataclasses import dataclass

CAPTION_LIMITS = {"youtube": 5000, "tiktok": 2200, "instagram": 2196, "twitter": 280}
YOUTUBE_TITLE_LIMIT = 100
BEAT_TEXT_LIMIT = 64  # What fits in three lines of the video overlay.

_I = re.IGNORECASE

ERROR_RULES = [
    (re.compile(r"\bguarantee[sd]?\b|\b100\s?%|\bperfect(ly)?\b|\bflawless|\bfoolproof|\bcatch(es)? (every|all)\b", _I),
     "promises perfection; say 'helps you avoid' or 'automatically hides'"),
    (re.compile(r"\b(any|all) videos?\b", _I),
     "don't claim every video; say 'videos in the unscene.it library, plus 20 free minutes of live AI a month for the rest'"),
    (re.compile(r"netflix|disney|hulu|\bhbo\b|prime video|apple tv|streaming services?", _I),
     "DRM services aren't supported; say 'works on YouTube'"),
    (re.compile(r"nothing leaves|never leaves|stays on your (device|computer)|on[- ]device|fully private", _I),
     "false privacy claim; say 'no video files are uploaded'"),
    (re.compile(r"helps? other (viewers|people|users)|helping other|into the (shared )?library|adds? to the library", _I),
     "never say live AI screenings feed the shared library"),
    (re.compile(r"sensitivity|strictness|\bsliders?\b", _I),
     "sensitivity settings don't exist"),
    (re.compile(r"custom filters?|create your own filter|\bcredits?\b", _I),
     "custom filters and credits aren't in the alpha"),
    (re.compile(r"human review|real person|our team (watches|reviews)|\bmoderators?\b", _I),
     "don't imply a human watches; Xenia isn't a real person"),
    (re.compile(r"openai|\bgpt\b|\bluna\b|gemini|anthropic|\bclaude\b", _I),
     "don't name the AI vendor without checking with the founder"),
    (re.compile(r"firefox|safari|microsoft edge|edge browser|\bbrave\b|\biphone\b|\bandroid\b|mobile app", _I),
     "Chrome only for now"),
    (re.compile(r"(?<!nothing is )(?<!nothing gets )(?<!no )(?<!never )\bskip(s|ped|ping)?\b", _I),
     "scenes are blurred, not skipped"),
]

WARNING_RULES = [
    (re.compile(r"\bcensor|\bnanny", _I), "Xenia is never a censor or a nanny; check the framing"),
    (re.compile(r"clickbait|distract|productivity|\bfocus\b", _I),
     "off-positioning: STORY.md leads with personal scene filtering, not focus"),
    (re.compile(r"\b(dirty|filthy|sinful|immoral|inappropriate|degenerate)\b", _I),
     "tone: describe what gets hidden, never moralize"),
    (re.compile(r"\bcures?\b|\btreat(s|ment)?\b|\btherap|\bheals?\b", _I),
     "reads as a medical claim for phobia or trauma viewers"),
    (re.compile(r"safe for (kids|children)|kid[- ]safe|child[- ]safe", _I),
     "absolute safety claim; AI can miss a scene"),
    (re.compile(r"\bunlimited\b", _I),
     "only library filtering is unlimited; never imply live AI is"),
    (re.compile(r"\bdanc(e|es|ing)\b", _I),
     "founder's call: say 'revealing and sexualized content' rather than singling out dancing"),
]

_NAME = re.compile(r"(?<![#\w])un[\s-]?(?:scene|seen)(?:[\s.]?it)?\b", _I)
_PRO = re.compile(r"\bPro\b")
_LIVE_AI = re.compile(r"live ai", _I)
_TWENTY = re.compile(r"\b20\b")


@dataclass(frozen=True)
class Issue:
    level: str  # "error" or "warning"
    field: str
    message: str


def utf16_len(text: str) -> int:
    """Buffer counts UTF-16 code units, so an emoji counts as two."""
    return len(text.encode("utf-16-le")) // 2


def _check_text(field: str, text: str) -> list[Issue]:
    issues = []
    for rules, level in ((ERROR_RULES, "error"), (WARNING_RULES, "warning")):
        for pattern, message in rules:
            match = pattern.search(text)
            if match:
                issues.append(Issue(level, field, f'"{match.group(0)}": {message}'))
    for match in _NAME.finditer(text):
        word = match.group(0)
        # "unseen" alone is an ordinary English word; only flag it next to "it".
        if word != "unscene.it" and not (word.lower() == "unseen"):
            issues.append(Issue("error", field, f'brand is always "unscene.it", found "{word}"'))
    if _PRO.search(text) and "waitlist" not in text.lower():
        issues.append(Issue("error", field, 'Pro only belongs next to the waitlist; it doesn\'t exist yet'))
    if _LIVE_AI.search(text) and not _TWENTY.search(text):
        issues.append(Issue("error", field, "mentions live AI without its limit (20 free minutes a month)"))
    return issues


def lint_creative(creative: dict, segments: dict) -> list[Issue]:
    issues = []
    captions = creative.get("captions", {})
    beats = creative.get("beats", [])

    if not beats:
        issues.append(Issue("error", "beats", "needs at least one beat"))
    for i, beat in enumerate(beats):
        field = f"beats[{i}]"
        if beat.get("segment") not in segments:
            issues.append(Issue("error", field, f'unknown or unapproved footage segment "{beat.get("segment")}"'))
        if len(beat.get("text", "")) > BEAT_TEXT_LIMIT:
            issues.append(Issue("error", field, f"overlay text is over {BEAT_TEXT_LIMIT} characters"))
    issues += _check_text("beats", " ".join(b.get("text", "") for b in beats))

    title = captions.get("youtube_title", "")
    if not title:
        issues.append(Issue("error", "youtube_title", "YouTube needs a title"))
    if utf16_len(title) > YOUTUBE_TITLE_LIMIT or "<" in title or ">" in title:
        issues.append(Issue("error", "youtube_title", f"must be {YOUTUBE_TITLE_LIMIT} characters or fewer, without < or >"))
    issues += _check_text("youtube_title", title)

    for service, limit in CAPTION_LIMITS.items():
        caption = captions.get(service, "")
        if not caption:
            issues.append(Issue("error", service, "caption is missing"))
            continue
        # {link} expands to about 95 characters with its UTM parameters.
        length = utf16_len(caption.replace("{link}", "x" * 95))
        if length > limit:
            issues.append(Issue("error", service, f"caption is {length} characters, limit is {limit}"))
        issues += _check_text(service, caption)
    return issues


def has_errors(issues: list[Issue]) -> bool:
    return any(issue.level == "error" for issue in issues)
