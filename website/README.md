# unscene.it website

The landing page and privacy policy for https://unscene.it. Built with React, Vite, Tailwind CSS and shadcn/ui.

Uses **pnpm** (pinned in `package.json`; Vercel picks it up from `pnpm-lock.yaml`).

```bash
pnpm install
pnpm dev         # http://localhost:5173
pnpm build       # static site in dist/
pnpm preview     # serve dist/ locally
pnpm dlx shadcn@latest add <component>   # add a shadcn/ui component
```

## Pages

| URL | Source |
|---|---|
| `/` | `index.html` → `src/pages/home.tsx` |
| `/privacy/` | `privacy/index.html` → `src/pages/privacy.tsx` |
| `/waitlist/` | `waitlist/index.html` → `src/pages/waitlist.tsx` |
| any unknown URL | `404.html` → `src/pages/not-found.tsx` |

Each page is its own HTML file, so the build is plain static files that work on any host without rewrite rules. URLs without the trailing slash (`/waitlist`) redirect to it, on Vercel (`vercel.json`) and in `pnpm dev` / `pnpm preview` (`vite.config.ts`). Vercel serves `404.html` for anything else. To add a page, add its HTML file and its name to `PAGES` in `vite.config.ts`.

## Settings

`src/site.ts` holds the values that change at launch:

- `CHROME_STORE_URL`: the Chrome Web Store listing. While it's `null`, the install buttons read "Coming soon to Chrome".
- `SUPPORT_EMAIL`: shown in the footer, the FAQ and the privacy policy.
- `PRIVACY_UPDATED`: the date at the top of the privacy policy. Change it whenever the policy changes.

## Keep the privacy policy true

The Chrome Web Store checks the privacy policy against what the extension does. `src/pages/privacy.tsx` describes what `extension/background.js` sends (video ID or page title, library searches) and what live AI will send. Update it in the same change as any code that sends new data.

## Branding

Colors are tokens in `src/index.css`: `brand` (#716BF3, the logo's violet), `brand-soft`, `xenia` (#5B4CF0) and `ink`. Xenia (`src/components/site/xenia.tsx`) uses the same face and motion as the extension's bot in `extension/notice.js`.
