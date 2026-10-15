# unscene.it website

The landing page and privacy policy for https://unscene.it. Built with React, Vite, Tailwind CSS and shadcn/ui.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve dist/ locally
```

## Pages

| URL | Source |
|---|---|
| `/` | `index.html` → `src/pages/home.tsx` |
| `/privacy/` | `privacy/index.html` → `src/pages/privacy.tsx` |

Each page is its own HTML file, so the build is plain static files and `/privacy/` works on any host without rewrite rules.

## Settings

`src/site.ts` holds the values that change at launch:

- `CHROME_STORE_URL`: the Chrome Web Store listing. While it's `null`, the install buttons read "Coming soon to Chrome".
- `SUPPORT_EMAIL`: shown in the footer, the FAQ and the privacy policy.
- `PRIVACY_UPDATED`: the date at the top of the privacy policy. Change it whenever the policy changes.

## Keep the privacy policy true

The Chrome Web Store checks the privacy policy against what the extension does. `src/pages/privacy.tsx` describes what `extension/background.js` sends (video ID or page title, library searches) and what live AI will send. Update it in the same change as any code that sends new data.

## Branding

Colors are tokens in `src/index.css`: `brand` (#716BF3, the logo's violet), `brand-soft`, `xenia` (#5B4CF0) and `ink`. Xenia (`src/components/site/xenia.tsx`) uses the same face and motion as the extension's bot in `extension/notice.js`.
