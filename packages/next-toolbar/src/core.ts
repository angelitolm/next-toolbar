// Pure logic, no React/DOM — covered by core.test.ts.

// 'static-maybe': dev says static, but the route has dynamic segments (see refineRenderMode).
export type RenderMode = 'static' | 'static-maybe' | 'dynamic' | 'pending' | 'unknown'

export type InsightFetch = {
  url?: string
  method?: string
  statusCode?: number
  durationMs?: number
  cacheStatus?: string
  cacheReason?: string
}

export type InsightSpan = {
  name: string
  startTime: number
  durationMs?: number
  status?: 'ok' | 'error'
  spanId?: string
  parentSpanId?: string
  attributes?: Record<string, unknown>
  error?: { type?: string; message?: string }
}

// Subset of Next 16.3's RequestInsight (next/dist/next-devtools/shared/request-insights).
export type Insight = {
  requestId: string
  kind?: string
  route?: string
  url?: string
  startTime: number
  durationMs?: number
  status: 'ok' | 'error' | 'pending'
  spans?: InsightSpan[]
  fetches: InsightFetch[]
}

export type SpanRow = {
  name: string
  depth: number
  offsetMs: number
  durationMs: number
  leftPct: number
  widthPct: number
  error?: string
  errorType?: string
  attributes?: Record<string, unknown>
  // In error with no child in error: the origin, not a parent it bubbled through.
  rootCause: boolean
}

// Waterfall rows in start order. Next emits spans children-first, so depth comes
// from walking parentSpanId; spans whose parent isn't in the list sit at the top level.
export function spanRows(insight: Insight): SpanRow[] {
  const spans = insight.spans ?? []
  if (!spans.length) return []
  const base = Math.min(insight.startTime, ...spans.map((s) => s.startTime))
  const end = Math.max(...spans.map((s) => s.startTime + (s.durationMs ?? 0)), base + (insight.durationMs ?? 0))
  const total = Math.max(end - base, 1)
  const byId = new Map(spans.filter((s) => s.spanId).map((s) => [s.spanId!, s]))
  const depthOf = (s: InsightSpan) => {
    let depth = 0
    const seen = new Set<string>()
    for (let p = s.parentSpanId; p && byId.has(p) && !seen.has(p); p = byId.get(p)!.parentSpanId) {
      seen.add(p)
      depth++
    }
    return depth
  }
  const errorParents = new Set(spans.filter((s) => s.status === 'error').map((s) => s.parentSpanId))
  return [...spans]
    .sort((a, b) => a.startTime - b.startTime)
    .map((s) => {
      const offsetMs = s.startTime - base
      const durationMs = s.durationMs ?? 0
      return {
        name: s.name,
        depth: depthOf(s),
        offsetMs,
        durationMs,
        leftPct: (offsetMs / total) * 100,
        widthPct: Math.max((durationMs / total) * 100, 0.3),
        error: s.status === 'error' ? (s.error?.message ?? s.error?.type ?? 'error') : undefined,
        rootCause: s.status === 'error' && !(s.spanId && errorParents.has(s.spanId)),
        errorType: s.error?.type,
        attributes: s.attributes,
      }
    })
}

// Errors worth showing: spans where an error originated, preferring those that carry a
// message (bare 'error' spans are usually wrappers the error bubbled through).
export function errorOrigins(insight: Insight): SpanRow[] {
  const origins = spanRows(insight).filter((r) => r.rootCause)
  const withMessage = origins.filter((r) => r.error !== 'error')
  return withMessage.length ? withMessage : origins
}

// HTTP status Next records on its request spans; undefined while in flight or on errors.
// Takes the earliest-starting span that has one, i.e. the root `GET` span.
export function insightHttpStatus(insight: Insight): number | undefined {
  let best: InsightSpan | undefined
  for (const s of insight.spans ?? []) {
    if (typeof s.attributes?.['http.status_code'] === 'number' && (!best || s.startTime < best.startTime)) best = s
  }
  return best?.attributes?.['http.status_code'] as number | undefined
}

