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

// A page the user was on, recorded from the browser when request insights aren't available
// (Next 15 – 16.2). Built from route changes, so prefetches never show up as visits.
export type Visit = {
  id: string
  pathname: string
  route: string
  startTime: number
  status?: number
  ms?: number
  via?: 'document' | 'rsc'
}

export type LoggedError = { message: string; stack?: string; at: number }

// Client errors raised while `visit` was the current page: from its start until the next visit.
export function errorsDuring(visits: Visit[], errors: LoggedError[], visit: Visit): LoggedError[] {
  const next = Math.min(...visits.filter((v) => v.startTime > visit.startTime).map((v) => v.startTime), Infinity)
  return errors.filter((e) => e.at >= visit.startTime && e.at < next)
}

// ── Security advisories ───────────────────────────────────────────────────────

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Advisory = {
  id: string // GHSA id
  cve?: string
  severity: Severity
  summary: string
  url: string
  published: string
  /** First version that fixes it for the installed line, when known. */
  patched?: string
  /** false: published by Next.js but not yet reviewed into GitHub's global database. */
  reviewed: boolean
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function toSeverity(value: unknown): Severity {
  return value === 'critical' || value === 'high' || value === 'low' ? value : 'medium' // GitHub also says "moderate"
}

// "16.3.0-canary.2" -> { nums: [16, 3, 0], pre: 'canary.2' }. Missing parts count as 0.
function parseSemver(v: string) {
  const m = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(v)
  if (!m) return undefined
  return { nums: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)], pre: m[4] }
}

export function compareVersions(a: string, b: string): number {
  const x = parseSemver(a)
  const y = parseSemver(b)
  if (!x || !y) return 0
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i]
  if (x.pre === y.pre) return 0
  if (!x.pre) return 1 // a release sorts after its prereleases
  if (!y.pre) return -1
  return x.pre < y.pre ? -1 : 1
}

// Matches a version against a vulnerable range as written in Next.js' repository advisories:
// ">= 16.2.0 < 16.3.6", "< 16.3.3", "=> 11.1.4 < 12.3.5", ">=13.0.0 < 15.5.15, >= 16.0 < 16.2.3".
// Commas and "||" separate alternatives. Returns undefined when the range can't be read reliably
// ("10.x", "15.0.0 - 15.4.4", prose), so the caller can ignore it instead of guessing.
export function inRange(version: string, range: string): boolean | undefined {
  const alternatives = range.split(/\|\||,/).map((part) => part.trim()).filter(Boolean)
  if (!alternatives.length) return undefined
  let matched = false
  for (const alt of alternatives) {
    const tokens = alt.replace(/=>/g, '>=').match(/(>=|<=|>|<|=)?\s*v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?/g)
    if (!tokens || tokens.join('').replace(/\s/g, '') !== alt.replace(/=>/g, '>=').replace(/\s/g, '')) return undefined
    const ok = tokens.every((token) => {
      const [, op = '=', ver] = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(token.trim())!
      const c = compareVersions(version, ver)
      return op === '>=' ? c >= 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : c === 0
    })
    matched ||= ok
  }
  return matched
}

// From a patched list like "15.5.14, 16.1.7", the fix for the installed line: the lowest
// patched version above `version` in the same major, else the lowest one above it at all.
export function patchedFor(patched: string | null | undefined, version: string): string | undefined {
  const above = (patched ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => parseSemver(p) && compareVersions(p, version) > 0)
    .sort(compareVersions)
  const major = parseSemver(version)?.nums[0]
  return above.find((p) => parseSemver(p)?.nums[0] === major) ?? above[0]
}

type GhVulnerability = {
  package?: { name?: string }
  vulnerable_version_range?: string
  first_patched_version?: string | { identifier?: string } | null
  patched_versions?: string | null
}
type GhAdvisory = {
  ghsa_id: string
  cve_id?: string | null
  severity?: string
  summary?: string
  html_url: string
  published_at?: string
  withdrawn_at?: string | null
  vulnerabilities?: GhVulnerability[]
}

