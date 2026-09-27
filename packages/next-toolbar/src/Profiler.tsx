import { Fragment, useEffect, useState } from 'react'
import { ArrowRight2, CloseCircle, Trash } from './icons'
import { Logo } from './Logo'
import { errorOrigins, errorsDuring, supportsRequestInsights, fetchCacheStats, type LoggedError, type Visit, insightHttpStatus, pathOf, spanRows, type FetchCacheStats, type Insight, type InsightFetch } from './core'

type Props = {
  insights: Insight[] // newest first
  selected: Insight | undefined
  onSelect: (requestId: string) => void
  onClose: () => void
  onClear: () => void
  enabled: boolean
  // Browser-side history, shown instead of insights when the Next version can't send them.
  visits: Visit[]
  errorLog: LoggedError[]
  nextVersion?: string
}

// Request profiler panel: recent requests on the left, the selected one on the right.
export function Profiler({ insights, selected, onSelect, onClose, onClear, enabled, visits, errorLog, nextVersion }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="profiler" role="dialog" aria-label="Request profiler">
      <header>
        <span className="brand">
          <span className="mark">
            <Logo size={22} />
          </span>
          NextToolbar
        </span>
        <span className="dim">·</span>
        <b>{enabled ? 'Requests' : 'Page visits'}</b>
        <span className="dim">{enabled ? insights.length : visits.length} captured</span>
        {enabled && <CacheSummary stats={fetchCacheStats(insights.flatMap((i) => i.fetches))} label="fetch cache (all)" />}
        <div className="spacer" />
        <button className="text-btn" onClick={onClear} title="Remove captured requests (except the current page's) and client errors">
          <Trash size={15} />
          Clear
        </button>
        <button className="icon-btn" onClick={onClose} aria-label="Close profiler">
          <CloseCircle size={18} />
        </button>
      </header>
      {!enabled ? (
        <BrowserHistory visits={visits} errorLog={errorLog} nextVersion={nextVersion} />
      ) : (
        <div className="profiler-body">
          <ul className="req-list">
            {insights.map((i) => {
              const status = insightHttpStatus(i)
              return (
                <li key={i.requestId}>
                  <button className={i.requestId === selected?.requestId ? 'active' : ''} onClick={() => onSelect(i.requestId)}>
                    <span className={`pill ${statusClass(status, i.status)}`}>{status ?? (i.status === 'pending' ? '…' : i.status === 'error' ? 'ERR' : '—')}</span>
                    <span className="req-route">{i.route ?? pathOf(i.url) ?? '?'}</span>
                    {isRsc(i) && <span className="tag">RSC</span>}
                    <span className="dim">{ms(i.durationMs)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="req-detail">{selected ? <Detail insight={selected} /> : <div className="hint">Select a request.</div>}</div>
        </div>
      )}
    </div>
  )
}

// Fallback for Next 15 – 16.2 (or insights disabled): what the browser knows about each page visit.
function BrowserHistory({ visits, errorLog, nextVersion }: { visits: Visit[]; errorLog: LoggedError[]; nextVersion?: string }) {
  const [selectedId, setSelectedId] = useState<string>()
  const recent = [...visits].reverse()
  const selected = recent.find((v) => v.id === selectedId) ?? recent[0]
  const errors = selected ? errorsDuring(visits, errorLog, selected) : []

  return (
    <div className="profiler-body">
      <ul className="req-list">
        {recent.map((v) => {
          const count = errorsDuring(visits, errorLog, v).length
          return (
            <li key={v.id}>
              <button className={v.id === selected?.id ? 'active' : ''} onClick={() => setSelectedId(v.id)}>
                <span className={`pill ${statusClass(v.status, 'ok')}`}>{v.status ?? '—'}</span>
                <span className="req-route">{v.route}</span>
                {count > 0 && <span className="count err">{count}</span>}
                {v.via === 'rsc' && <span className="tag">RSC</span>}
                <span className="dim">{ms(v.ms)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="req-detail">
        {selected ? (
          <>
            <section>
              <h3>Summary</h3>
              <dl>
                <dt>Path</dt>
                <dd><code>{selected.pathname}</code></dd>
                <dt>Route</dt>
                <dd>{selected.route}</dd>
                <dt>Type</dt>
                <dd>{selected.via === 'rsc' ? 'Client navigation (RSC payload)' : selected.via === 'document' ? 'Full page load' : '—'}</dd>
                <dt>Status</dt>
                <dd>{selected.status ?? '—'}</dd>
                <dt>{selected.via === 'rsc' ? 'RSC request' : 'Time to first byte'}</dt>
                <dd>{ms(selected.ms)}</dd>
                <dt>Visited</dt>
                <dd>{new Date(selected.startTime).toLocaleTimeString()}</dd>
              </dl>
            </section>
            <section>
              <h3>
                Client errors <span className={`count ${errors.length ? 'err' : ''}`}>{errors.length}</span>
              </h3>
              {errors.length === 0 && <div className="hint">No client errors during this visit.</div>}
              {errors.map((e, i) => (
                <details key={i} className="error-row">
                  <summary>
                    <ArrowRight2 className="chevron" size={14} />
                    <code>{e.message}</code>
                  </summary>
                  <pre className="stack">{e.stack ?? 'No stack trace available.'}</pre>
                </details>
              ))}
            </section>
          </>
        ) : (
          <div className="hint">Navigate to record page visits.</div>
        )}
        <div className="note">
          {supportsRequestInsights(nextVersion) ? (
            <>
              Enable <code>experimental.requestInsights</code> in next.config for server render time, fetches with cache outcome,
              server errors and the span timeline.
            </>
          ) : (
            <>
              Server render time, fetches with cache outcome, server errors and the span timeline need Next.js 16.3+ with{' '}
              <code>experimental.requestInsights</code>
              {nextVersion ? ` (this app runs ${nextVersion})` : ''}.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ insight }: { insight: Insight }) {
  const rows = spanRows(insight)
  const errors = errorOrigins(insight)
  const status = insightHttpStatus(insight)
  return (
    <>
      <section>
        <h3>Summary</h3>
        <dl>
          <dt>URL</dt>
          <dd><code>{insight.url}</code></dd>
          <dt>Route</dt>
          <dd>{insight.route ?? '—'}</dd>
          <dt>Type</dt>
          <dd>{isRsc(insight) ? 'RSC payload (client navigation / prefetch)' : 'Document'}</dd>
          <dt>Status</dt>
          <dd>{status ?? '—'} <span className="dim">({insight.status})</span></dd>
          <dt>Duration</dt>
          <dd>{ms(insight.durationMs)}</dd>
          <dt>Started</dt>
          <dd>{new Date(insight.startTime).toLocaleTimeString()}</dd>
          <dt>Request id</dt>
          <dd><code>{insight.requestId}</code></dd>
        </dl>
      </section>

      {errors.length > 0 && (
        <section>
          <h3>Errors <span className="count err">{errors.length}</span></h3>
          {errors.map((r, i) => (
            <details key={i} className="error-row" open={i === 0}>
              <summary>
                <ArrowRight2 className="chevron" size={14} />
                <b>{r.name}</b> <code>{r.error}</code>
              </summary>
              <dl>
                {r.errorType && (
                  <>
                    <dt>Type</dt>
                    <dd><code>{r.errorType}</code></dd>
                  </>
                )}
                <dt>Message</dt>
                <dd><code>{r.error}</code></dd>
                <dt>Span</dt>
                <dd>{r.name}</dd>
                <dt>At</dt>
                <dd>+{ms(r.offsetMs)} · took {ms(r.durationMs)}</dd>
                {Object.entries(r.attributes ?? {}).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt title={k}>{k.replace(/^next\./, '')}</dt>
                    <dd><code>{typeof v === 'string' ? v : JSON.stringify(v)}</code></dd>
                  </Fragment>
                ))}
              </dl>
              <div className="hint">Full stack trace is in the terminal running <code>next dev</code>.</div>
            </details>
          ))}
        </section>
      )}

      <section>
        <h3>
          Fetches <span className="count">{insight.fetches.length}</span>
          <CacheSummary stats={fetchCacheStats(insight.fetches)} />
        </h3>
        {insight.fetches.length === 0 ? (
          <div className="hint">No server fetches.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Method</th><th>URL</th><th>Status</th><th>Cache</th><th>Time</th></tr>
            </thead>
            <tbody>
              {insight.fetches.map((f, i) => (
                <tr key={i}>
                  <td>{f.method ?? 'GET'}</td>
                  <td><code>{f.url}</code></td>
                  <td>{f.statusCode ?? '—'}</td>
                  <td><CachePill f={f} />{f.cacheReason && <span className="dim"> {formatReason(f.cacheReason)}</span>}</td>
                  <td>{ms(f.durationMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3>Timeline</h3>
        {rows.length === 0 ? (
          <div className="hint">No spans recorded.</div>
        ) : (
          <div className="timeline">
            {rows.map((r, i) => (
              <div key={i} className={`span-row ${r.error ? 'err-text' : ''}`}>
                <span className="span-name" style={{ paddingLeft: r.depth * 10 }} title={r.name}>{r.name}</span>
                <span className="span-track">
                  <span className={`span-bar ${r.error ? 'err' : ''}`} style={{ left: `${r.leftPct}%`, width: `${r.widthPct}%` }} />
                </span>
                <span className="span-ms dim">{ms(r.durationMs)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

const isRsc = (i: Insight) =>
  (i.url ?? '').includes('_rsc=') || (i.spans ?? []).some((s) => s.attributes?.['next.rsc'] === true)

const ms = (n: number | undefined) => (n === undefined ? '—' : `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`)

function statusClass(code: number | undefined, status: Insight['status']) {
  if (code !== undefined) return code >= 400 ? 'err' : code >= 300 ? 'warn' : 'ok'
  return status === 'error' ? 'err' : 'none'
}

const CACHE_KINDS = ['hit', 'hmr', 'miss', 'skip', 'unknown'] as const

// Non-zero outcome chips plus hit rate, e.g. "HIT 2 · MISS 1 · 67% hit".
export function CacheSummary({ stats, label }: { stats: FetchCacheStats; label?: string }) {
  if (!stats.total) return null
  return (
    <span className="cache-summary">
      {label && <span className="dim">{label}</span>}
      {CACHE_KINDS.filter((k) => stats[k]).map((k) => (
        <span key={k} className={`cache ${k}`} title={CACHE_HELP[k]}>
          {k === 'unknown' ? '?' : k} {stats[k]}
        </span>
      ))}
      {stats.hitRate !== undefined && <span className="dim">{Math.round(stats.hitRate * 100)}% hit</span>}
    </span>
  )
}

export function CachePill({ f }: { f: InsightFetch }) {
  const k = f.cacheStatus ?? 'unknown'
  return (
    <span className={`cache ${k}`} title={CACHE_HELP[k as keyof typeof CACHE_HELP]}>
      {f.cacheStatus ?? '?'}
    </span>
  )
}

const CACHE_HELP: Record<(typeof CACHE_KINDS)[number], string> = {
  hit: 'Served from the Next.js data cache',
  hmr: 'Reused across an HMR refresh (dev only)',
  miss: 'Cacheable, fetched from origin and stored',
  skip: 'Not cached (no-store, revalidate: 0, dynamic usage...)',
  unknown: 'No cache info (failed fetch or not reported)',
}

// Next's INFINITE_CACHE (0xfffffffe) is what `force-cache` means under the hood.
const formatReason = (reason: string) => reason.replace('revalidate: 4294967294', 'revalidate: never')
