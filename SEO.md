# SEO plan: Chrome Web Store listing

Oct 17, 2026 · @Jakub

A plan for making the unscene.it Chrome Web Store listing rank for the searches people are making now. Research is split into workstreams that separate agents can run in parallel. Each workstream writes its findings to its own file under `seo/`. Once they're all in, the results get merged into a rewritten listing (Phase 3).

- **Live listing:** https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid
- **Current copy:** [store/listing.md](store/listing.md) (name, summary, description, category)
- **Source of truth for claims:** [STORY.md](STORY.md). Every keyword we target has to describe something the alpha actually does.

## Goal

Get more organic installs from Chrome Web Store search (and from Google searches that land on the store page) by targeting keywords that have real, current demand **and** describe what unscene.it does today.

Success = more store impressions and a better impression-to-install rate in the developer dashboard, compared with the 4 weeks before the change (see Measurement).

## Hard constraints (every agent must respect these)

1. **Truthful to the alpha.** Don't target or write copy for things STORY.md lists under "Not in the alpha": live AI, filtering "any video", Netflix or Disney+, Pro, accounts, custom filters. "AI" is fine only in the sense that the library was screened by AI, frame by frame.
2. **YouTube only.** The extension runs on youtube.com (and on YouTube players embedded elsewhere). Don't plan around other sites.
3. **Chrome Web Store spam policy.** No keyword lists or blocks of tags, no repeating keywords unnaturally, no unattributed testimonials, no naming competitors or other brands in a misleading way. A listing that breaks these can be rejected or taken down. Agents should cite the current policy text (Workstream E).
4. **Brand.** The name always starts with "unscene.it" (lowercase). Keywords can follow it, e.g. `unscene.it: <keyword phrase>`.
5. **Field limits** (to be confirmed in Workstream E): name max 75 chars, summary max 132 chars, description max 16,000 chars. The name and summary come from `extension/manifest.json` (`name`, `description`), so changing them means shipping a new version. The description, screenshots and promo tiles can be edited in the dashboard without a new version.

## What we already target (baseline)

| Field | Now | Keywords it covers |
|---|---|---|
| Name | `unscene.it` | brand only. **This is the biggest gap**: the name is the field that carries the most weight in store search. |
| Summary | "Hide the scenes you'd rather not see. Pick your filters once and keep watching while the story plays on." | hide scenes, filters (both weak) |
| Description | see listing.md | blood and gore, spiders, insects, age limit, parents, phobia, trauma triggers, thumbnails blurred, YouTube |
| Category | Entertainment | |

Seed keyword ideas to test (hypotheses, not decisions): YouTube filter, YouTube parental control, family safe YouTube, kid safe YouTube, content filter for YouTube, blur YouTube, blur thumbnails, hide gore, gore blocker, spider blocker, arachnophobia, trigger warning, sensitive content filter, NSFW blur, mature content blocker, age filter, clean YouTube, safe viewing, digital wellbeing, AI content filter.

## Phase 1: research (parallel, one agent per workstream)

Each agent writes `seo/<letter>-<slug>.md` with: findings, a table of keywords (term · evidence of demand · trend direction · relevance to the alpha 1–5 · competition), sources with URLs and access dates, and a short "recommendations" section. Dates matter: we want what's trending in **2026**, so mark anything older than 12 months as stale.

### A. Keyword demand and trends → `seo/a-keywords.md`

- Expand the seed list using Chrome Web Store search autocomplete, Google autocomplete and "People also ask", Google Trends (past 12 months and past 5 years, worldwide plus US, UK, DE, IN, BR) and YouTube search autocomplete.
- For each term, record the evidence of demand (Trends interest, autocomplete presence, keyword tool volume if any free tool is available), whether it's rising, flat or falling, and its relevance to what the alpha does.
- Flag rising terms we haven't thought of, especially around parenting, phobias, "brain rot" or digital wellbeing, AI safety and blur/hide tools.
- Output: a ranked shortlist of 15–25 terms, split into **primary** (name or summary candidates), **secondary** (description) and **rejected** (with the reason).

### B. Competitor listings → `seo/b-competitors.md`

