// Fills each built page's <div id="root"></div> with its prerendered markup
// (src/entry-server.tsx, built to dist-ssr/ by `vite build --ssr`).
// Run by `pnpm build` after both Vite builds.
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = path.resolve(import.meta.dirname, "..")
const { files, render } = await import(pathToFileURL(path.join(root, "dist-ssr/entry-server.js")).href)

for (const file of files) {
  const target = path.join(root, "dist", file)
  const html = await fs.readFile(target, "utf8")
  const placeholder = '<div id="root"></div>'
  if (!html.includes(placeholder)) throw new Error(`${file}: no empty #root to fill`)
  await fs.writeFile(target, html.replace(placeholder, `<div id="root">${render(file)}</div>`))
  console.log(`✓ prerendered ${file}`)
}
await fs.rm(path.join(root, "dist-ssr"), { recursive: true, force: true })
