import type { ActionCall, ActionName, Advisory, LinkResult, ClientError, Insight, InsightFetch, InsightSpan, NextToolbarDemoProps } from '@angelitolm/next-toolbar'

// Fixed clock so server and client render the same data.
const T0 = Date.UTC(2026, 8, 27, 10, 0, 0)

type FetchSpec = InsightFetch & { at: number }

type RequestSpec = {
  id: string
  url: string
  route: string
  ms: number
  /** Minutes before T0: orders the profiler list. */
  ago: number
  status?: number
  rsc?: boolean
  fetches?: FetchSpec[]
  error?: string
}

// Builds a request with the span tree Next 16 records for an App Router render.
function request({ id, url, route, ms, ago, status = 200, rsc = false, fetches = [], error }: RequestSpec): Insight {
  const start = T0 - ago * 60_000
  const spans: InsightSpan[] = []
  const add = (name: string, spanId: string, parentSpanId: string | undefined, at: number, dur: number, extra: Partial<InsightSpan> = {}) =>
    spans.push({ name, spanId, parentSpanId, startTime: start + at, durationMs: dur, status: 'ok', ...extra })

  const failed = error ? { status: 'error' as const } : {}
  add('GET', 'a', undefined, 0, ms, { ...failed, attributes: { 'http.method': 'GET', 'http.status_code': status, 'next.rsc': rsc } })
  add('BaseServer.render', 'b', 'a', 1, ms - 2, failed)
  add('rendering page', 'c', 'b', 1.5, ms - 3, failed)
  add('resolve page components', 'd', 'c', 1.8, ms * 0.08)
  add('build component tree', 'e', 'c', 2 + ms * 0.08, ms * 0.04)
  const renderAt = 2 + ms * 0.12
  add(`render route (app) ${route}`, 'f', 'c', renderAt, ms * 0.8, error ? { status: 'error', error: { type: 'Error', message: error } } : {})
  fetches.forEach((f, i) =>
    add(`fetch ${f.method ?? 'GET'} ${f.url}`, `g${i}`, 'f', renderAt + f.at, f.durationMs ?? 0, {
      attributes: { 'next.fetch.cache_status': f.cacheStatus, 'next.fetch.cache_reason': f.cacheReason, 'http.status_code': f.statusCode },
    }),
  )
  add('start response', 'h', 'c', ms - 1.2, 0.4)

  return {
    requestId: id,
    kind: 'request',
    route,
    url: rsc ? `${url}?_rsc=${id.slice(0, 5)}` : url,
    startTime: start,
    durationMs: ms,
    status: error ? 'error' : 'ok',
    spans,
    fetches: fetches.map(({ at, ...f }) => ({ ...f, startTime: start + renderAt + at })),
  }
}

const api = 'https://api.example.com'

const REQUESTS = {
  home: request({ id: 'k3v9x2h8q1', url: '/', route: '/', ms: 18, ago: 9 }),
  blog: request({
    id: 'p7w2m4c9t6',
    url: '/blog/hello-world',
    route: '/blog/[slug]',
    ms: 41,
    ago: 7,
    rsc: true,
    fetches: [
      { at: 2, url: `${api}/posts/hello-world`, method: 'GET', statusCode: 200, durationMs: 4, cacheStatus: 'hit', cacheReason: 'revalidate: 3600' },
      { at: 3, url: `${api}/authors/7`, method: 'GET', statusCode: 200, durationMs: 3, cacheStatus: 'hit', cacheReason: 'revalidate: 4294967294' },
    ],
  }),
  dashboard: request({
    id: 'd4n8r1s5v2',
    url: '/dashboard',
    route: '/dashboard',
    ms: 243,
    ago: 5,
    rsc: true,
    fetches: [
      { at: 3, url: `${api}/me`, method: 'GET', statusCode: 200, durationMs: 88, cacheStatus: 'miss', cacheReason: 'revalidate: 60' },
      { at: 4, url: `${api}/stats?range=7d`, method: 'GET', statusCode: 200, durationMs: 212, cacheStatus: 'skip', cacheReason: 'cache: no-store' },
    ],
  }),
  account: request({ id: 'a2c6e9g3j7', url: '/account', route: '/account', ms: 36, ago: 4, rsc: true }),
  checkout: request({
    id: 'c9x3z7b1n5',
    url: '/checkout',
    route: '/checkout',
    ms: 3021,
    ago: 3,
    status: 500,
    error: 'Payment provider timed out after 3000 ms',
    fetches: [
      { at: 5, url: 'https://payments.example.com/v1/intents', method: 'POST', statusCode: 504, durationMs: 3002, cacheStatus: 'skip', cacheReason: 'auto no cache' },
    ],
  }),
  notFound: request({ id: 'n5f1q8u4w0', url: '/pricing/enterprise', route: '/_not-found', ms: 22, ago: 2, status: 404 }),
  settings: request({ id: 's8t2y6b0d4', url: '/settings', route: '/settings', ms: 27, ago: 1, rsc: true }),
}