const nextEntries = (a: GhAdvisory) => (a.vulnerabilities ?? []).filter((v) => v.package?.name === 'next')

const toAdvisory = (a: GhAdvisory, patched: string | undefined, reviewed: boolean): Advisory => ({
  id: a.ghsa_id,
  cve: a.cve_id ?? undefined,
  severity: toSeverity(a.severity),
  summary: a.summary ?? a.ghsa_id,
  url: a.html_url,
  published: a.published_at ?? '',
  patched,
  reviewed,
})

// GitHub's global database, already filtered by `affects=next@<version>`: GitHub did the matching.
export function fromGlobalAdvisories(json: unknown, version: string): Advisory[] {
  if (!Array.isArray(json)) return []
  return (json as GhAdvisory[])
    .filter((a) => !a.withdrawn_at)
    .map((a) => {
      const patched = nextEntries(a)
        .filter((v) => inRange(version, v.vulnerable_version_range ?? '') !== false)
        .map((v) => (typeof v.first_patched_version === 'string' ? v.first_patched_version : v.first_patched_version?.identifier))
      return toAdvisory(a, patchedFor(patched.filter(Boolean).join(','), version), true)
    })
}

// Next.js' own repository advisories: the freshest source (published before GitHub reviews them),
// but free-text ranges. Only recent ones are used, and only when their range can be read.
export function fromRepoAdvisories(json: unknown, version: string, now: number, days = 60): Advisory[] {
  if (!Array.isArray(json)) return []
  const since = now - days * 86_400_000
  const out: Advisory[] = []
  for (const a of json as GhAdvisory[]) {
    if (a.withdrawn_at || !a.published_at || Date.parse(a.published_at) < since) continue
    const entries = nextEntries(a)
    const hits = entries.filter((v) => inRange(version, v.vulnerable_version_range ?? '') === true)
    // Loosely written ranges ("< 16.3.3" meaning only the 16.x line) can catch other lines. If the
    // advisory ships a fix for the installed major that is already at or below it, it doesn't apply.
    const major = parseSemver(version)?.nums[0]
    const lineFixed = entries
      .flatMap((v) => (v.patched_versions ?? '').split(','))
      .map((p) => p.trim())
      .some((p) => parseSemver(p)?.nums[0] === major && compareVersions(p, version) <= 0)
    if (hits.length && !lineFixed) out.push(toAdvisory(a, patchedFor(hits.map((v) => v.patched_versions ?? '').join(','), version), false))
  }
  return out
}

// Union by id, preferring the reviewed entry; most severe first, then newest.
export function mergeAdvisories(...lists: Advisory[][]): Advisory[] {
  const byId = new Map<string, Advisory>()
  for (const a of lists.flat()) {
    const prev = byId.get(a.id)
    if (!prev || (!prev.reviewed && a.reviewed)) byId.set(a.id, { ...a, patched: a.patched ?? prev?.patched })
  }
  return [...byId.values()].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.published.localeCompare(a.published),
  )
}

// The version to upgrade to so every known advisory is fixed: the highest of their fixes.
export function upgradeTarget(advisories: Advisory[]): string | undefined {
  return advisories
    .map((a) => a.patched)
    .filter((p): p is string => !!p)
    .sort(compareVersions)
    .at(-1)
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

// ── SEO ───────────────────────────────────────────────────────────────────────

// What the page's metadata resolved to in the browser (Next writes it into document.head).
export type SeoData = {
  title?: string
  description?: string
  canonical?: string
  robots?: string
  ogImage?: string
  /** Raw text of each <script type="application/ld+json">. */
  jsonLd: string[]
}

export type SeoIssue = { level: 'err' | 'warn' | 'ok'; message: string }

// Search results cut titles around 60 characters and descriptions around 160.
const TITLE_MAX = 60
const DESCRIPTION_MAX = 160

export function jsonLdSummary(blocks: string[]): { types: string[]; invalid: number } {
  const types: string[] = []
  let invalid = 0
  const collect = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(collect)
    if (!node || typeof node !== 'object') return
    const { '@type': type, '@graph': graph } = node as Record<string, unknown>
    for (const t of [type].flat()) if (typeof t === 'string') types.push(t)
    collect(graph)
  }
  for (const block of blocks) {
    try {
      collect(JSON.parse(block))
    } catch {
      invalid++
    }
  }
  return { types, invalid }
}

