<p align="center"><img src="https://next-toolbar.angellm.dev/logo.svg" width="96" height="96" alt="NextToolbar logo"></p>

# NextToolbar

A floating debug toolbar for the Next.js App Router. It answers the questions you ask all day while building (did this page return a 200? is it static? why is it slow? did that fetch hit the cache?) without switching to DevTools or the terminal. Dev only: renders nothing in production builds.

It floats as a full-width strip at the bottom of the page. Minimize it (logo or ×) and it shrinks to a circle showing the status of the page: a gradient dot when OK, a red count when there are errors. Click the circle to expand it again. Styles live in a Shadow DOM, so they never clash with your app.

Shows, for the current page:

- HTTP status (document load or client navigation)
- Route pattern (`/blog/[slug]`)
- Render mode: Static / Dynamic / Static? (dynamic segment, depends on `generateStaticParams`)
- Server render time, TTFB / navigation time
- Server `fetch` calls with data-cache stats: HIT / HMR / MISS / SKIP, hit rate and reason (Next 16.3+ with request insights)
- Client and server errors: click a server error to open it in the profiler, expand a client error to see its stack
- Next.js and React versions
- Security: known vulnerabilities of the installed Next.js (GitHub Security Advisories), with the version to upgrade to. Disable with `securityCheck={false}`

Click the request id (e.g. `7b5063`) to open the profiler: recent requests (documents and RSC payloads) with status, summary, root-cause errors, server fetches and a span timeline. Full detail needs Next 16.3+ with `experimental.requestInsights`; on older versions it lists the page visits recorded by the browser (status, route, timing, client errors). **Clear** empties the request list (keeping the current page's request) and the client errors. Esc closes it.

Requires Next.js 15+ and React 19. `basePath` and `assetPrefix` work without extra config.

**Documentation:** [next-toolbar.angellm.dev](https://next-toolbar.angellm.dev) · [Live demo](https://next-toolbar.angellm.dev/en/demo) · [Español](https://next-toolbar.angellm.dev/es)

## Install

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

### Theme

Follows the OS light/dark preference by default. Force one with the `theme` prop; the theme button in the toolbar cycles system → light → dark and remembers the choice per browser.

```tsx
<NextToolbar theme="dark" />
```

Recommended `next.config.ts`:

```ts
const nextConfig = {
  // Next's own indicator sits bottom-left by default and overlaps the toolbar.
  devIndicators: { position: 'top-right' },
  // Next 16.3+ only: server timing, fetches and exact route patterns.
  experimental: { requestInsights: true },
}
```

## Limitations

- **Render mode is Next's dev heuristic**: it only sees request APIs (`headers()`, `cookies()`, `searchParams`...) and `dynamic = 'force-dynamic'`. The toolbar also marks routes Dynamic when a fetch opts out of caching (`no-store`, `revalidate: 0`, `noStore()`), which needs request insights, and shows `Static?` for dynamic segments. `dynamic = 'force-static'` is not detected.
- **SSG vs ISR**: `next dev` renders every request on demand, so both show as Static. Use `next build && next start` to see real caching.
- **Crashing pages**: an uncaught render error makes Next replace the root layout with its error page, toolbar included. Also render `<NextToolbar />` in `app/global-error.tsx` to keep it on screen.
- **Cache Components (Next 16)**: Next doesn't publish static/dynamic info for these apps; render mode shows `?`.
- **Route pattern on Next 15** is rebuilt from `useParams()` and can mislabel a param whose value matches a static segment.
- **Status code** needs `responseStatus` (Chrome, Edge, Firefox). Safari shows `—`.
- Render mode and insights come from Next's internal dev HMR socket and may break in future Next versions; the toolbar degrades to `?` instead of failing.