- Search the store for the top seed terms and record the top 10 results for each: name, summary, rating, user count, last update, category.
- Expected neighbours to check: YouTube parental control and blocker extensions (BlockTube, Video Blocker, Unhook-style distraction blockers, "SafeTube"-style kid filters), NSFW/image blurring extensions, trigger-warning and arachnophobia extensions, and scene-skipping services (VidAngel, ClearPlay, Enjoy Movies Your Way), even though they're outside the store.
- For the top 5 competitors: how they phrase the name and summary, which keywords they repeat in the description, screenshot style and captions.
- Output: the gaps where demand exists but the results are weak, old or poorly rated. Those are our best openings.

### C. Search intent and audience language → `seo/c-intent.md`

- Find how real people describe the problem: Reddit (r/Parenting, r/arachnophobia, r/emetophobia, r/youtube, r/chrome), parenting forums, Quora, and reviews of competing extensions (1–3 star reviews especially).
- Collect exact phrases ("how do I stop YouTube showing...", "is there an extension that blurs..."). These become description copy and FAQ lines.
- Map each phrase to one of our audiences in listing.md (parents, phobia/trauma triggers, modest viewing, families together).
- Output: the top 20 phrases with their sources, grouped by audience, and which audience has the most unmet demand.

### D. Google SEO for the store page → `seo/d-google.md`

- Which Google searches currently show Chrome Web Store pages in results (e.g. "youtube gore filter extension")? What title and meta description does Google show for a store page, and which listing fields does it pull them from?
- Do the website (https://unscene.it) and backlinks to the store page affect store ranking or Google ranking? List the realistic backlink sources (Product Hunt, AlternativeTo, "best parental control extensions 2026" roundups, Reddit) without doing any outreach.
- Output: recommendations for the store page and a short list of website changes that support it (titles, meta descriptions, a matching FAQ). Website work is out of scope for this plan beyond that list.

### E. Chrome Web Store ranking factors and policy → `seo/e-cws-rules.md`

- Current (2026) documentation and credible reports of what affects store search ranking: name, summary and description weighting, ratings and review count, install and retention numbers, update recency, Featured badge, localization.
- Confirm the field limits from Constraint 5, and whether the name in the manifest and the store name must match.
- The exact spam and keyword-stuffing policy text, plus examples of rejections.
- Localized listings: how `_locales` and per-language store descriptions work, and which languages are worth adding first, given demand from Workstream A.
- Output: a checklist of rules the final copy must pass, and the ranking factors we control, ranked by impact.

## Phase 2: synthesis (one agent, after A–E are done)

Write `seo/recommendation.md`:

1. **Keyword map.** 1–2 primary terms for the name, 3–4 for the summary and 8–12 secondary terms for the description, each one traceable to evidence in A or C.
2. **Two or three name options** within 75 chars, e.g. `unscene.it: Blur Gore, Spiders & Mature Scenes on YouTube` (shape only, not a decision).
3. **Two or three summary options** within 132 chars.
4. **A full rewritten description** that keeps the facts and structure of the current one (alpha notice, how it works, features, who it's for, where it works, good to know), puts the primary keywords in the first two sentences, and uses the audience phrases from C.
5. **Screenshot captions and promo tile text** aligned with the keywords.
6. **Category:** keep Entertainment or switch (e.g. to Tools or Family), with reasoning from B.
7. **Localization:** which languages to add first, if any.
8. **Policy check:** every proposal checked against the E checklist and STORY.md, with any risky line flagged.

## Phase 3: implementation (after Jakub approves the recommendation)

- Update `extension/manifest.json` (`name`, `description`), bump the version and package it with `extension/scripts/package.sh`.
- Update [store/listing.md](store/listing.md) with the new name, summary, description and category.
- Update screenshot captions and promo tiles (`store/promo.html`, then `./render.sh`) if Phase 2 changed them.
- Add `_locales` if localization is approved.
- Submit for review, and note the date the update goes live here.

## Measurement

- **Before the change:** record a baseline from the developer dashboard (impressions, page views, installs, uninstalls, weekly users) for the 4 weeks before submitting, in `seo/baseline.md`.
- **After:** compare the same numbers at +2 and +4 weeks. Also search the store for each primary term and record unscene.it's position.
- Change one large thing at a time if possible (name and summary in one release, description later), so we can tell what worked.

## Open questions for Jakub

- Is renaming the store listing beyond "unscene.it" acceptable? The plan assumes yes, with the brand kept first.
- Which markets matter most: English only for now, or localized listings too?
- Are "NSFW" or "18+" keywords on brand, or should the "modest viewing" audience be described more softly?
