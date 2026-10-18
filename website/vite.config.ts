import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import type { ServerResponse } from 'node:http'
import path from 'node:path'
import { defineConfig, type Connect, type Plugin } from 'vite'

// Static pages, one HTML file each, so they work on any static host without
// rewrites. Add a page here and in PAGES below.
const PAGES = ['privacy', 'waitlist']

// Local servers behave like Vercel: /waitlist → /waitlist/ (vercel.json
// trailingSlash), and any other page URL gets 404.html with a 404 status.
function staticHosting(): Plugin {
  const pageUrls = new Set(['/', '/index.html', ...PAGES.flatMap((p) => [`/${p}/`, `/${p}/index.html`])])

  // Returns true when it answered the request.
  function route(req: Connect.IncomingMessage, res: ServerResponse, notFound: () => Promise<string | Buffer>) {
    const [pathname, query = ''] = (req.url ?? '').split('?')
    if (PAGES.includes(pathname.replace(/^\//, ''))) {
      res.statusCode = 308
      res.setHeader('Location', `${pathname}/${query && `?${query}`}`)
      res.end()
      return true
    }
    // Only page navigations; assets and Vite's own requests pass through.
    const isPage = req.method === 'GET' && (req.headers.accept ?? '').includes('text/html') && !path.extname(pathname)
    if (isPage && !pageUrls.has(pathname)) {
      notFound().then((html) => {
        res.statusCode = 404
        res.setHeader('Content-Type', 'text/html')
        res.end(html)
      })
      return true
    }
    return false
  }

  return {
    name: 'static-hosting',
    configureServer(server) {
      const notFound = async () =>
        server.transformIndexHtml('/404.html', await fs.readFile(path.resolve(import.meta.dirname, '404.html'), 'utf8'))
      server.middlewares.use((req, res, next) => route(req, res, notFound) || next())
    },
    configurePreviewServer(server) {
      const notFound = () => fs.readFile(path.resolve(server.config.root, server.config.build.outDir, '404.html'))
      server.middlewares.use((req, res, next) => route(req, res, notFound) || next())
    },
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  appType: 'mpa',
  plugins: [react(), tailwindcss(), staticHosting()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // `vite build --ssr src/entry-server.tsx` (prerendering, see
  // scripts/prerender.mjs) builds only that entry, into dist-ssr/.
  build: isSsrBuild ? { outDir: 'dist-ssr' } : {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        notFound: path.resolve(import.meta.dirname, '404.html'),
        ...Object.fromEntries(PAGES.map((p) => [p, path.resolve(import.meta.dirname, `${p}/index.html`)])),
      },
    },
  },
}))