// ponytail: checks what search engines and link previews trip over most, not a full SEO audit.
export function seoIssues(seo: SeoData, ogImageStatus?: number): SeoIssue[] {
  const issues: SeoIssue[] = []
  const length = (s: string) => [...s].length
  if (!seo.title) issues.push({ level: 'err', message: 'Missing <title>.' })
  else if (length(seo.title) > TITLE_MAX)
    issues.push({ level: 'warn', message: `Title is ${length(seo.title)} characters; search results cut it around ${TITLE_MAX}.` })
  if (!seo.description) issues.push({ level: 'err', message: 'Missing description. Add it in metadata or generateMetadata.' })
  else if (length(seo.description) > DESCRIPTION_MAX)
    issues.push({ level: 'warn', message: `Description is ${length(seo.description)} characters; search results cut it around ${DESCRIPTION_MAX}.` })
  if (seo.robots && /noindex/i.test(seo.robots)) issues.push({ level: 'warn', message: `robots is "${seo.robots}": search engines won't index this page.` })
  if (!seo.ogImage) issues.push({ level: 'warn', message: 'No og:image: link previews show no image.' })
  else if (!/^https?:\/\//i.test(seo.ogImage))
    issues.push({ level: 'warn', message: 'og:image is a relative URL; crawlers need an absolute one (set metadataBase).' })
  if (ogImageStatus !== undefined && ogImageStatus >= 400) issues.push({ level: 'err', message: `og:image returns ${ogImageStatus}.` })
  const ld = jsonLdSummary(seo.jsonLd)
  if (ld.invalid) issues.push({ level: 'err', message: `${ld.invalid} JSON-LD block${ld.invalid > 1 ? 's are' : ' is'} not valid JSON.` })
  else if (seo.jsonLd.length) issues.push({ level: 'ok', message: 'JSON-LD parses.' })
  return issues
}

// ── Server Actions ────────────────────────────────────────────────────────────

// What the action told the client router to throw away, from `x-action-revalidated`.
// 'all': static and dynamic data (updateTag, revalidatePath, cookies set...); 'dynamic': refresh().
export type ActionRevalidation = 'none' | 'all' | 'dynamic'

export type ActionCall = {
  /** Unique per call. */
  id: string
  /** Server reference id Next sends in the `next-action` header. */
  actionId: string
  /** Page the action was called from, without basePath. */
  page: string
  startTime: number
  /** Until the response headers arrived; undefined while pending. */
  durationMs?: number
  status?: number
  /** The request itself failed (network, aborted). */
  error?: string
  revalidation?: ActionRevalidation
  redirect?: string
}

// Next 16: a number (0 none, 1 static and dynamic, 2 dynamic only), header absent when 0.
// Next 15: `[[paths], tagRevalidated, cookieRevalidated]`, always sent.
// Undefined when the header can't be read.
export function parseActionRevalidated(header: string | null): ActionRevalidation | undefined {
  if (header === null) return 'none'
  let value: unknown
  try {
    value = JSON.parse(header)
  } catch {
    return undefined
  }
  if (value === 0) return 'none'
  if (value === 1) return 'all'
  if (value === 2) return 'dynamic'
  if (Array.isArray(value)) {
    const [paths, tag, cookie] = value
    return (Array.isArray(paths) && paths.length) || tag || cookie ? 'all' : 'none'
  }
  return undefined
}

// `x-action-redirect` is "<url>;push" or "<url>;replace".
export const parseActionRedirect = (header: string | null) => header?.split(';')[0] || undefined

export const actionFailed = (call: ActionCall) => call.error !== undefined || (call.status !== undefined && call.status >= 400)

// ── Links ─────────────────────────────────────────────────────────────────────

export type LinkResult = {
  /** Absolute URL without the hash: what gets requested, and the key to find its anchors. */
  url: string
  /** Pathname and search without basePath, for display. */
  path: string
  status?: number
  /** Answered with a redirect; not followed (see useLinkCheck). */
  redirect?: boolean
  /** The request failed (network, dev server down). */
  error?: string
}

// "http://x/a?b#c" -> "http://x/a?b"; undefined for anything that isn't an http(s) URL.
export function linkKey(href: string): string | undefined {
  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    url.hash = ''
    return url.href
  } catch {
    return undefined
  }
}

