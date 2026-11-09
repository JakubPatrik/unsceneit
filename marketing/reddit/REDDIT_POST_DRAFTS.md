# Reddit post drafts

Based on the files in `data/docs/reddit-raw/` (saved Nov 5, 2026). Product claims follow `STORY.md`.

## Before you post

- [ ] **Build some account history first.** `Due_Secretary_6051` has 1 post karma and 0 comment karma. Spend about a week leaving useful comments in both subs, with no links and no mention of unscene.it. Around 20 real comments is my rule of thumb. Reddit and mods don't publish a number.
- [ ] **Rewrite the posts in your own voice.** Keep the facts and the "not judging" line, and change the rest of the phrasing to sound like you.
- [ ] **Watch the video all the way through.** It should show only blurred versions of flagged scenes, because `r/chrome_extensions` bans NSFW links and a graphic frame could get the post removed.
- [ ] **Read the `r/SideProject` sidebar and pinned posts.** Its rules file came back empty, so its rules are unconfirmed.

## Posting order

| When (EST) | Where | Why |
|---|---|---|
| Nov 6 to 12 | Comments only | Builds the account history |
| Fri Nov 13, 9 AM to 12 PM | `r/chrome_extensions` | Has a Self Promotion flair, so it's the lower-risk first test |
| Tue Nov 17, 8 to 11 AM | `r/SideProject` | Bigger audience, and you can use what you learned from the first post |

These windows come from the marketing plan. The saved top posts landed on every day of the week, so they don't confirm or contradict them.

Don't post the same text in both subs. `r/chrome_extensions` says it reports people who spam across subreddits. If a post gets auto-removed, message the mods politely rather than reposting.

**Nov 17 depends on Nov 13.** If the first post is removed or filtered, hold the second until you know why. Keep leaving comments with no links before, between and after both posts, so your history isn't only promotion.

---

## Post 1: r/chrome_extensions

**Flair:** Self Promotion
**Attach:** `data/promo-video-2.mp4`

**Title (recommended):**

```text
Some scenes you can't unsee, so I built a free extension that blurs and mutes them on YouTube
```

**Title (alternative):**

```text
I built a free extension that hides the YouTube scenes you pick, while the video keeps playing
```

**Body:**

```text
Some scenes you can't unsee. I was watching a movie on YouTube with my girlfriend and out of nowhere there was a scene that was mostly just sexualizing women in bikinis. It ruined the night and we ended up arguing. That's why I built unscene.it (say it out loud: "unseen it").

What it does:

- You pick what to hide: sensual and revealing content, blood and gore, spiders, or an age limit. Any combination works.
- Every video waits under a blur until you choose how to watch it.
- Flagged scenes get heavily blurred and muted while the video keeps playing, then come back on their own. No jump cuts, so you don't lose your place.
- Thumbnails and hover previews are blurred too. You can turn that off.

What it can't do yet:

- It's an early alpha, Chrome and YouTube only (including YouTube embeds on other sites). No Netflix or other DRM services.
- It works right away on videos already in its library. For anything else, live AI screens about 10 seconds ahead as you watch, with 20 free minutes a month per browser.
- Scenes are judged by AI, so it can miss one or hide something harmless.

Permissions and data: it only asks for storage and www.youtube.com, and there's no account. It sends the YouTube video ID to check the library. With live AI on, it also sends low-res still frames, which aren't kept. No video files are uploaded.

Free to try: https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid

If you'd want more live AI than the free minutes, there's a waitlist with 50% off Pro for life (pricing isn't set yet): https://unscene.it/waitlist/

Two things I'd really like feedback on: would you rather have blur and mute, or an actual skip? And is choosing how to watch before every video annoying?
```

---

## Post 2: r/SideProject