// Route handler calls the pages made, so the profiler looks like a real session.
const API_CALLS: Insight[] = [
  request({ id: 'r1h5l9p3t7', url: '/api/search?q=toolbar', route: '/api/search', ms: 12, ago: 6 }),
  request({ id: 'r6j0n4r8v2', url: '/api/cart', route: '/api/cart', ms: 9, ago: 3.5 }),
]

const ALL: Insight[] = [...Object.values(REQUESTS), ...API_CALLS]

const clientError: ClientError = {
  message: "Uncaught TypeError: Cannot read properties of undefined (reading 'map')",
  stack: `TypeError: Cannot read properties of undefined (reading 'map')
    at NotificationList (app/settings/notifications.tsx:14:23)
    at renderWithHooks (react-dom-client.development.js:5654:22)
    at updateFunctionComponent (react-dom-client.development.js:8431:19)`,
}

// Real advisories affecting Next.js 16.2.6 (September 2026), trimmed to the fields the toolbar shows.
const gh = (id: string) => `https://github.com/vercel/next.js/security/advisories/${id}`
const ADVISORIES_16_2_6: Advisory[] = [
  { id: 'GHSA-vcvr-r3jv-pc5j', cve: 'CVE-2026-94545', severity: 'critical', summary: 'Remote Code Execution in next/og ImageResponse', url: gh('GHSA-vcvr-r3jv-pc5j'), published: '2026-09-22', patched: '16.3.6', reviewed: false },
  { id: 'GHSA-2xp9-vwfh-vxw4', severity: 'critical', summary: 'Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used', url: gh('GHSA-2xp9-vwfh-vxw4'), published: '2026-09-08', patched: '16.3.3', reviewed: true },
  { id: 'GHSA-p293-qw3h-jr36', cve: 'CVE-2026-75604', severity: 'critical', summary: 'Unauthenticated Remote Code Execution on windows-hosted servers', url: gh('GHSA-p293-qw3h-jr36'), published: '2026-09-08', patched: '16.3.3', reviewed: true },
  { id: 'GHSA-6gpp-xcg3-4w24', cve: 'CVE-2026-64642', severity: 'high', summary: 'Middleware / Proxy bypass in App Router applications', url: gh('GHSA-6gpp-xcg3-4w24'), published: '2026-07-22', patched: '16.2.11', reviewed: true },
  { id: 'GHSA-89xv-2m56-2m9x', cve: 'CVE-2026-64649', severity: 'high', summary: 'Server-Side Request Forgery in Server Actions on custom servers', url: gh('GHSA-89xv-2m56-2m9x'), published: '2026-07-22', patched: '16.2.11', reviewed: true },
  { id: 'GHSA-q8wf-6r8g-63ch', cve: 'CVE-2026-64644', severity: 'medium', summary: 'Denial of Service in the Image Optimization API using SVGs', url: gh('GHSA-q8wf-6r8g-63ch'), published: '2026-07-22', patched: '16.2.11', reviewed: true },
]

// Metadata as the toolbar reads it from the document: long title, no description, broken og:image.
const BLOG_SEO: NonNullable<NextToolbarDemoProps['seo']> = {
  title: 'Hello world from the App Router | My blog about Next.js and more',
  canonical: 'https://example.com/blog/hello-world',
  ogImage: 'https://example.com/og/hello-world.png',
  jsonLd: ['{"@context":"https://schema.org","@type":"BlogPosting","headline":"Hello world"}'],
}

const link = (path: string, result: Partial<LinkResult>): LinkResult => ({ url: `https://example.com${path}`, path, ...result })

// A finished link check, broken first as the toolbar sorts them.
const BLOG_LINKS: LinkResult[] = [
  link('/blog/old-draft', { status: 404 }),
  link('/tags/nextjs-16', { status: 404 }),
  link('/', { status: 200 }),
  link('/blog/second-post', { status: 200 }),
  link('/docs/install', { status: 200 }),
  link('/about', { status: 200 }),
  link('/rss', { redirect: true }),
]

