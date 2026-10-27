# Chrome Web Store listing

Everything to paste into the developer dashboard for the **early alpha** (v0.1). Keep it in line with STORY.md: library titles, plus free live AI (20 minutes a month per browser) for the rest. Nothing promised for "any video".

## Files in this folder

| File | Dashboard field | Spec |
|---|---|---|
| `icon-128.png` | Store icon | 128×128 PNG, 96×96 artwork, 16 px transparent padding |
| `promo-small-440x280.png` | Small promo tile (required) | 440×280 PNG |
| `promo-marquee-1400x560.png` | Marquee promo tile (optional) | 1400×560 PNG |
| your screenshots | Screenshots | 1280×800 (or 640×400), PNG or JPEG, 1 to 5 |

To change the tiles, edit `promo.html` and run `./render.sh`. It also regenerates the icon.

## Product details

**Name** (from `extension/manifest.json`, 75 characters max; keywords chosen in [SEO.md](../SEO.md)):
> unscene.it: Safe YouTube Content Filter & Blur

**Summary** (from `extension/manifest.json`, 132 characters max):
> YouTube content filter: blur scenes with gore, spiders or anything above your age limit, plus thumbnails. The story keeps playing.

**Category:** Entertainment (Tools also fits)

**Language:** English

**Detailed description** (plain text; paste as is):

```
unscene.it is a YouTube content filter that hides the scenes you'd rather not see: blood and gore, spiders and insects, sensual or revealing content, or anything above your family's age limit.

Flagged scenes are blurred and muted while the story keeps playing, and video thumbnails are blurred too. Nothing is cut or skipped, so you never lose your place, and you never have to block a whole video or channel.

EARLY ALPHA
unscene.it is in early alpha. It filters videos in the unscene.it library, a growing collection of videos that have already been screened. For a video that isn't in the library yet, turn on live AI: Xenia screens it about 10 seconds ahead of you as you watch. Every browser gets 20 free minutes of live AI a month, enough for a typical YouTube video. Want more? Join the early access waitlist at https://unscene.it/waitlist/ for 50% off Pro for life.

HOW IT WORKS
1. Pick your filters in the extension menu: an age limit (Under 12, Under 15 or Under 18) and any of the triggers.
2. Open a video. It waits under a blur while Xenia, your guardian in the corner of the player, checks it against the library.
3. Choose "Watch with filters" (or "Use live AI" for a video that isn't in the library yet). Flagged scenes are blurred and labelled as they play ("Hidden: gore"), like a trigger warning that also hides the scene. When a scene ends, the picture and sound come back on their own.

FEATURES
• Personal filters: turn on any combination. One viewer hides only spiders; another hides gore and anything over 12.
• Heavy blur: flagged scenes are blurred so strongly that nothing shows through.
• Muted while hidden: sound drops out with the picture. On by default, with a switch in the menu.
• Nothing plays until you choose: no autoplay surprises. Every video waits for your decision.
• Blurred YouTube thumbnails: thumbnails and hover previews are blurred before they can show, so a graphic thumbnail can't catch you off guard. You can turn this off.
• Xenia: click her at any time to change your filters mid-video, or to watch without filters.
• On or off with one switch: turn unscene.it off on YouTube from the menu, and back on whenever you like.
• Settings that follow you: your filters sync across every Chrome where you're signed in.

WHO IT'S FOR
• Parents who want a safer YouTube to watch with their kids, without hovering over the remote.
• People with arachnophobia, and anyone avoiding phobia or trauma triggers such as spiders or blood.
• Viewers sensitive to graphic or disturbing scenes.
• Viewers who prefer clean, modest content, including the subtler kind common in music videos.
• Couples and families who want to watch together comfortably.

WHERE IT WORKS
YouTube, including YouTube videos embedded on other websites: videos in the unscene.it library right away, and others with live AI while your free minutes last. Other video sites, and streaming services such as Netflix and Disney+, aren't supported yet.

GOOD TO KNOW
• Scenes are judged by AI, frame by frame. It can occasionally miss a scene or hide a harmless one, so unscene.it helps you avoid what you chose but can't guarantee it.
• It isn't a parental lock: anyone using this Chrome can change the filters or turn them off.
• No account needed. To find a video in the library, the extension sends only its YouTube video ID. With live AI on, it also sends still frames from that video to be checked; they aren't kept. No video files are uploaded, and no person ever watches what you watch. Your data is never sold or used for advertising. Privacy policy: https://unscene.it/privacy/
• Free during the alpha.

Questions, feedback or a video you'd like screened: hello@unscene.it
```

**Website:** https://unscene.it

**Support URL:** https://unscene.it/#faq (the FAQ links to hello@unscene.it)

**Contact email** (Account tab, shown on the listing): hello@unscene.it

## Screenshots (you're making these)

1280×800, full bleed: no browser padding, no rounded corners or device frames. Use videos that are in the library, and the store build (no developer panel). Suggested set, in this order:

