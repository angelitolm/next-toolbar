import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareVersions, internalLinks, linkKey, linkBroken, linkPending, mapLimit, parseActionRevalidated, parseActionRedirect, actionFailed, jsonLdSummary, seoIssues, inRange, patchedFor, fromGlobalAdvisories, fromRepoAdvisories, mergeAdvisories, upgradeTarget, errorsDuring, alternateHmrPath, supportsRequestInsights, errorOrigins, refineRenderMode, assetPrefixFrom, fetchCacheStats, hmrPath, stripBasePath, insightFor, insightHttpStatus, parseHmr, renderMode, routePattern, spanRows, type Insight } from './core.ts'

// Shape captured from Next 16.3.6: children-first, root GET carries the status.
const traced: Insight = {
  requestId: 'r',
  startTime: 1000,
  durationMs: 100,
  status: 'error',
  fetches: [],
  spans: [
    { name: 'render', spanId: 'c', parentSpanId: 'b', startTime: 1020, durationMs: 50, status: 'error', error: { message: 'boom' } },
    { name: 'BaseServer.render', spanId: 'b', parentSpanId: 'a', startTime: 1010, durationMs: 80, status: 'error', attributes: { 'http.status_code': 500 } },
    { name: 'GET', spanId: 'a', parentSpanId: 'outside', startTime: 1000, durationMs: 100, attributes: { 'http.status_code': 200 } },
  ],
}

test('spanRows orders by start, nests by parent, scales to request', () => {
  const rows = spanRows(traced)
  assert.deepEqual(rows.map((r) => [r.name, r.depth, r.offsetMs]), [['GET', 0, 0], ['BaseServer.render', 1, 10], ['render', 2, 20]])
  assert.equal(rows[2].leftPct, 20)
  assert.equal(rows[2].widthPct, 50)
  assert.equal(rows[2].error, 'boom')
  assert.deepEqual(rows.map((r) => r.rootCause), [false, false, true])
  assert.deepEqual(spanRows({ ...traced, spans: [] }), [])
})

test('errorOrigins keeps origins, preferring ones with a message', () => {
  assert.deepEqual(errorOrigins(traced).map((r) => [r.name, r.error]), [['render', 'boom']])
  const bare: Insight = { ...traced, spans: traced.spans!.map((s) => ({ ...s, error: undefined })) }
  assert.deepEqual(errorOrigins(bare).map((r) => r.error), ['error'])
  assert.deepEqual(errorOrigins({ ...traced, spans: [] }), [])
})

test('insightHttpStatus reads the root span', () => {
  assert.equal(insightHttpStatus(traced), 200)
  assert.equal(insightHttpStatus({ ...traced, spans: [] }), undefined)
})

test('hmrPath picks the endpoint by version (/_next/hmr arrived in 16.3)', () => {
  assert.equal(hmrPath('16.3.6'), '/_next/hmr')
  assert.equal(hmrPath('16.3.0-canary.1'), '/_next/hmr')
  assert.equal(hmrPath('17.0.0'), '/_next/hmr')
  assert.equal(hmrPath('16.2.6'), '/_next/webpack-hmr')
  assert.equal(hmrPath('16.0.10'), '/_next/webpack-hmr')
  assert.equal(hmrPath('15.5.26'), '/_next/webpack-hmr')
  assert.equal(hmrPath(undefined), '/_next/webpack-hmr')
  assert.equal(alternateHmrPath('/_next/hmr'), '/_next/webpack-hmr')
  assert.equal(alternateHmrPath('/_next/webpack-hmr'), '/_next/hmr')
})

test('supportsRequestInsights from 16.3', () => {
  assert.equal(supportsRequestInsights('16.2.6'), false)
  assert.equal(supportsRequestInsights('16.3.0'), true)
  assert.equal(supportsRequestInsights('15.5.26'), false)
  assert.equal(supportsRequestInsights(undefined), false)
})

test('parseHmr normalizes Next 15.0, 15.5 and 16 manifest messages', () => {
  const data = { '/': true }
  assert.deepEqual(parseHmr(JSON.stringify({ action: 'appIsrManifest', data })), { kind: 'manifest', data })
  assert.deepEqual(parseHmr(JSON.stringify({ action: 'isrManifest', data })), { kind: 'manifest', data })
  assert.deepEqual(parseHmr(JSON.stringify({ type: 'isrManifest', data })), { kind: 'manifest', data })
})