// Next's fetch cache outcomes (next/dist/server/lib/patch-fetch.js):
// hit = served from the data cache, hmr = dev-only reuse across HMR refreshes,
// miss = cacheable but fetched, skip = not cacheable (no-store, revalidate 0, ...).
export type FetchCacheStats = {
  total: number
  hit: number
  hmr: number
  miss: number
  skip: number
  unknown: number // failed fetches and older Next versions report no status
  hitRate: number | undefined // (hit + hmr) / cacheable; undefined when nothing was cacheable
  ms: number
}

export function fetchCacheStats(fetches: InsightFetch[]): FetchCacheStats {
  const s: FetchCacheStats = { total: fetches.length, hit: 0, hmr: 0, miss: 0, skip: 0, unknown: 0, hitRate: undefined, ms: 0 }
  for (const f of fetches) {
    const status = f.cacheStatus
    if (status === 'hit' || status === 'hmr' || status === 'miss' || status === 'skip') s[status]++
    else s.unknown++
    s.ms += f.durationMs ?? 0
  }
  const cacheable = s.hit + s.hmr + s.miss
  s.hitRate = cacheable ? (s.hit + s.hmr) / cacheable : undefined
  return s
}

export type HmrEvent =
  | { kind: 'manifest'; data: Record<string, boolean> }
  | { kind: 'insights'; list: Insight[] }

// "16.3.0-canary.2" -> [16, 3]. Unknown versions parse as [0, 0].
function majorMinor(version: string | undefined): [number, number] {
  const [major, minor] = (version ?? '').split('.').map((n) => Number.parseInt(n, 10))
  return [major || 0, minor || 0]
}

const atLeast = (version: string | undefined, major: number, minor: number) => {
  const [a, b] = majorMinor(version)
  return a > major || (a === major && b >= minor)
}

// Request insights (experimental.requestInsights) and the /_next/hmr socket both arrived in 16.3.
export const supportsRequestInsights = (nextVersion: string | undefined) => atLeast(nextVersion, 16, 3)

// Next 16.3+ serves HMR on /_next/hmr; Next 15 and 16.0–16.2 on /_next/webpack-hmr.
export function hmrPath(nextVersion: string | undefined): string {
  return supportsRequestInsights(nextVersion) ? '/_next/hmr' : '/_next/webpack-hmr'
}

// The other endpoint, tried when the expected one refuses the connection (unknown/future versions).
export const alternateHmrPath = (path: string) => (path === '/_next/hmr' ? '/_next/webpack-hmr' : '/_next/hmr')

// Path prefix Next serves `/_next/` under: assetPrefix, which defaults to basePath.
// Same derivation as Next's own client (next/dist/client/asset-prefix.js), and the
// dev server mounts the HMR socket under it too.
export function assetPrefixFrom(scriptSrcs: string[]): string {
  for (const src of scriptSrcs) {
    const path = pathOf(src)
    const i = path?.indexOf('/_next/') ?? -1
    if (i >= 0) return path!.slice(0, i)
  }
  return ''
}

// Browser URLs carry basePath; usePathname() and the ISR manifest don't.
export function stripBasePath(pathname: string, basePath: string): string {
  if (!basePath) return pathname
  if (pathname === basePath) return '/'
  return pathname.startsWith(basePath + '/') ? pathname.slice(basePath.length) : pathname
}

// Normalizes the message shapes of Next 15.0 (`action: appIsrManifest`),
// 15.5 (`action: isrManifest`) and 16 (`type: isrManifest`, plus request insights).
export function parseHmr(raw: unknown): HmrEvent | null {
  if (typeof raw !== 'string') return null // binary frames (React debug chunks)
  let msg: any
  try {
    msg = JSON.parse(raw)
  } catch {
    return null
  }
  const type = msg?.type ?? msg?.action
  if (type === 'isrManifest' || type === 'appIsrManifest') {
    return msg.data && typeof msg.data === 'object' ? { kind: 'manifest', data: msg.data } : null
  }
  if (type === 'requestInsightsUpdate' && msg.insight?.requestId) {
    return { kind: 'insights', list: [msg.insight] }
  }
  if (type === 'sync' && Array.isArray(msg.requestInsights?.requests)) {
    return { kind: 'insights', list: msg.requestInsights.requests }
  }
  return null
}

