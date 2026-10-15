# Before the Chrome Web Store release

What's left before unscene.it goes public as an **early alpha**. The website (https://unscene.it), the privacy policy (https://unscene.it/privacy/) and hello@unscene.it are already live.

## 1. Say what the alpha does

The store build filters titles from the shared library and blurs thumbnails. **Live AI doesn't run for store users** (it needs sign-in and credits), so nothing should promise it.

- [x] **STORY.md**: mark the product as an early alpha. Say that live AI doesn't run yet and that only library titles are filtered. Move live AI, Pro and custom filters under "Not built yet".
- [x] **Manifest description** (`extension/manifest.json`, 132 characters at most). It still says "AI looks ahead… on any video". Suggested: *"Hides the scenes you choose, like gore, spiders or sexual content, in videos from the unscene.it library. Blurs thumbnails too."*
- [x] **Hide the "Turn on live AI filter · coming soon" button** in store builds. Reviewers can flag a visible feature that doesn't work. The "not in the library" dialog should offer "Watch without filters" and the library search only.
- [x] **Website**: add an "Early alpha" label and check every claim against the store build (`website/src/pages/home.tsx`).
- [x] **Hiding style**: the popup has a "Mute sound while hidden" switch. Scenes are always heavily blurred, and the website and STORY.md say so.

## 2. Fill the library so reviewers see it working

A reviewer will likely open a random YouTube video. If it isn't in the library, all they'll see is "Watch without filters".

- [ ] Pick 10–20 popular YouTube videos with clear flagged scenes: trailers, music videos, nature clips with spiders, and so on. Cover every filter (age, gore, spiders, sensual).
- [ ] Classify each one into the library with `backend/scripts/classify-video.mjs`. You need the video file locally, plus ffmpeg and a linked Supabase project. Each frame is a paid AI call, so use `--every 1` and `--duration` to keep costs down.

  ```bash
  node backend/scripts/classify-video.mjs video.mp4 --title "Title" --youtube <id>
  ```

- [ ] Check each one in a store-like install: open it, see "Found in the library · N scenes will be hidden", and confirm the scenes blur at the right times.
- [ ] Pick 2–3 of them as the reviewer test videos (see section 5).

## 3. Sign-in: decide the plan

Live AI and custom filters (Pro) need accounts and credits. For the alpha, choose one of these:

**A. No auth yet: collect emails (recommended for the alpha)**
- A "Get notified when Pro launches" email form on the website. It saves to a Supabase `waitlist` table, insert-only through RLS.
- A small "Want live AI? Join the waitlist" link in the popup that opens the website.
- Smallest change. It adds no extension permissions and no account data in the extension.
- Before launching it: add "email address, if you join the waitlist" to the privacy policy.

**B. Basic Supabase auth, signed in on the extension and the website**
- Sign in on the website with a Supabase magic link (email only, no passwords).
- **Getting the session into the extension:** don't read the website's cookies, because that needs the `cookies` permission and a bigger privacy disclosure. Instead:
  - add `externally_connectable` for `https://unscene.it/*` to the manifest;
  - after sign-in, the website sends the session to the extension with `chrome.runtime.sendMessage(EXTENSION_ID, …)`;
  - the extension stores it in `chrome.storage.local` and refreshes it with supabase-js.
- **Signing out** clears it in both places.
- Before launching it:
  - update the privacy policy (email address, account data);
  - in the developer dashboard, add "Personally identifiable information" and "Authentication information" to the data disclosures;
  - add a way to delete your account.

Either way, credits and payments come later. They'll need a payment provider, terms of service and another privacy policy update.

## 4. Store listing: text and images

- [ ] **Icon, 128×128 PNG.** 96×96 of artwork centred, with 16 px of transparent padding on every side, per Google's guidelines. The current `extension/icons/icon-128.png` fills the whole square. Remake it from `assets/icon.png`, and use the same file for the listing.
- [ ] **Screenshots, 1280×800**, 1 to 5 of them. Suggested shots:
  1. the dialog over a video ("Found in the library");
  2. a scene hidden, with the "Hidden: …" label and Xenia in the corner;
  3. the popup with filters;
  4. the thumbnail blur on YouTube.
- [ ] **Small promo tile, 440×280** (required). Optional: a 1400×560 marquee.
- [ ] **Summary**: the same text as the manifest description.
- [ ] **Detailed description**, adapted from STORY.md:
  - what it hides and how, and the early-alpha scope;
  - which sites it works on, and that DRM services like Netflix are not supported;
  - no promises of perfection.
- [ ] **Category**: Entertainment, or Tools. **Language**: English.
- [ ] **Support**: hello@unscene.it. **Website**: https://unscene.it.

## 5. Developer dashboard

- [ ] **Developer account**: 2-step verification on, $5 registration fee paid.
- [ ] **Trader declaration (EU)**: DoubleCross Digital LLC, 30 N Gould St, Ste R, Sheridan, WY 82801, USA. Have a business phone number ready, since traders' details are shown publicly.
- [ ] **Privacy section:**
  - **Single purpose**: "Hides scenes in online videos that match the filters the user chooses."
  - **`storage`**: saves the viewer's filters and settings.
  - **Access to all sites**: finds and filters video players on any page the viewer watches.
  - **Remote code**: No.
  - **Data collected**: Web history (video IDs and page titles) and Website content.
  - Confirm all three data-use statements.
  - **Privacy policy URL**: https://unscene.it/privacy/
- [ ] **Test instructions (for reviewers):**
  - links to the reviewer test videos from section 2;
  - the steps: pick "Blood & gore" in the popup, open the video, choose "Watch with filters", jump to m:ss;
  - a note that live AI is not part of this release.
- [ ] Optional: verify unscene.it in Google Search Console, so the listing shows it as a verified website.

## 6. Build, test, submit

- [ ] Bump `version` in `extension/manifest.json` if needed. Build the zip with `extension/scripts/package.sh`; it leaves out the developer files and refuses to build if a secret key would end up inside.
- [ ] Install the zip in a **fresh Chrome profile** (not "Load unpacked") and check the full flow:
  - a video waits under the blur, the dialog appears, the right scenes are hidden;
  - Xenia works, the thumbnail blur works;
  - no developer switches or panels appear.
- [ ] Re-read the privacy policy against what this build sends. It must match exactly.
- [ ] Submit. Review for an extension that runs on every site usually takes a few days.