**Attach:** `data/promo-video-2.mp4` (21 of this month's top 25 posts were uploaded video)

**Title (recommended):**

```text
A movie scene ruined our night and you can't unsee that stuff, so I built an extension that unscenes it
```

**Title (alternative):**

```text
You can't unsee a scene, so I built something that unscenes it first
```

**Body:**

```text
My girlfriend and I were watching a movie on YouTube when, out of nowhere, a revealing scene came on. Bikinis, the camera mostly just sexualizing women, that kind of thing. It ruined the whole night, we ended up arguing, and it was just really unpleasant.

You can't unsee a scene like that. But you can unscene it, which is where the name came from: unscene.it.

It's a Chrome extension for YouTube. You choose what you don't want to see (sensual and revealing content, gore, spiders, or an age limit), and those scenes get blurred and muted while the video keeps playing. When the scene ends, the picture and sound come back on their own. I'm not judging anyone who likes those scenes. I just wanted the choice to be mine before it's on screen.

Where it's at, honestly:

- Early alpha, and only Chrome and YouTube. Netflix and other DRM services can't be analysed.
- Videos already in the library work right away. Anything else uses live AI, which screens about 10 seconds ahead of you, with 20 free minutes a month.
- The AI can miss a scene or hide a harmless one.

The alpha is free. I'm using a waitlist to see who wants more live AI, and everyone on it gets 50% off Pro for life once Pro exists (no pricing yet): https://unscene.it/waitlist/

What would make you actually use something like this? And would you rather have a blur or a real skip?
```

**Your first comment, right after posting:**

```text
Install link if you want to try it (free, no account): https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid

Happy to answer anything about how it works.
```

---

## Reply bank

Answer early comments quickly, and keep it short.

**"Would this have caught your movie?"**

```text
It was on YouTube, so yes if the movie was in the library. If not, live AI should catch it, but the 20 free minutes won't cover a whole movie. And the AI can miss things either way.
```

**"Does it work on Netflix or Disney+?"**

```text
No. Their video is DRM-protected, so it can't be analysed. YouTube only for now, including YouTube embeds on other sites.
```

**"This is censorship" or "what a prude"**

```text
It only hides what you pick, in your own browser. Nothing changes for anyone else, and there's one switch to turn it off.
```

**Comments about your girlfriend or relationship**

```text
Not looking for relationship advice, but happy to talk about the extension.
```

Then leave that thread alone. Don't defend her or argue.

**"Just check the parents guide" or "just use the remote"**

```text
That works if you remember to look it up first. By the time you reach for the remote, you've already seen the scene.
```

**"Why a waitlist if it's free?"**

```text
The alpha is free, including 20 minutes of live AI a month. The waitlist is only for people who want more than that when it opens up.
```

**"How accurate is it?"**

```text
It's not perfect. The AI judges frame by frame, so it can miss a scene or hide a harmless one. If you hit a bad one, tell me which video and I'll look into it.
```

**"What data does it send?"**

```text
The YouTube video ID, to check the library. With live AI on, also low-res still frames, which aren't kept. No video files are uploaded, no account, and no person watches anything. Privacy policy: https://unscene.it/privacy/
```

**"Firefox or Edge?"**

```text
Chrome only for now. Others are planned.
```

---

## Subs I left out

- **`r/productivity`:** its rules say "Self-promotion is not allowed here in any form, even if asked for recommendations", and they also ban AI-generated posts. This contradicts the marketing plan, which allows promo threads. A post with no link would still be promotion, so I'd skip it.
- **`r/InternetIsBeautiful`:** no rules file was saved. The plan describes it as direct links to free tools, which doesn't suit a waitlist goal.

## What the Popcorn write-up adds

[Popcorn](https://popcornclub.in/blog/getting-my-first-100-users/) is a Chrome extension that got to 100 weekly users mainly through Reddit. It's one maker's experience, so treat it as a warning rather than proof.

- **Repeat promotion got filtered.** Its posts started getting filtered or removed in some communities, and the maker had to stop promoting and start taking part. That's why Nov 17 now depends on Nov 13.
- **Its best reach came from a sub full of potential users.** The 4.1K post was in `r/netflixindia`, a streaming audience. `r/chrome_extensions` and `r/SideProject` look mostly like other makers, based on their saved top posts, so expect feedback more than installs from people who need this.
- **Decision for you: add a sub where your users are.** Candidates are `r/arachnophobia` for the spider filter and `r/Parenting` for the age limit. I haven't checked either sub's rules, and the movie story wouldn't fit, so each would need its own angle. Save their rules to `data/docs/reddit-raw/` and I'll check whether a post is allowed.
- **Tag your install links.** Popcorn used UTM links to see which channels drove traffic. These would separate your two posts if you swap them in:

```text
https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid?utm_source=reddit&utm_medium=social&utm_campaign=chrome_extensions
https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid?utm_source=reddit&utm_medium=social&utm_campaign=sideproject
```

## What the top posts have in common

Sample: this month's top 25 posts from each sub. This only shows posts that survived, not ones that were removed.

- **Video is the norm in `r/SideProject`.** 21 of the top 25 were uploaded video, and the other 4 were text.
- **Images lead in `r/chrome_extensions`.** 16 of the top 25 were images, mostly milestone posts. Its best product posts use video plus a plain explanation.
- **Personal reasons work.** Examples are "My parents' TV showed an ad before Netflix" (503 points) and the pomodoro timer built from the maker's own break habit (523 points).
- **Being upfront about limits is common.** The better posts say what the product doesn't do and ask for specific feedback.
- **Anger gets attention but splits people.** "LinkedIn ghosted me" got 285 comments but only a 76% upvote ratio, against 97 to 98% for the TV and pomodoro posts. Expect some of that split on this story.