// Newest first, as the toolbar records them.
const ACCOUNT_ACTIONS: ActionCall[] = [
  { id: 'c3', actionId: '40f1c9a7e2b84d0c6a5e3f1b9d7c2a8e4f6b0d3c19', page: '/account', startTime: T0 - 20_000, durationMs: 912, status: 500, revalidation: 'none' },
  { id: 'c2', actionId: '00a8d3e61f5c7b9204e8a6c1d3f5b7092e4c6a8b1d', page: '/account', startTime: T0 - 45_000, durationMs: 38, status: 200, revalidation: 'dynamic' },
  { id: 'c1', actionId: '7f3a2c9d1e5b8a4c6f0e2d7b9a1c3e5f8d0b2a4c6e', page: '/account', startTime: T0 - 90_000, durationMs: 124, status: 200, revalidation: 'all' },
]

// What the server route reports: the demo shows names instead of ids, and the revalidate buttons.
const ACCOUNT_ACTION_NAMES: Record<string, ActionName> = {
  '40f1c9a7e2b84d0c6a5e3f1b9d7c2a8e4f6b0d3c19': { name: 'uploadAvatar', file: 'app/account/actions.ts' },
  '00a8d3e61f5c7b9204e8a6c1d3f5b7092e4c6a8b1d': { name: 'refreshSession', file: 'app/account/actions.ts' },
  '7f3a2c9d1e5b8a4c6f0e2d7b9a1c3e5f8d0b2a4c6e': { name: 'saveProfile', file: 'app/account/actions.ts' },
  '60c2e8a4f1d7b3906e5a2c8f4d1b7e3a9c6f0d2b85': { name: 'signOut', file: 'app/account/actions.ts' },
}

// Buttons under the "Account" scenario: each click adds a call to the toolbar, pending first,
// then resolved after `ms`, like a real Server Action.
export type SimulatedAction = { key: 'save' | 'refresh' | 'upload' | 'signOut'; ms: [number, number] } & Pick<
  ActionCall,
  'actionId' | 'status' | 'revalidation' | 'redirect'
>

export const ACCOUNT_BUTTONS: SimulatedAction[] = [
  { key: 'save', actionId: '7f3a2c9d1e5b8a4c6f0e2d7b9a1c3e5f8d0b2a4c6e', status: 200, revalidation: 'all', ms: [90, 220] },
  { key: 'refresh', actionId: '00a8d3e61f5c7b9204e8a6c1d3f5b7092e4c6a8b1d', status: 200, revalidation: 'dynamic', ms: [25, 70] },
  { key: 'upload', actionId: '40f1c9a7e2b84d0c6a5e3f1b9d7c2a8e4f6b0d3c19', status: 500, revalidation: 'none', ms: [600, 1100] },
  { key: 'signOut', actionId: '60c2e8a4f1d7b3906e5a2c8f4d1b7e3a9c6f0d2b85', status: 200, revalidation: 'all', redirect: '/login', ms: [60, 140] },
]

export type ScenarioId = 'home' | 'blog' | 'dashboard' | 'account' | 'checkout' | 'notFound' | 'settings' | 'outdated'

export const SCENARIOS: { id: ScenarioId; props: NextToolbarDemoProps }[] = [
  { id: 'home', props: { pathname: '/', status: 200, timingMs: 26, isStatic: true, insights: ALL, advisories: [] } },
  {
    id: 'blog',
    props: { pathname: '/blog/hello-world', params: { slug: 'hello-world' }, status: 200, timingMs: 58, via: 'rsc', isStatic: true, insights: ALL, advisories: [], seo: BLOG_SEO, ogImageStatus: 404, links: BLOG_LINKS },
  },
  // Next's dev data says static; the no-store fetch makes the toolbar report Dynamic, like `next build`.
  { id: 'dashboard', props: { pathname: '/dashboard', status: 200, timingMs: 251, via: 'rsc', isStatic: true, insights: ALL, advisories: [] } },
  { id: 'account', props: { pathname: '/account', status: 200, timingMs: 44, via: 'rsc', isStatic: false, insights: ALL, advisories: [], actions: ACCOUNT_ACTIONS, actionNames: ACCOUNT_ACTION_NAMES } },
  { id: 'checkout', props: { pathname: '/checkout', status: 500, timingMs: 3030, isStatic: true, insights: ALL, advisories: [] } },
  { id: 'notFound', props: { pathname: '/pricing/enterprise', status: 404, timingMs: 31, isStatic: true, insights: ALL, advisories: [] } },
  { id: 'settings', props: { pathname: '/settings', status: 200, timingMs: 35, via: 'rsc', isStatic: true, insights: ALL, clientErrors: [clientError], advisories: [] } },
  { id: 'outdated', props: { pathname: '/', status: 200, timingMs: 26, isStatic: true, insights: ALL, nextVersion: '16.2.6', advisories: ADVISORIES_16_2_6 } },
]
