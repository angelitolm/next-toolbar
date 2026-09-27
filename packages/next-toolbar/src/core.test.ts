import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alternateHmrPath, supportsRequestInsights, errorOrigins, refineRenderMode, assetPrefixFrom, fetchCacheStats, hmrPath, stripBasePath, insightFor, insightHttpStatus, parseHmr, renderMode, routePattern, spanRows, type Insight } from './core.ts'

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
