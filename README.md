<p align="center"><img src="./packages/next-toolbar/logo.svg" width="96" height="96" alt="NextToolbar logo"></p>

<h1 align="center">NextToolbar</h1>

<p align="center">A floating debug toolbar for the Next.js App Router: the answers you dig for in DevTools and the terminal, at a glance.</p>

<p align="center">
  <a href="https://github.com/angelitolm/next-toolbar/actions/workflows/ci.yml"><img src="https://github.com/angelitolm/next-toolbar/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@angelitolm/next-toolbar#provenance"><img src="https://img.shields.io/badge/npm-provenance-2ea44f?logo=npm" alt="npm provenance"></a>
</p>

<p align="center"><a href="https://next-toolbar.angellm.dev/en/demo"><img src="./docs/public/demo.gif" width="880" alt="NextToolbar demo: render mode and fetch cache panels, revalidating a fetch by its cache tag, SEO findings, a broken link check, Server Actions with revalidation, a 500 in the request profiler, security advisories and minimizing the bar"></a></p>

---

Building a Next.js app means asking the same questions all day: did this page return a 200? Is this route static or dynamic? Why did it take 800 ms? Did that fetch hit the cache? Answering them usually means juggling the Network tab, the terminal and Next's own indicator.

NextToolbar puts the answers in one place. While you run `next dev`, it sits at the bottom of your app and tells you what just happened on the page you're looking at:

- **HTTP status** of full loads and client navigations
- **Route pattern** that matched (`/blog/[slug]`)
- **Render mode**: Static, Dynamic or `Static?`, correcting the cases where Next's dev indicator is wrong
- **Timing**: server render time, TTFB, navigation time
- **Server fetches** with their data-cache outcome (HIT / HMR / MISS / SKIP), hit rate, freshness and cache tags; revalidate a fetch by its tags, react-query devtools style
- **Errors** on the client (with stack) and on the server (with the span where it started)
- **Request profiler**: every request with summary, errors, fetches and a render timeline
- **Server Actions**: every call with status, time, what it revalidated and where it redirected; revalidate paths and tags from the toolbar
- **SEO**: the title, description, canonical, Open Graph image and JSON-LD that reached the page, with what's missing or broken
- **Broken links**: checks the page's internal links on demand and outlines the broken ones
- **Security**: known vulnerabilities of your Next.js version (GitHub advisories) and what to upgrade to
- Light and dark themes, minimizes to a circle, zero runtime dependencies

Dev only: in production the component renders nothing.

## Quick start

```bash
pnpm add -D @angelitolm/next-toolbar
```

```tsx
// app/layout.tsx
import { NextToolbar } from '@angelitolm/next-toolbar'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <NextToolbar />
      </body>
    </html>
  )
}
```

For the full feature set, use Next.js 16.3+ and enable request insights:

```ts
// next.config.ts
const nextConfig = {
  devIndicators: { position: 'top-right' },
  experimental: { requestInsights: true },
}
```

Optional: to revalidate paths and tags from the toolbar and see Server Action names, add a route handler. It only answers in `next dev`.

```ts
// app/api/next-toolbar/route.ts
export { GET, POST } from '@angelitolm/next-toolbar/server'
```

Requires Next.js 15+ (App Router) and React 19.

## Documentation

The docs are a Next.js site in [`docs/`](./docs), in English and Spanish. Read the pages directly in [`docs/content/en`](./docs/content/en) ([español](./docs/content/es)), or run the site locally:

```bash
pnpm install
pnpm --filter docs dev   # http://localhost:3200
```

## Repository

| Path | What |
|---|---|
| [`packages/next-toolbar`](./packages/next-toolbar) | The npm package `@angelitolm/next-toolbar` |
| [`playground`](./playground) | A Next app with one route per scenario, for development |
| [`docs`](./docs) | The documentation site |

See [Contributing](./docs/content/en/contributing.mdx) to work on it.

## License

[MIT](./LICENSE) © 2023–2026 Angel Labrada Massó
