# Unseen It – Reddit Distribution & Organic Marketing Plan

This document outlines the hybrid AI execution plan for marketing `unscene.it` (Chrome Web Store extension + landing page).

---

## 1. System Role & Workflow Strategy

* **AI Role:** Research assistant, keyword scanner, copy writer, and post scheduler.
* **Human Role:** Reviewer and manual publisher via browser (zero API post-submission risk).
* **Core Product Objective:** Drive high-intent YouTube users to install the extension and join the `/welcome` waitlist.


```

┌─────────────────────────┐
│ 1. AI Community Scan    │ Target subreddits & evaluate post guidelines
└────────────┬────────────┘
│
▼
┌─────────────────────────┐
│ 2. AI Content Drafting  │ Generate tailored post titles, copy & timing
└────────────┬────────────┘
│
▼
┌─────────────────────────┐
│ 3. Human Browser Submit │ Copy-paste into Reddit UI at peak engagement
└─────────────────────────┘

```

---

## 2. Target Subreddits & Posting Windows

*All times listed in EST (UTC-5) for optimal North American traffic depth.*

| Subreddit | Core Audience Angle | Target Post Window | Self-Promo Rules |
| :--- | :--- | :--- | :--- |
| **`r/SideProject`** | Showcasing project & requesting tech feedback | Tuesday / Thursday: 8:00 AM – 11:00 AM EST | Highly welcoming to creators; link allowed in post/comments. |
| **`r/chrome_extensions`** | Extension power-users & privacy enthusiasts | Wednesday / Friday: 9:00 AM – 12:00 PM EST | Open self-promo allowed; focus on privacy & permissions. |
| **`r/productivity`** | People fighting YouTube distractions/clickbait | Saturday / Sunday: 10:00 AM – 2:00 PM EST | **Strict rule:** Self-promo only in Sunday self-promo threads or as free helpful tools without hard sell. |
| **`r/InternetIsBeautiful`** | Useful web tools and non-monetized utilities | Monday / Wednesday: 1:00 PM – 4:00 PM EST | Must be a direct link to tool/storefront; strictly free core feature. |

---

## 3. High-Intent Keyword Triggers (For AI Scanning)

Instruct Claude / Reddit MCP to monitor and match against these active user pain points:

* `"YouTube clickbait"` / `"blur thumbnails"`
* `"distraction free YouTube"` / `"skip explicit scenes"`
* `"YouTube thumbnail blocker"` / `"clean YouTube feed"`
* `"YouTube focus extension"` / `"block annoying thumbnails"`

---

## 4. Master Prompt Template for Claude CLI

Save the block below into your CLI or system instructions to prompt Claude for your next post batch:

```text
Act as my Reddit marketing specialist for unscene.it (a Chrome extension that automatically blurs YouTube thumbnails and skips flagged scenes). 

Your job is to:
1. Scan the target subreddits (r/SideProject, r/chrome_extensions, r/productivity) using current thread context.
2. Draft 3 tailored, non-promotional Reddit posts framed around building a solution for a shared pain point.
3. Recommend the exact posting day and peak hour window for each post.
4. Format the final output cleanly so I can easily copy and paste into my desktop browser.

```

```

---

<ElicitationsGroup message="How would you like to proceed with your setup?">
  <Elicitation label="Draft 3 immediate Reddit post templates for copy-pasting" query="Generate 3 high-converting post drafts for r/SideProject, r/chrome_extensions, and r/productivity right now based on this markdown plan."/>
  <Elicitation label="Update Marketing Checklist with completed onboarding step" query="Update the Marketing Agent checklist to mark the post-install onboarding tab step as completed."/>
  <Elicitation label="Outline Show HN launch post copy for Hacker News" query="Draft a Show HN submission title, top-level comment, and technical writeup for unscene.it."/>
</ElicitationsGroup>

```