// Same-origin page links worth checking, deduped, in document order. Skips other origins,
// mailto:/tel:/javascript:, and Next's own /_next/ assets.
export function internalLinks(hrefs: string[], origin: string): string[] {
  const out = new Set<string>()
  for (const href of hrefs) {
    const key = linkKey(href)
    if (!key) continue
    const url = new URL(key)
    if (url.origin === origin && !url.pathname.includes('/_next/')) out.add(key)
  }
  return [...out]
}

export const linkPending = (r: LinkResult) => r.status === undefined && !r.redirect && r.error === undefined
export const linkBroken = (r: LinkResult) => r.error !== undefined || (r.status !== undefined && r.status >= 400)

// Runs `fn` over `items` with at most `limit` in flight; results keep the input order.
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

// ── Server route (@angelitolm/next-toolbar/server) ────────────────────────────

/** Where the app mounts the server route, under basePath. */
export const SERVER_ROUTE = '/api/next-toolbar'
/** Sent on every toolbar request to the server route; see server.ts for why. */
export const SERVER_HEADER = 'x-next-toolbar'

export type ActionName = { name: string; file?: string }

// Merges Next's server-reference-manifest.json files into id -> export name. Next 15 (webpack)
// writes one for the app, Next 16 (Turbopack) one per route; both use { node, edge } maps of
// id -> { exportedName, filename }.
export function actionNames(manifests: unknown[]): Record<string, ActionName> {
  const out: Record<string, ActionName> = {}
  for (const manifest of manifests) {
    if (!manifest || typeof manifest !== 'object') continue
    for (const runtime of ['node', 'edge'] as const) {
      const entries = (manifest as Record<string, unknown>)[runtime]
      if (!entries || typeof entries !== 'object') continue
      for (const [id, entry] of Object.entries(entries as Record<string, { exportedName?: unknown; filename?: unknown }>)) {
        if (typeof entry?.exportedName !== 'string') continue
        out[id] = { name: entry.exportedName, file: typeof entry.filename === 'string' ? entry.filename : undefined }
      }
    }
  }
  return out
}

// ── Data cache (fetch-cache entries on disk) ──────────────────────────────────

// What Next's file-system cache knows about a cached fetch. Request insights carry the fetch's URL
// and cache status but not its tags or revalidate, so the server route reads them from disk and
// the toolbar joins the two by URL.
export type CachedFetch = {
  url: string
  /** Tags from `next: { tags }`, without Next's implicit `_N_T_` route tags. */
  tags: string[]
  /** Seconds; undefined when the entry never expires on its own (force-cache). */
  revalidate?: number
  /** When the entry was written: the file's mtime, which is what Next compares against. */
  storedAt: number
}

// Next writes `revalidate: false` or a one-year CACHE_ONE_YEAR for force-cache.
const NEVER_EXPIRES = 31_536_000

