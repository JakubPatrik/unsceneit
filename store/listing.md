# Chrome Web Store listing

Everything to paste into the developer dashboard for the **early alpha** (v0.1). Keep it in line with STORY.md: library titles only, no live AI, nothing promised for "any video".

## Files in this folder

| File | Dashboard field | Spec |
|---|---|---|
| `icon-128.png` | Store icon | 128×128 PNG, 96×96 artwork, 16 px transparent padding |
| `promo-small-440x280.png` | Small promo tile (required) | 440×280 PNG |
| `promo-marquee-1400x560.png` | Marquee promo tile (optional) | 1400×560 PNG |
| your screenshots | Screenshots | 1280×800 (or 640×400), PNG or JPEG, 1 to 5 |

To change the tiles, edit `promo.html` and run `./render.sh`. It also regenerates the icon.

## Product details

**Name:** unscene.it

**Summary** (from `extension/manifest.json`, 132 characters max):
> Hide the scenes you'd rather not see. Pick your filters once and keep watching while the story plays on.

**Category:** Entertainment (Tools also fits)

**Language:** English

**Detailed description** (plain text; paste as is):

```
unscene.it hides the scenes you'd rather not see, so you can keep watching.

Pick what you want to avoid (blood and gore, spiders and insects, sensual or revealing content, or anything above your family's age limit) and unscene.it blurs those scenes while the story keeps playing. Nothing is cut or skipped, so you never lose your place.

EARLY ALPHA
unscene.it is in early alpha. It filters videos in the unscene.it library, a growing collection of videos that have already been screened. Videos that aren't in the library yet play normally, without filters. Live AI, which will screen videos that aren't in the library yet as you watch, is coming next. Join the early access waitlist at https://unscene.it/waitlist/ to get it first, at 50% off Pro for life.

HOW IT WORKS
1. Pick your filters in the extension menu: an age limit (Under 12, Under 15 or Under 18) and any of the triggers.
2. Open a video. It waits under a blur while Xenia, your guardian in the corner of the player, checks it against the library.
3. Choose "Watch with filters". Flagged scenes are blurred and labelled as they play ("Hidden: gore"). When a scene ends, the picture and sound come back on their own.

FEATURES
• Personal filters: turn on any combination. One viewer hides only spiders; another hides gore and anything over 12.
• Heavy blur: flagged scenes are blurred so strongly that nothing shows through.
• Muted while hidden: sound drops out with the picture. On by default, with a switch in the menu.
• Nothing plays until you choose: no autoplay surprises. Every video waits for your decision.
• Thumbnails blurred too: video thumbnails and hover previews are blurred before they can show. You can turn this off.
• Xenia: click her at any time to change your filters mid-video, or to watch without filters.
• On or off per site: one switch in the menu turns unscene.it off for the site you're on, and back on whenever you like.
• Settings that follow you: your filters sync across every Chrome where you're signed in.

WHO IT'S FOR
• Parents who want to watch with their kids without hovering over the remote.
• People avoiding phobia or trauma triggers, such as spiders or blood.
• Viewers who prefer modest content, including the subtler kind common in music videos.
• Couples and families who want to watch together comfortably.

WHERE IT WORKS
YouTube and video players on the open web, for videos in the unscene.it library. Streaming services that protect their video with DRM, such as Netflix and Disney+, aren't supported.

GOOD TO KNOW
• Scenes are judged by AI, frame by frame. It can occasionally miss a scene or hide a harmless one, so unscene.it helps you avoid what you chose but can't guarantee it.
• No account needed. To find a video in the library, the extension sends only its YouTube video ID or its page title. No video files are uploaded, and no person ever watches what you watch. Your data is never sold or used for advertising. Privacy policy: https://unscene.it/privacy/
• Free during the alpha.

Questions, feedback or a video you'd like screened: hello@unscene.it
```

**Website:** https://unscene.it

**Support URL / email:** hello@unscene.it

## Screenshots (you're making these)

1280×800, full bleed: no browser padding, no rounded corners or device frames. Use videos that are in the library, and the store build (no developer panel). Suggested set, in this order:

1. **The decision dialog** over a YouTube video: "Found in the library · N scenes will be hidden", with the "Your filters" picker and "Watch with filters".
2. **A hidden scene** playing: the heavy blur, the "Hidden: Blood & gore" label and Xenia (purple) in the corner, with her "Xenia is protecting this video" bubble if you can catch it.
3. **The extension menu**, open over a page: filters, "Mute sound while hidden" and "Blur video thumbnails".
4. **Thumbnail blur** on the YouTube home page: a grid of blurred thumbnails, with the menu or Xenia in view.
5. Optional: **Watching without filters**, with grey Xenia and her "Click me to turn them on" bubble.

Don't show a live AI pre-screen, the debug panel or anything with "PRO" as the main subject.

## Privacy practices tab

- **Single purpose:** Hides scenes in online videos that match the filters the user chooses.
- **Permission justification:**
  - `storage`: saves the viewer's filters and settings.
  - Host permission (all sites): finds and filters video players on any page the viewer watches, and blurs video thumbnails.
- **Remote code:** No, I am not using remote code.
- **Data usage:** tick **Web history** (video IDs and page titles sent for library lookups) and **Website content**. Then tick all three certifications.
- **Privacy policy URL:** https://unscene.it/privacy/

## Test instructions (for the reviewer)

Fill in the videos you've confirmed are in the library (TODO.md, section 2):

```
unscene.it is in early alpha: it filters videos in its library. Videos not in the library play unfiltered. Live AI is not part of this release; its button only opens our waitlist page.

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
