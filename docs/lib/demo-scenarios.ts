import type { ClientError, Insight, InsightFetch, InsightSpan, NextToolbarDemoProps } from '@angelitolm/next-toolbar'

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

export type ScenarioId = 'home' | 'blog' | 'dashboard' | 'account' | 'checkout' | 'notFound' | 'settings'

export const SCENARIOS: { id: ScenarioId; props: NextToolbarDemoProps }[] = [
  { id: 'home', props: { pathname: '/', status: 200, timingMs: 26, isStatic: true, insights: ALL } },
  {
    id: 'blog',
    props: { pathname: '/blog/hello-world', params: { slug: 'hello-world' }, status: 200, timingMs: 58, via: 'rsc', isStatic: true, insights: ALL },
  },
  // Next's dev data says static; the no-store fetch makes the toolbar report Dynamic, like `next build`.
  { id: 'dashboard', props: { pathname: '/dashboard', status: 200, timingMs: 251, via: 'rsc', isStatic: true, insights: ALL } },
  { id: 'account', props: { pathname: '/account', status: 200, timingMs: 44, via: 'rsc', isStatic: false, insights: ALL } },
  { id: 'checkout', props: { pathname: '/checkout', status: 500, timingMs: 3030, isStatic: true, insights: ALL } },
  { id: 'notFound', props: { pathname: '/pricing/enterprise', status: 404, timingMs: 31, isStatic: true, insights: ALL } },
  { id: 'settings', props: { pathname: '/settings', status: 200, timingMs: 35, via: 'rsc', isStatic: true, insights: ALL, clientErrors: [clientError] } },
]