export function renderMode(
  status: number | undefined,
  manifest: Record<string, boolean> | null,
  pathname: string,
  absentMeansDynamic = false,
): RenderMode {
  // Next marks error and not-found pages as static in the manifest; that's noise.
  if (status !== undefined && status >= 400) return 'unknown'
  if (!manifest) return 'unknown'
  const isStatic = manifest[pathname]
  // Next 16 removes the entry while the route renders and then writes true/false.
  // Next 15 only ever writes `true`, so once the response is in, absent = dynamic.
  if (isStatic === undefined) return absentMeansDynamic ? 'dynamic' : 'pending'
  return isStatic ? 'static' : 'dynamic'
}

// Fetch cache reasons that make `next build` render the route on demand. Next's dev
// manifest misses them: patch-fetch only bails out of static during static generation.
// Not listed on purpose: 'auto no cache' (POST / auth headers don't bail) and the
// hard-refresh override, which depends on the request rather than the code.
const DYNAMIC_FETCH_REASONS = new Set([
  'cache: no-store',
  'cache: no-cache',
  'revalidate: 0',
  'fetchCache = force-no-store',
  'fetchCache = only-no-store',
  'fetchCache = default-no-store',
  'noStore call',
])

export type RenderVerdict = { mode: RenderMode; note?: string }

// Corrects Next's dev-only "static" verdict, which only accounts for request APIs
// (headers(), cookies(), searchParams...) and `dynamic = 'force-dynamic'`.
// ponytail: ignores `dynamic = 'force-static'` (would keep no-store routes static); not visible from the browser.
export function refineRenderMode(mode: RenderMode, route: string, fetches: InsightFetch[] = []): RenderVerdict {
  if (mode !== 'static') return { mode }
  const noStore = fetches.find((f) => f.cacheReason && DYNAMIC_FETCH_REASONS.has(f.cacheReason))
  if (noStore) return { mode: 'dynamic', note: `${noStore.cacheReason} fetch: ${noStore.url ?? '?'}` }
  if (route.includes('['))
    return {
      mode: 'static-maybe',
      note: 'Dynamic segment: rendered on demand in production unless generateStaticParams returns these params.',
    }
  return { mode }
}

export function pathOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url, 'http://x').pathname
  } catch {
    return undefined
  }
}

// Latest request insight for this pathname, whether a document load or an RSC fetch.
export function insightFor(insights: Iterable<Insight>, pathname: string, basePath = ''): Insight | undefined {
  let best: Insight | undefined
  for (const i of insights) {
    const path = pathOf(i.url)
    if ((i.kind ?? 'request') !== 'request' || !path || stripBasePath(path, basePath) !== pathname) continue
    if (!best || i.startTime > best.startTime) best = i
  }
  return best
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Fallback for Next 15 (no request insights): rebuild `/blog/[slug]` from the
// pathname and useParams(). ponytail: replaces the LAST matching segment, so a
// param whose value equals a later static segment is mislabeled; insights (Next 16.3+) avoid this.
export function routePattern(pathname: string, params: Record<string, string | string[] | undefined> | null): string {
  let out = pathname
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue
    const parts = Array.isArray(value) ? value : [value]
    const label = Array.isArray(value) ? `[...${key}]` : `[${key}]`
    for (const candidate of new Set([parts.join('/'), parts.map(encodeURIComponent).join('/')])) {
      const re = new RegExp(`^(.*)/${escapeRe(candidate)}(?=/|$)`)
      if (re.test(out)) {
        out = out.replace(re, `$1/${label}`)
        break
      }
    }
  }
  return out
}
