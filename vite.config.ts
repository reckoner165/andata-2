import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * robots.txt, sitemap.xml and llms.txt live as templates in seo/ and get the site URL
 * (VITE_SITE_URL in .env) filled in, so the public address is set in one place.
 * index.html uses %VITE_SITE_URL% directly (Vite's built-in env replacement).
 */
function seoFiles(siteUrl: string): Plugin {
  const files = ['robots.txt', 'sitemap.xml', 'llms.txt']
  const render = (name: string) =>
    fs
      .readFileSync(path.resolve(import.meta.dirname, 'seo', name), 'utf8')
      .replaceAll('{{SITE_URL}}', siteUrl)
      .replaceAll('{{BUILD_DATE}}', new Date().toISOString().slice(0, 10))
  const types: Record<string, string> = { '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' }
  return {
    name: 'andata-seo-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].replace(/^\//, '') ?? ''
        if (!files.includes(name)) return next()
        res.setHeader('Content-Type', types[path.extname(name)])
        res.end(render(name))
      })
    },
    generateBundle() {
      for (const name of files) this.emitFile({ type: 'asset', fileName: name, source: render(name) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173/'
  return {
    plugins: [react(), seoFiles(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`)],
  }
})