// One .next/(dev/)cache/fetch-cache/<key> file. Undefined for anything that isn't a fetch entry.
export function parseFetchCacheEntry(json: unknown, mtimeMs: number): CachedFetch | undefined {
  const entry = json as { kind?: unknown; data?: { url?: unknown }; tags?: unknown; revalidate?: unknown } | null
  if (entry?.kind !== 'FETCH' || typeof entry.data?.url !== 'string') return undefined
  const tags = Array.isArray(entry.tags) ? entry.tags.filter((t): t is string => typeof t === 'string' && !t.startsWith('_N_T_')) : []
  const revalidate = typeof entry.revalidate === 'number' && entry.revalidate > 0 && entry.revalidate < NEVER_EXPIRES ? entry.revalidate : undefined
  return { url: entry.data.url, tags, revalidate, storedAt: mtimeMs }
}

// url -> newest entry. The same URL can have several entries (different headers or bodies);
// the newest is the one the last render wrote or read.
// ponytail: joins by URL only, so two fetches of one URL with different tags show the newest one's.
export function indexFetchCache(entries: CachedFetch[]): Record<string, CachedFetch> {
  const out: Record<string, CachedFetch> = {}
  for (const e of entries) if (!out[e.url] || e.storedAt > out[e.url].storedAt) out[e.url] = e
  return out
}

export type Freshness = { state: 'fresh' | 'stale' | 'forever'; /** Seconds until stale, or since. */ seconds?: number }

// Same rule as Next's cache: stale once `revalidate` seconds have passed since it was stored.
export function freshness(entry: CachedFetch, now: number): Freshness {
  if (entry.revalidate === undefined) return { state: 'forever' }
  const left = Math.round((entry.storedAt + entry.revalidate * 1000 - now) / 1000)
  return left > 0 ? { state: 'fresh', seconds: left } : { state: 'stale', seconds: Math.abs(left) }
}

// 45 -> "45s", 2337 -> "38m", 93600 -> "26h": coarse on purpose, it's a glance at freshness.
export const shortDuration = (seconds: number) =>
  seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`

// Distinct tags of the page's fetches, in fetch order: what can be revalidated from here.
export function pageTags(fetches: InsightFetch[], cache: Record<string, CachedFetch>): string[] {
  const out = new Set<string>()
  for (const f of fetches) for (const t of (f.url && cache[f.url]?.tags) || []) out.add(t)
  return [...out]
}

export type RevalidateRequest =
  | { kind: 'path'; path: string; type?: 'page' | 'layout' }
  | { kind: 'tag'; tag: string }
  // Every tag of one fetch, in one request and one page refresh.
  | { kind: 'tags'; tags: string[] }

// Next caps tags at 256 characters, and a fetch at 128 tags.
const validTag = (tag: unknown): tag is string => typeof tag === 'string' && tag.trim() !== '' && tag.length <= 256
const MAX_TAGS = 128

// Validates a POST body before it reaches revalidatePath / revalidateTag.
export function parseRevalidate(body: unknown): RevalidateRequest | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (b.kind === 'tag') {
    return validTag(b.tag) ? { kind: 'tag', tag: b.tag.trim() } : { error: 'tag must be a non-empty string of up to 256 characters' }
  }
  if (b.kind === 'tags') {
    return Array.isArray(b.tags) && b.tags.length > 0 && b.tags.length <= MAX_TAGS && b.tags.every(validTag)
      ? { kind: 'tags', tags: [...new Set(b.tags.map((t: string) => t.trim()))] }
      : { error: `tags must be 1 to ${MAX_TAGS} non-empty strings of up to 256 characters` }
  }
  if (b.kind === 'path') {
    if (typeof b.path !== 'string' || !b.path.startsWith('/') || b.path.length > 1024) return { error: 'path must start with /' }
    if (b.type !== undefined && b.type !== 'page' && b.type !== 'layout') return { error: "type must be 'page' or 'layout'" }
    return { kind: 'path', path: b.path, type: b.type }
  }
  return { error: "kind must be 'path', 'tag' or 'tags'" }
}
