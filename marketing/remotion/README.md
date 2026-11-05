# unscene.it videos

Programmatic videos in [Remotion](https://www.remotion.dev), set up like the Eligio project (`agent-loop-video`).

```console
npm i --loglevel=error
npm run dev                                    # Studio: preview and edit
npx remotion render src/index.ts parents-01 out/parents-01.mp4
npm run lint                                   # ESLint and TypeScript
```

## What's here

- **`src/social-clip/`** is the vertical social video. Each creative in [`../pipeline/content/creatives.json`](../pipeline/content/creatives.json) automatically becomes a composition in Studio, using the crops in `segments.json`. Change copy there, and change motion and layout here.
- **`scripts/link-footage.mjs`** makes the footage available to Remotion. `npm run dev` runs it for you. Before a manual `remotion render`, run `npm run link-footage` once.
- **New videos** go in their own folder under `src/`, registered in `src/Root.tsx`. Anything that isn't a social clip, such as a store promo or a landscape demo, belongs there.

The pipeline renders through this project (see [`../pipeline/README.md`](../pipeline/README.md)).

## Footage rule

Only use footage from the allowlist in `segments.json`, which keeps out third-party clips and the facecam. New segments need checking by eye first.

## Agent skills

`.agents/` and `.claude/` hold Remotion's official agent skills (`remotion-dev/skills`, listed in `skills-lock.json`), copied from the Eligio project. They're gitignored, as they are there, so a fresh clone needs them added again.

## License

Remotion needs a paid company license for some companies. Check the [terms](https://www.remotion.dev/docs/license) for DoubleCross Digital LLC.