test('parseHmr reads insights from updates and sync snapshots, ignores the rest', () => {
  const insight = { requestId: 'a', startTime: 1, status: 'ok', fetches: [] }
  assert.deepEqual(parseHmr(JSON.stringify({ type: 'requestInsightsUpdate', insight })), { kind: 'insights', list: [insight] })
  assert.deepEqual(parseHmr(JSON.stringify({ type: 'sync', requestInsights: { requests: [insight] } })), { kind: 'insights', list: [insight] })
  assert.equal(parseHmr(JSON.stringify({ type: 'sync' })), null)
  assert.equal(parseHmr(JSON.stringify({ type: 'built' })), null)
  assert.equal(parseHmr('not json'), null)
  assert.equal(parseHmr(new ArrayBuffer(1)), null)
})

test('renderMode', () => {
  const m = { '/': true, '/dynamic': false }
  assert.equal(renderMode(200, m, '/'), 'static')
  assert.equal(renderMode(200, m, '/dynamic'), 'dynamic')
  assert.equal(renderMode(200, m, '/rendering'), 'pending')
  assert.equal(renderMode(200, { '/': true }, '/dynamic', true), 'dynamic') // Next 15 shape
  assert.equal(renderMode(404, { '/nope': true }, '/nope'), 'unknown')
  assert.equal(renderMode(200, null, '/'), 'unknown')
})

test('insightFor returns latest request insight for pathname, ignoring query', () => {
  const list: Insight[] = [
    { requestId: '1', url: '/blog/a', startTime: 1, status: 'ok', fetches: [] },
    { requestId: '2', url: '/blog/a?_rsc=x', startTime: 3, status: 'ok', fetches: [] },
    { requestId: '3', url: '/blog/a', kind: 'instant-insights', startTime: 9, status: 'ok', fetches: [] },
    { requestId: '4', url: '/other', startTime: 5, status: 'ok', fetches: [] },
  ]
  assert.equal(insightFor(list, '/blog/a')?.requestId, '2')
  assert.equal(insightFor(list, '/missing'), undefined)
})

test('routePattern rebuilds dynamic segments', () => {
  assert.equal(routePattern('/', {}), '/')
  assert.equal(routePattern('/blog/hola', { slug: 'hola' }), '/blog/[slug]')
  assert.equal(routePattern('/shop/a/b/c', { path: ['a', 'b', 'c'] }), '/shop/[...path]')
  assert.equal(routePattern('/u/42/posts/7', { id: '42', post: '7' }), '/u/[id]/posts/[post]')
  assert.equal(routePattern('/blog/hola%20mundo', { slug: 'hola mundo' }), '/blog/[slug]')
  // Value equal to a static segment: last match wins.
  assert.equal(routePattern('/blog/blog', { slug: 'blog' }), '/blog/[slug]')
})

test('assetPrefixFrom mirrors Next client derivation', () => {
  assert.equal(assetPrefixFrom(['http://h/_next/static/chunks/a.js']), '')
  assert.equal(assetPrefixFrom(['', 'http://h/vendor.js', 'http://h/docs/_next/static/a.js']), '/docs')
  assert.equal(assetPrefixFrom(['https://cdn.example.com/assets/_next/static/a.js']), '/assets')
  assert.equal(assetPrefixFrom([]), '')
})

test('stripBasePath', () => {
  assert.equal(stripBasePath('/docs/blog/a', '/docs'), '/blog/a')
  assert.equal(stripBasePath('/docs', '/docs'), '/')
  assert.equal(stripBasePath('/docsx/a', '/docs'), '/docsx/a')
  assert.equal(stripBasePath('/a', ''), '/a')
})

test('insightFor matches basePath-prefixed insight urls', () => {
  const list: Insight[] = [{ requestId: '1', url: '/docs/blog/a?_rsc=1', startTime: 1, status: 'ok', fetches: [] }]
  assert.equal(insightFor(list, '/blog/a', '/docs')?.requestId, '1')
  assert.equal(insightFor(list, '/blog/a'), undefined)
})

test('fetchCacheStats counts outcomes and hit rate over cacheable fetches', () => {
  const s = fetchCacheStats([
    { cacheStatus: 'hit', durationMs: 1 },
    { cacheStatus: 'hmr', durationMs: 1 },
    { cacheStatus: 'miss', durationMs: 10 },
    { cacheStatus: 'skip', durationMs: 20 },
    { durationMs: 5 },
  ])
  assert.deepEqual(
    { ...s, hitRate: s.hitRate?.toFixed(3) },
    { total: 5, hit: 1, hmr: 1, miss: 1, skip: 1, unknown: 1, hitRate: '0.667', ms: 37 },
  )
  assert.equal(fetchCacheStats([{ cacheStatus: 'skip' }]).hitRate, undefined)
  assert.equal(fetchCacheStats([]).total, 0)
})