1. **The decision dialog** over a YouTube video: "Found in the library · N scenes will be hidden", with the "Your filters" picker and "Watch with filters".
2. **A hidden scene** playing: the heavy blur, the "Hidden: Blood & gore" label and Xenia (purple) in the corner, with her "Xenia is protecting this video" bubble if you can catch it.
3. **The extension menu**, open over a page: filters, "Mute sound while hidden" and "Blur video thumbnails".
4. **Thumbnail blur** on the YouTube home page: a grid of blurred thumbnails, with the menu or Xenia in view.
5. Optional: **Watching without filters**, with grey Xenia and her "Click me to turn them on" bubble.

Live AI can be shown now (it's free for 20 minutes a month). Don't show the debug panel or anything with "PRO" as the main subject.

## Privacy practices tab

- **Single purpose:** Hides scenes in online videos that match the filters the user chooses.
- **Permission justification:**
  - `storage`: saves the viewer's filters and settings.
  - Host permission (www.youtube.com): finds the video player on YouTube pages (and in YouTube players embedded on other sites), hides flagged scenes and blurs video thumbnails.
- **Remote code:** No, I am not using remote code.
- **Data usage:** tick **Web history** (the YouTube video IDs sent for library lookups) and **Website content** (live AI's still frames). Then tick all three certifications.
- **Privacy policy URL:** https://unscene.it/privacy/

## Test instructions (for the reviewer)

Fill in the videos you've confirmed are in the library (TODO.md, section 2):

```
unscene.it is in early alpha: it filters videos in its library. For other videos, "Use live AI" screens the video as it plays, free for 20 minutes a month per browser (the remaining minutes show in the toolbar menu and when hovering Xenia, the round avatar in the player's corner).

To test:
1. Click the unscene.it toolbar icon. Under "Your filters", turn on "Blood & gore" (or the filter noted below).
2. Open one of these videos:
   • <YouTube link 1>: filter <…>, flagged scene at <m:ss>
   • <YouTube link 2>: filter <…>, flagged scene at <m:ss>
   • <YouTube link 3>: filter <…>, flagged scene at <m:ss>
3. The video waits under a blur and a dialog says "Found in the library". Click "Watch with filters".
4. Jump to just before the time above. The scene is blurred, labelled "Hidden: …" and muted, then shown again when it ends.
5. Optional: on the YouTube home page, video thumbnails are blurred (switch in the menu).

No account or login is needed.
```

## YouTube channel

**Banner:** `youtube-banner-2560x1440.png` (2560×1440 PNG, rendered by `./render.sh`). Everything that matters sits in the centre 1546×423, the part every device shows.

**Video watermark:** `youtube-watermark-300x300.png` (300×300 transparent PNG, rendered by `./render.sh`). Studio → Customization → Branding.

**Description** (1,000 characters max; paste as is):

```
unscene.it is a free Chrome extension that hides the YouTube scenes you'd rather not see: blood and gore, sensual or revealing content, or anything above your family's age limit.

Flagged scenes are blurred and muted while the story keeps playing. Nothing is cut or skipped, and you never have to block a whole video or channel. Thumbnails can be blurred too.

On this channel: demos, how-tos and updates as unscene.it grows.

unscene.it is in early alpha. It filters videos in the unscene.it library, and live AI screens anything else about 10 seconds ahead of you. Every browser gets 20 free minutes of live AI a month.

Add it to Chrome: https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid
Website: https://unscene.it
Questions: hello@unscene.it
```

### Promo video (`data/promo-video-2.mp4`)

**Thumbnail:** `youtube-thumbnail-1280x720.png` (1280×720 PNG, 2 MB max, rendered by `./render.sh`).

**Title** (100 characters max; keep the keywords in the first 70):
> Blur Gore & Revealing Scenes on YouTube While It Keeps Playing | unscene.it

**Description** (paste as is; chapter times are approximate, check them against the video):

```
unscene.it is a free Chrome extension that hides the YouTube scenes you'd rather not see: blood and gore, sensual or revealing content, or anything above your family's age limit. Flagged scenes are blurred and muted while the story keeps playing, so you never lose your place.

➜ Add to Chrome (free): https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid
➜ Website: https://unscene.it

In this video:
0:00 What unscene.it does
0:08 Blurred thumbnails and your filters
0:16 A library video: gore hidden in a movie trailer
0:36 Any other video: live AI screens it as you watch
0:48 20 free minutes of live AI every month

How it works:
1. Pick your filters in the extension menu: an age limit (Under 12, Under 15 or Under 18) and any triggers.
2. Open a video. If it's in the unscene.it library, flagged scenes are hidden automatically.
3. Not in the library yet? Turn on live AI and Xenia screens it about 10 seconds ahead of you.

Every browser gets 20 free minutes of live AI a month, no account or card needed. unscene.it is in early alpha, and the library grows every week.

Questions or a video you want screened? hello@unscene.it

#YouTube #ParentalControls #ChromeExtension
```

**Tags:** youtube content filter, youtube parental controls, blur youtube, hide gore, gore blocker, hide revealing content, trigger warning, family safe youtube, chrome extension, unscene.it