test('refineRenderMode corrects dev static verdicts', () => {
  const noStore = { url: '/api', cacheStatus: 'skip', cacheReason: 'cache: no-store' }
  assert.deepEqual(refineRenderMode('static', '/cache', [noStore]), { mode: 'dynamic', note: 'cache: no-store fetch: /api' })
  assert.equal(refineRenderMode('static', '/cache', [{ ...noStore, cacheReason: 'revalidate: 0' }]).mode, 'dynamic')
  // Request-dependent or non-bailing reasons keep it static.
  assert.equal(refineRenderMode('static', '/cache', [{ ...noStore, cacheReason: 'cache-control: no-cache (hard refresh)' }]).mode, 'static')
  assert.equal(refineRenderMode('static', '/cache', [{ ...noStore, cacheReason: 'auto no cache' }]).mode, 'static')
  assert.equal(refineRenderMode('static', '/blog/[slug]').mode, 'static-maybe')
  assert.equal(refineRenderMode('static', '/shop/[...path]', [noStore]).mode, 'dynamic') // definite wins
  assert.deepEqual(refineRenderMode('dynamic', '/blog/[slug]', [noStore]), { mode: 'dynamic' })
  assert.deepEqual(refineRenderMode('static', '/'), { mode: 'static' })
})

test('errorsDuring attributes client errors to the visit they happened in', () => {
  const visit = (id: string, startTime: number) => ({ id, pathname: `/${id}`, route: `/${id}`, startTime })
  const visits = [visit('a', 100), visit('b', 200), visit('c', 300)]
  const errors = [{ message: 'e1', at: 150 }, { message: 'e2', at: 200 }, { message: 'e3', at: 250 }, { message: 'e4', at: 900 }, { message: 'e0', at: 50 }]
  assert.deepEqual(errorsDuring(visits, errors, visits[0]).map((e) => e.message), ['e1'])
  assert.deepEqual(errorsDuring(visits, errors, visits[1]).map((e) => e.message), ['e2', 'e3'])
  assert.deepEqual(errorsDuring(visits, errors, visits[2]).map((e) => e.message), ['e4'])
})

test('compareVersions orders releases, prereleases and short versions', () => {
  assert.ok(compareVersions('16.3.6', '16.3.5') > 0)
  assert.ok(compareVersions('16.3.0-canary.2', '16.3.0') < 0)
  assert.equal(compareVersions('16.0', '16.0.0'), 0)
  assert.ok(compareVersions('15.5.26', '16.0.0') < 0)
})

test('inRange reads the ranges written in Next.js advisories', () => {
  assert.equal(inRange('16.2.6', '>= 16.2.0 < 16.3.6'), true) // the ImageResponse RCE
  assert.equal(inRange('16.3.6', '>= 16.2.0 < 16.3.6'), false)
  assert.equal(inRange('15.5.26', '>= 16.2.0 < 16.3.6'), false)
  assert.equal(inRange('16.2.6', '< 16.3.3'), true)
  assert.equal(inRange('16.2.6', ' >= 16.0.0 < 16.2.11'), true)
  assert.equal(inRange('15.5.20', '>=13.0.0 < 15.5.21'), true)
  assert.equal(inRange('12.0.0', '=> 11.1.4 < 12.3.5'), true) // "=>" typo in a real advisory
  assert.equal(inRange('16.1.0', '>=13.0.0 < 15.5.15, >= 16.0 < 16.2.3'), true) // comma = alternatives
  assert.equal(inRange('15.5.15', '>=13.0.0 < 15.5.15, >= 16.0 < 16.2.3'), false)
  assert.equal(inRange('12.5.0', '>= v12.2.0 < 15.5.16'), true)
  assert.equal(inRange('16.1.0', '16.1.0'), true) // bare version = exact
  // Unreadable: unknown, never a guess
  assert.equal(inRange('10.2.0', '10.x'), undefined)
  assert.equal(inRange('15.1.0', '15.0.0 - 15.4.4'), undefined)
  assert.equal(inRange('15.1.0', '>15.0.4 and <15.2.0'), undefined)
})

test('patchedFor picks the fix for the installed line', () => {
  assert.equal(patchedFor('15.5.14, 16.1.7', '16.1.2'), '16.1.7')
  assert.equal(patchedFor('15.5.14, 16.1.7', '15.4.0'), '15.5.14')
  assert.equal(patchedFor('16.3.6', '16.2.6'), '16.3.6')
  assert.equal(patchedFor('16.3.6', '16.3.6'), undefined)
  assert.equal(patchedFor(null, '16.2.6'), undefined)
})

const NOW = Date.parse('2026-09-27T12:00:00Z')
const imageResponse = {
  ghsa_id: 'GHSA-vcvr-r3jv-pc5j', cve_id: 'CVE-2026-94545', severity: 'critical', summary: 'Remote Code Execution in next/og ImageResponse',
  html_url: 'https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j', published_at: '2026-09-22T00:00:00Z',
  vulnerabilities: [{ package: { name: 'next' }, vulnerable_version_range: '>= 16.2.0 < 16.3.6', patched_versions: '16.3.6' }],
}
const proxyBypass = {
  ghsa_id: 'GHSA-6gpp-xcg3-4w24', cve_id: 'CVE-2026-64642', severity: 'high', summary: 'Middleware / Proxy bypass',
  html_url: 'https://github.com/advisories/GHSA-6gpp-xcg3-4w24', published_at: '2026-07-22T00:00:00Z',
  vulnerabilities: [{ package: { name: 'next' }, vulnerable_version_range: '>= 16.0.0, < 16.2.11', first_patched_version: '16.2.11' }],
}

test('advisories: global + fresh repo ones, merged and prioritised', () => {
  const global = fromGlobalAdvisories([proxyBypass], '16.2.6')
  assert.deepEqual(global.map((a) => [a.id, a.patched, a.reviewed]), [['GHSA-6gpp-xcg3-4w24', '16.2.11', true]])

  const repo = fromRepoAdvisories([imageResponse, { ...imageResponse, ghsa_id: 'OLD', published_at: '2025-01-01T00:00:00Z' }], '16.2.6', NOW)
  assert.deepEqual(repo.map((a) => [a.id, a.patched, a.reviewed]), [['GHSA-vcvr-r3jv-pc5j', '16.3.6', false]]) // old one skipped
  assert.deepEqual(fromRepoAdvisories([imageResponse], '16.3.6', NOW), []) // patched version
  // Real case: "< 16.3.3" only means the 16.x line; 15.5.26 is past this advisory's 15.x fix (15.5.24).
  const loose = { ...imageResponse, ghsa_id: 'GHSA-2xp9-vwfh-vxw4', vulnerabilities: [
    { package: { name: 'next' }, vulnerable_version_range: '>= 10.0.0 < 15.5.24', patched_versions: '15.5.24' },
    { package: { name: 'next' }, vulnerable_version_range: '< 16.3.3', patched_versions: '16.3.3' },
  ] }
  assert.deepEqual(fromRepoAdvisories([loose], '15.5.26', NOW), [])
  assert.deepEqual(fromRepoAdvisories([loose], '15.5.20', NOW).map((a) => a.patched), ['15.5.24'])
  assert.deepEqual(fromRepoAdvisories([loose], '16.2.6', NOW).map((a) => a.patched), ['16.3.3'])
  assert.deepEqual(fromRepoAdvisories([{ ...imageResponse, withdrawn_at: '2026-09-23' }], '16.2.6', NOW), [])

  const merged = mergeAdvisories(global, repo, fromGlobalAdvisories([proxyBypass], '16.2.6'))
  assert.deepEqual(merged.map((a) => a.id), ['GHSA-vcvr-r3jv-pc5j', 'GHSA-6gpp-xcg3-4w24']) // critical first, deduped
  assert.equal(upgradeTarget(merged), '16.3.6')
  assert.equal(upgradeTarget([]), undefined)
  assert.deepEqual(fromGlobalAdvisories({ message: 'rate limited' }, '16.2.6'), [])
})

test('jsonLdSummary collects @type from objects, arrays and @graph; counts invalid blocks', () => {
  const blocks = [
    '{"@context":"https://schema.org","@type":"BlogPosting"}',
    '[{"@type":["Person","Author"]}]',
    '{"@graph":[{"@type":"WebSite"}]}',
    '{not json',
  ]
  assert.deepEqual(jsonLdSummary(blocks), { types: ['BlogPosting', 'Person', 'Author', 'WebSite'], invalid: 1 })
})

test('seoIssues flags missing, too long, noindex, broken og:image and bad JSON-LD', () => {
  const good = { title: 'Hola', description: 'Un post', ogImage: 'http://localhost:3000/og.png', jsonLd: ['{"@type":"BlogPosting"}'] }
  assert.deepEqual(seoIssues(good, 200), [{ level: 'ok', message: 'JSON-LD parses.' }])
  assert.deepEqual(seoIssues({ jsonLd: [] }).map((i) => i.level), ['err', 'err', 'warn'])
  const bad = seoIssues({ ...good, title: 'x'.repeat(61), description: 'y'.repeat(161), robots: 'noindex, follow', ogImage: '/og.png', jsonLd: ['{'] }, 404)
  assert.deepEqual(bad.map((i) => i.level), ['warn', 'warn', 'warn', 'warn', 'err', 'err'])
  assert.match(bad[0].message, /61 characters/)
  // Length counts characters, not UTF-16 units.
  assert.equal(seoIssues({ ...good, title: '😀'.repeat(60) }).length, 1)
})

test('parseActionRevalidated reads Next 16 numbers and Next 15 tuples', () => {
  assert.equal(parseActionRevalidated(null), 'none')
  assert.equal(parseActionRevalidated('0'), 'none')
  assert.equal(parseActionRevalidated('1'), 'all')
  assert.equal(parseActionRevalidated('2'), 'dynamic')
  assert.equal(parseActionRevalidated('[[],0,0]'), 'none')
  assert.equal(parseActionRevalidated('[[],1,0]'), 'all')
  assert.equal(parseActionRevalidated('[[],0,1]'), 'all')
  assert.equal(parseActionRevalidated('[["/blog"],0,0]'), 'all')
  assert.equal(parseActionRevalidated('nope'), undefined)
  assert.equal(parseActionRevalidated('7'), undefined)
})

test('parseActionRedirect and actionFailed', () => {
  assert.equal(parseActionRedirect('/blog/hola;push'), '/blog/hola')
  assert.equal(parseActionRedirect(null), undefined)
  const call = { id: 'a', actionId: 'x', page: '/', startTime: 0 }
  assert.equal(actionFailed(call), false) // pending
  assert.equal(actionFailed({ ...call, status: 200 }), false)
  assert.equal(actionFailed({ ...call, status: 500 }), true)
  assert.equal(actionFailed({ ...call, error: 'Failed to fetch' }), true)
})

test('internalLinks keeps same-origin page links once, without hash, in order', () => {
  const origin = 'http://localhost:3000'
  const hrefs = [
    'http://localhost:3000/blog/a#intro',
    'http://localhost:3000/about',
    'http://localhost:3000/blog/a',
    'http://localhost:3000/search?q=x',
    'https://example.com/elsewhere',
    'mailto:hi@example.com',
    'javascript:void(0)',
    'http://localhost:3000/_next/static/chunk.js',
    'http://localhost:3000/docs/_next/image?url=x',
    'not a url',
  ]
  assert.deepEqual(internalLinks(hrefs, origin), [
    'http://localhost:3000/blog/a',
    'http://localhost:3000/about',
    'http://localhost:3000/search?q=x',
  ])
  assert.equal(linkKey('http://localhost:3000/a?b=1#c'), 'http://localhost:3000/a?b=1')
})

test('linkBroken and linkPending', () => {
  const r = { url: 'u', path: '/u' }
  assert.equal(linkPending(r), true)
  assert.equal(linkBroken(r), false)
  assert.equal(linkBroken({ ...r, status: 200 }), false)
  assert.equal(linkBroken({ ...r, status: 404 }), true)
  assert.equal(linkBroken({ ...r, redirect: true }), false)
  assert.equal(linkPending({ ...r, redirect: true }), false)
  assert.equal(linkBroken({ ...r, error: 'Failed to fetch' }), true)
})

test('mapLimit caps concurrency and keeps order', async () => {
  let active = 0
  let peak = 0
  const out = await mapLimit([30, 10, 20, 5, 15], 2, async (ms, i) => {
    peak = Math.max(peak, ++active)
    await new Promise((r) => setTimeout(r, ms))
    active--
    return i
  })
  assert.deepEqual(out, [0, 1, 2, 3, 4])
  assert.equal(peak, 2)
  assert.deepEqual(await mapLimit([], 3, async () => 1), [])
})
