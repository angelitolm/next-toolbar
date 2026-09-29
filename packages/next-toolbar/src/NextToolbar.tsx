import { useCallback, useEffect, useLayoutEffect, useRef, useState, version as reactVersion, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { type ActionName, type RevalidateRequest, SERVER_HEADER, SERVER_ROUTE, type LinkResult, internalLinks, linkBroken, linkKey, linkPending, mapLimit, type ActionCall, actionFailed, parseActionRedirect, parseActionRevalidated, type Advisory, type SeoData, jsonLdSummary, seoIssues, type LoggedError, type Visit, fromGlobalAdvisories, fromRepoAdvisories, mergeAdvisories, upgradeTarget, alternateHmrPath, assetPrefixFrom, errorOrigins, supportsRequestInsights, fetchCacheStats, refineRenderMode, type RenderMode, hmrPath, insightFor, parseHmr, renderMode, routePattern, stripBasePath, type Insight } from './core'
import { ArrangeHorizontal, ArrowRight, ArrowRight2, CloseCircle, Code, Danger, ExportSquare, Flash, Hashtag, Link21, Monitor, Moon, Refresh2, Routing2, SearchNormal1, ShieldCross, ShieldSearch, ShieldTick, Sun1, Timer1 } from './icons'
import { Logo } from './Logo'
import { VERSION } from './version'
import { CachePill, CacheSummary, Profiler } from './Profiler'
import { css } from './styles'

declare global {
  interface Window {
    next?: { version?: string }
  }
}

export type Timing = { status?: number; ms: number; via: 'document' | 'rsc' }

const STORAGE_KEY = 'next-toolbar:collapsed'
const THEME_KEY = 'next-toolbar:theme'
const SEEN_KEY = 'next-toolbar:seen'

// Segments added in the current minor: they wear a "new" badge until first opened.
// ponytail: edit by hand on each release that adds a segment.
const NEW_SEGMENTS = ['actions', 'seo', 'links']

export type Theme = 'system' | 'light' | 'dark'

export type NextToolbarProps = {
  /** Initial theme. The toolbar's theme button overrides it and remembers the choice per browser. */
  theme?: Theme
  /**
   * Check the installed Next.js version against GitHub's security advisories (default true).
   * The browser downloads the advisory lists from api.github.com (your version is only sent in the
   * query to GitHub's advisory database) and caches the result for 6 hours.
   */
  securityCheck?: boolean
}
const MAX_INSIGHTS = 100
// Inlined by Next's bundler (define-env) for every module, packages included.
const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH || ''

export function NextToolbar({ theme = 'system', securityCheck = true }: NextToolbarProps = {}) {
  // Dead code in production builds: the bundler inlines NODE_ENV.
  if (process.env.NODE_ENV !== 'development') return null
  return <Toolbar defaultTheme={theme} securityCheck={securityCheck} />
}

function Toolbar({ defaultTheme, securityCheck }: { defaultTheme: Theme; securityCheck: boolean }) {
  const pathname = usePathname()
  const params = useParams()
  const timings = useTimings()
  const { manifest, insights, connected, clear } = useHmr()
  const { errors, setErrors, log, setLog } = useClientErrors(pathname)
  const nextVersion = typeof window !== 'undefined' ? window.next?.version : undefined
  const timing = timings[pathname]
  const [visits, setVisits] = useVisits(pathname, routePattern(pathname, params), timing)
  const [security, refreshSecurity] = useSecurity(nextVersion, securityCheck)
  const seo = useSeo(pathname)
  const [actions, setActions] = useServerActions()
  const [links, checkLinks] = useLinkCheck(pathname)
  const router = useRouter()
  const [server, probeServer, revalidate] = useToolbarServer(router.refresh)

  return (
    <ToolbarView
      defaultTheme={defaultTheme}
      data={{ pathname, params, timing, manifest, insights, connected, errors, nextVersion, basePath: BASE_PATH, visits, errorLog: log, security, seo, actions, links, server }}
      onRefreshSecurity={refreshSecurity}
      onRefreshPage={() => router.refresh()}
      onClearActions={() => setActions([])}
      onCheckLinks={checkLinks}
      onProbeServer={probeServer}
      onRevalidate={revalidate}
      onClear={(keepId) => {
        clear(keepId)
        setErrors([])
        setLog([])
        setVisits((v) => v.slice(-1))
      }}
    />
  )
}

// Everything the bar shows. The live toolbar reads it from Next; NextToolbarDemo passes fixtures.
export type ToolbarData = {
  pathname: string
  params: Record<string, string | string[] | undefined> | null
  timing?: Timing
  manifest: Record<string, boolean> | null
  insights: Map<string, Insight>
  connected: boolean
  errors: ClientError[]
  nextVersion?: string
  basePath: string
  /** Browser-side history, used by the profiler when request insights aren't available. */
  visits: Visit[]
  errorLog: LoggedError[]
  /** Known vulnerabilities of the installed Next.js version. */
  security: SecurityState
  /** Page metadata as resolved in the document. Omit to hide the SEO segment. */
  seo?: SeoState
  /** Server Actions called since the page loaded, newest first. Omit to hide the segment. */
  actions?: ActionCall[]
  /** Result of the on-demand link check. Omit to hide the segment. */
  links?: LinksState
  /** The app's server route (@angelitolm/next-toolbar/server), if mounted. */
  server?: ServerState
}

export type ServerState = {
  /** 'unknown' until the actions panel is first opened. */
  status: 'unknown' | 'missing' | 'ready'
  actionNames: Record<string, ActionName>
}

export type LinksState = {
  status: 'idle' | 'checking' | 'done'
  /** Every internal link of the page, in document order; filled in as the check runs. */
  results: LinkResult[]
}

export type SeoState = {
  data: SeoData
  /** Status of a HEAD request to og:image; undefined when not checked (none, other origin, pending). */
  ogImageStatus?: number
}

export type SecurityState = {
  status: 'off' | 'loading' | 'ok' | 'error'
  advisories: Advisory[]
  checkedAt?: number
  /** One of the two sources failed: the list may be incomplete. */
  partial?: boolean
}

type ViewProps = {
  data: ToolbarData
  defaultTheme: Theme
  onClear: (keepId?: string) => void
  onRefreshSecurity?: () => void
  /** router.refresh(): re-renders the current route on the server. */
  onRefreshPage?: () => void
  onClearActions?: () => void
  /** Starts (or restarts) the link check. Omit to hide the button. */
  onCheckLinks?: () => void
  /** Asks the server route for action names (and whether it's mounted at all). */
  onProbeServer?: () => void
  /** Revalidates through the server route, then refreshes the page. Resolves to an error message, if any. */
  onRevalidate?: (request: RevalidateRequest) => Promise<string | undefined>
}

export function ToolbarView({ data, defaultTheme, onClear, onRefreshSecurity, onRefreshPage, onClearActions, onCheckLinks, onProbeServer, onRevalidate }: ViewProps) {
  const { pathname, params, timing, manifest, insights, connected, errors, nextVersion, basePath, visits, errorLog, security, seo, actions, links, server } = data
  const root = useShadowRoot()
  const [barRef, density] = useBarDensity()
  const [collapsed, setCollapsed] = useState(false)
  const [profiler, setProfiler] = useState<{ open: boolean; id?: string }>({ open: false })
  const closeProfiler = useCallback(() => setProfiler((p) => ({ ...p, open: false })), [])
  const [isNew, markSeen] = useNewSegments()

  const [theme, setTheme] = useState<Theme>(defaultTheme)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === '1')
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'system' || saved === 'light' || saved === 'dark') setTheme(saved)
    } catch {}
  }, [])

  // The stylesheet keys off the shadow host: no attribute means "follow the OS".
  useEffect(() => {
    if (theme === 'system') root?.host.removeAttribute('data-theme')
    else root?.host.setAttribute('data-theme', theme)
  }, [root, theme])

  const cycleTheme = () => {
    const value = nextTheme[theme]
    setTheme(value)
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {}
  }
  const toggle = (value: boolean) => {
    setCollapsed(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {}
  }

  if (!root) return null

  const status = timing?.status
  const insight = insightFor(insights.values(), pathname, basePath)
  const route = insight?.route ?? routePattern(pathname, params)
  const fetchStats = insight && fetchCacheStats(insight.fetches)
  const isNext16 = Number.parseInt(nextVersion ?? '', 10) >= 16
  const { mode, note: modeNote } = refineRenderMode(
    renderMode(status, manifest, pathname, !isNext16 && timing !== undefined),
    route,
    insight?.fetches,
  )
  const statusClass = status === undefined ? 'none' : status >= 400 ? 'err' : status >= 300 ? 'warn' : 'ok'
  const serverError = insight?.status === 'error'
  const errorCount = errors.length + (serverError ? 1 : 0)
  const insightsAvailable = insights.size > 0

  const ui = collapsed ? (
    <button
      className="launcher"
      onClick={() => toggle(false)}
      title={`NextToolbar · ${status ?? 'no status'}${errorCount ? ` · ${errorCount} errors` : ''}`}
      aria-label="Expand NextToolbar"
    >
      <Logo size={32} />
      {errorCount > 0 ? <span className="bubble">{errorCount}</span> : <span className={`dot ${statusClass}`} />}
    </button>
  ) : (
    <div ref={barRef} className={`bar ${density}`} role="toolbar" aria-label="NextToolbar">
      <button className="logo-btn" onClick={() => toggle(true)} title={`NextToolbar v${VERSION} · Minimize`} aria-label="Minimize NextToolbar">
        <Logo size={26} />
      </button>
      <span className="nt-version hide-sm" title="NextToolbar version">v{VERSION}</span>
      <div className="sep" />

      <Segment className={`status ${statusClass}`} label={status ?? '—'}>
        <Row k="Status">{status ?? 'unknown (browser does not expose responseStatus)'}</Row>
        <Row k="Loaded via">{timing?.via === 'rsc' ? 'client navigation (RSC)' : 'document request'}</Row>
      </Segment>

      <button
        className="seg token"
        onClick={() => setProfiler({ open: !profiler.open, id: insight?.requestId })}
        title="Open request profiler"
      >
        <Hashtag className="ico" />
        {insight ? insight.requestId.slice(0, 6) : 'profiler'}
      </button>

      <Segment label={<><Routing2 className="ico" /><span className="route">{route}</span></>}>
        <Row k="Route">{route}</Row>
        <Row k="Path"><code>{pathname}</code></Row>
        {Object.entries(params ?? {}).map(([k, v]) => (
          <Row key={k} k={`params.${k}`}><code>{JSON.stringify(v)}</code></Row>
        ))}
        {!insight && <div className="hint">Route rebuilt from params (heuristic).</div>}
      </Segment>

      <Segment label={<span className={`badge ${mode}`}>{modeLabel[mode]}</span>}>
        <Row k="Render">{modeLabel[mode]}</Row>
        {modeNote && <Row k="Why">{modeNote}</Row>}
        <div className="hint">
          {mode === 'unknown' && !connected && 'Not connected to the Next dev server. '}
          {mode === 'unknown' && connected && !manifest && 'No static info from Next (Cache Components enabled?). '}
          {mode === 'unknown' && status !== undefined && status >= 400 && 'Not shown for error responses. '}
          Dev only detects request APIs and <code>force-dynamic</code>; no-store fetches are added from request insights. SSG and ISR
          both show as Static. Run <code>next build</code> for the real output.
        </div>
      </Segment>

      <div className="sep" />

      <Segment
        className="metric"
        label={
          <>
            <Timer1 className="ico" />
            {insight?.durationMs !== undefined && <span><b>{ms(insight.durationMs)}</b> <span className="dim">server</span></span>}
            {timing && (
              <span className={insight?.durationMs !== undefined ? 'hide-md' : ''}>
                <b>{ms(timing.ms)}</b> <span className="dim">{timing.via === 'rsc' ? 'nav' : 'TTFB'}</span>
              </span>
            )}
            {!insight && !timing && <span className="dim">— ms</span>}
          </>
        }
      >
        {insight?.durationMs !== undefined && <Row k="Server render">{ms(insight.durationMs)}</Row>}
        {timing && <Row k={timing.via === 'rsc' ? 'RSC fetch' : 'Time to first byte'}>{ms(timing.ms)}</Row>}
        {!insightsAvailable && (
          <div className="hint">
            {supportsRequestInsights(nextVersion) ? (
              <>Enable <code>experimental.requestInsights</code> in next.config for server timing, fetches and exact routes.</>
            ) : (
              <>Server timing, fetches and exact routes need Next.js 16.3+ with <code>experimental.requestInsights</code> (this app runs {nextVersion ?? 'an unknown version'}).</>
            )}
          </div>
        )}
      </Segment>

      {insight && (
        <Segment
          label={
            <>
              <ArrangeHorizontal className="ico" />
              <span className="dim hide-md">fetch</span>
              <span className="count">{insight.fetches.length}</span>
              {fetchStats && fetchStats.hitRate !== undefined && (
                <span className="dim hide-md">{Math.round(fetchStats.hitRate * 100)}% hit</span>
              )}
            </>
          }
        >
          {insight.fetches.length === 0 && <div className="hint">No server fetches for this request.</div>}
          {fetchStats && fetchStats.total > 0 && (
            <div className="row">
              <span>Cache</span>
              <CacheSummary stats={fetchStats} />
            </div>
          )}
          {insight.fetches.map((f, i) => (
            <div key={i} className="fetch-row">
              <div>
                <span className="dim">{f.method ?? 'GET'} {f.statusCode ?? ''}</span>
                <CachePill f={f} />
                <span className="dim">{f.durationMs !== undefined && ms(f.durationMs)}</span>
              </div>
              <code>{f.url}</code>
            </div>
          ))}
        </Segment>
      )}

      <Segment
        label={<><Danger className={`ico ${errorCount ? 'ico-err' : ''}`} /><span className="dim hide-md">errors</span><span className={`count ${errorCount ? 'err' : ''}`}>{errorCount}</span></>}
      >
        {errorCount === 0 && <div className="hint">No errors on this page.</div>}
        {insight &&
          serverError &&
          (errorOrigins(insight).length ? errorOrigins(insight) : [{ name: 'request', error: 'ended with an error' }]).map((r, i) => (
            <button
              key={i}
              className="error-item"
              onClick={(e) => {
                e.currentTarget.blur() // otherwise :focus-within keeps the hover panel open over the profiler
                setProfiler({ open: true, id: insight.requestId })
              }}
              title="Open in profiler"
            >
              <span className="kind">server</span>
              <span className="msg">
                <b>{r.name}</b> <code>{r.error}</code>
              </span>
              <span className="go">
                Details <ArrowRight size={14} />
              </span>
            </button>
          ))}
        {errors.map((e, i) => (
          <details key={i} className="error-item">
            <summary>
              <ArrowRight2 className="chevron" size={14} />
              <span className="kind">client</span>
              <code className="msg">{e.message}</code>
            </summary>
            <pre>{e.stack ?? 'No stack trace available.'}</pre>
          </details>
        ))}
      </Segment>

      {actions && (
        <ActionsSegment
          calls={actions}
          pathname={pathname}
          server={server}
          onRefreshPage={onRefreshPage}
          onClear={onClearActions}
          onRevalidate={onRevalidate}
          isNew={isNew('actions')}
          onOpen={() => {
            markSeen('actions')
            onProbeServer?.()
          }}
        />
      )}
      {seo && <SeoSegment seo={seo} isNew={isNew('seo')} onOpen={() => markSeen('seo')} />}
      {links && <LinksSegment links={links} onCheck={onCheckLinks} isNew={isNew('links')} onOpen={() => markSeen('links')} />}

      {security.status !== 'off' && <SecuritySegment security={security} nextVersion={nextVersion} onRefresh={onRefreshSecurity} />}

      <div className="spacer" />
      <div className="sep hide-md" />

      <Segment className="right hide-md" label={<><Code className="ico" /><span className="dim">Next</span><b>{nextVersion ?? '?'}</b></>}>
        <Row k="NextToolbar">{VERSION}</Row>
        <Row k="Next.js">{nextVersion ?? 'unknown'}</Row>
        <Row k="React">{reactVersion}</Row>
        <Row k="Request insights">{insightsAvailable ? 'on' : 'off'}</Row>
        <Row k="HMR socket">{connected ? 'connected' : 'disconnected'}</Row>
      </Segment>
      <button className="icon-btn" onClick={cycleTheme} title={`Theme: ${theme}`} aria-label={`Theme: ${theme}. Switch theme`}>
        {themeIcons[theme]}
      </button>
      <button className="icon-btn" onClick={() => toggle(true)} title="Minimize" aria-label="Minimize NextToolbar">
        <CloseCircle size={18} />
      </button>
    </div>
  )

  const recent = [...insights.values()].sort((a, b) => b.startTime - a.startTime)

  return createPortal(
    <>
      <style>{css}</style>
      {profiler.open && !collapsed && (
        <Profiler
          insights={recent}
          selected={(profiler.id && insights.get(profiler.id)) || recent[0]}
          onSelect={(id) => setProfiler({ open: true, id })}
          onClose={closeProfiler}
          onClear={() => {
            onClear(insight?.requestId)
            setProfiler({ open: true, id: insight?.requestId })
          }}
          enabled={insightsAvailable}
          visits={visits}
          errorLog={errorLog}
          nextVersion={nextVersion}
        />
      )}
      {ui}
    </>,
    root,
  )
}

const modeLabel: Record<RenderMode, string> = {
  static: 'Static',
  'static-maybe': 'Static?',
  dynamic: 'Dynamic',
  pending: 'Rendering…',
  unknown: '?',
}

const ms = (n: number) => `${Math.round(n)} ms`

const themeIcons: Record<Theme, ReactNode> = {
  system: <Monitor size={18} />,
  light: <Sun1 size={18} />,
  dark: <Moon size={18} />,
}

const nextTheme: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

type SegmentProps = {
  label: ReactNode
  children: ReactNode
  className?: string
  /** Show the "new" badge. */
  isNew?: boolean
  /** Called when the panel opens (hover or focus). */
  onOpen?: () => void
}

function Segment({ label, children, className = '', isNew, onOpen }: SegmentProps) {
  return (
    <div className={`seg ${className} ${isNew ? 'is-new' : ''}`} tabIndex={0} onMouseEnter={onOpen} onFocus={onOpen}>
      {label}
      {isNew && <span className="new-badge">new</span>}
      <div className="panel">{children}</div>
    </div>
  )
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="row">
      <span>{k}</span>
      <span>{children}</span>
    </div>
  )
}

// Which NEW_SEGMENTS the user already opened, remembered per browser. Nothing counts as new
// until localStorage is read, so badges don't flash on reload.
function useNewSegments() {
  const [seen, setSeen] = useState<string[] | null>(null)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]')
      setSeen(Array.isArray(saved) ? saved : [])
    } catch {
      setSeen([])
    }
  }, [])
  const markSeen = useCallback((key: string) => {
    setSeen((s) => {
      if (!s || s.includes(key)) return s
      const next = [...s, key]
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])
  const isNew = (key: string) => seen !== null && NEW_SEGMENTS.includes(key) && !seen.includes(key)
  return [isNew, markSeen] as const
}

const DENSITIES = ['', 'compact', 'compact tight', 'compact tight scroll'] as const

// How much the bar hides so it fits on one line: labels first (.hide-md), then extras (.hide-sm),
// and as a last resort it scrolls sideways, as on phones.
// Depends on the segments shown, not just the viewport, so it measures instead of using breakpoints.
// Steps back up only once the bar is as wide as the content was at that level, so it doesn't flicker.
function useBarDensity() {
  const ref = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState(0)
  const widths = useRef<number[]>([])
  // Every render: new data can add or remove segments. Layout effect, so changes land before paint.
  useLayoutEffect(() => {
    const bar = ref.current
    if (!bar) return
    const check = () => {
      widths.current[level] = bar.scrollWidth
      if (bar.scrollWidth > bar.clientWidth + 1 && level < DENSITIES.length - 1) setLevel(level + 1)
      else if (level > 0 && bar.clientWidth >= (widths.current[level - 1] ?? Infinity)) setLevel(level - 1)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(bar)
    return () => observer.disconnect()
  })
  return [ref, DENSITIES[level]] as const
}

// Isolates toolbar CSS from the app (and vice versa).
function useShadowRoot() {
  const [root, setRoot] = useState<ShadowRoot | null>(null)
  useEffect(() => {
    const host = document.createElement('next-toolbar')
    document.body.appendChild(host)
    setRoot(host.attachShadow({ mode: 'open' }))
    return () => host.remove()
  }, [])
  return root
}

// Status + timing per pathname: document load from Navigation Timing,
// client navigations from the RSC fetch in Resource Timing.
// ponytail: a prefetched RSC payload reports the prefetch's timing; fine for dev.
function useTimings() {
  const [timings, setTimings] = useState<Record<string, Timing>>({})
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav) {
      setTimings((t) => ({
        ...t,
        [stripBasePath(location.pathname, BASE_PATH)]: { status: nav.responseStatus || undefined, ms: nav.responseStart, via: 'document' },
      }))
    }
    const observer = new PerformanceObserver((list) => {
      const updates: Record<string, Timing> = {}
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        const url = new URL(entry.name)
        if (url.origin !== location.origin || !url.searchParams.has('_rsc')) continue
        updates[stripBasePath(url.pathname, BASE_PATH)] = { status: entry.responseStatus || undefined, ms: entry.duration, via: 'rsc' }
      }
      if (Object.keys(updates).length) setTimings((t) => ({ ...t, ...updates }))
    })
    observer.observe({ type: 'resource' })
    return () => observer.disconnect()
  }, [])
  return timings
}

// Second socket to Next's dev HMR server: render-mode manifest (Next 15+) and
// request insights (Next 16.3+ with experimental.requestInsights). Internal API.
function useHmr() {
  const [manifest, setManifest] = useState<Record<string, boolean> | null>(null)
  const [connected, setConnected] = useState(false)
  const insightsRef = useRef(new Map<string, Insight>())
  const clearedAtRef = useRef(0)
  const [, bump] = useState(0)

  // Drops captured requests, keeping `keepId` (the current page's) so the bar keeps its data.
  const clear = useCallback((keepId?: string) => {
    for (const id of insightsRef.current.keys()) if (id !== keepId) insightsRef.current.delete(id)
    clearedAtRef.current = Date.now()
    bump((n) => n + 1)
  }, [])

  useEffect(() => {
    // Like Next's client: current host, path under assetPrefix/basePath (even for a CDN assetPrefix).
    const prefix = assetPrefixFrom([...document.scripts].map((s) => s.src))
    const origin = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${prefix}`
    let path = hmrPath(window.next?.version)
    let ws: WebSocket
    let retry: ReturnType<typeof setTimeout>
    let disposed = false

    const connect = () => {
      let opened = false
      ws = new WebSocket(origin + path)
      ws.onopen = () => {
        opened = true
        setConnected(true)
      }
      ws.onclose = () => {
        setConnected(false)
        // Never opened: probably the wrong endpoint for this Next version, try the other one.
        if (!opened) path = alternateHmrPath(path)
        if (!disposed) retry = setTimeout(connect, 2000) // dev server restarts
      }
      ws.onmessage = (e) => {
        const event = parseHmr(e.data)
        if (!event) return
        if (event.kind === 'manifest') return setManifest(event.data)
        const map = insightsRef.current
        for (const insight of event.list) {
          // Next re-sends its whole snapshot on every `sync` (reconnects, rebuilds): don't
          // resurrect what was cleared. Updates to kept requests still apply.
          // ponytail: compares server and browser clocks; fine for a local dev server.
          if (insight.startTime < clearedAtRef.current && !map.has(insight.requestId)) continue
          map.delete(insight.requestId) // re-insert to keep Map order = recency
          map.set(insight.requestId, insight)
        }
        while (map.size > MAX_INSIGHTS) map.delete(map.keys().next().value!)
        bump((n) => n + 1)
      }
    }
    connect()
    return () => {
      disposed = true
      clearTimeout(retry)
      ws.close()
    }
  }, [])

  return { manifest, insights: insightsRef.current, connected, clear }
}

export type ClientError = { message: string; stack?: string }

// `errors` belongs to the current page (reset on navigation); `log` keeps the whole session
// for the browser-side profiler, timestamped so errors can be matched to visits.
function useClientErrors(pathname: string) {
  const [errors, setErrors] = useState<ClientError[]>([])
  const [log, setLog] = useState<LoggedError[]>([])
  useEffect(() => setErrors([]), [pathname])
  useEffect(() => {
    const push = (error: ClientError) => {
      setErrors((e) => [...e.slice(-19), error])
      setLog((l) => [...l.slice(-99), { ...error, at: Date.now() }])
    }
    const onError = (e: ErrorEvent) => push({ message: e.message || String(e.error), stack: e.error?.stack })
    const onRejection = (e: PromiseRejectionEvent) =>
      push({ message: `Unhandled rejection: ${e.reason?.message ?? String(e.reason)}`, stack: e.reason?.stack })
    addEventListener('error', onError)
    addEventListener('unhandledrejection', onRejection)
    return () => {
      removeEventListener('error', onError)
      removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return { errors, setErrors, log, setLog }
}

// One visit per route change (prefetches never change the route, so they're not visits).
// The timing arrives from the Performance API around the same time and is copied onto the
// latest visit once it does.
function useVisits(pathname: string, route: string, timing: Timing | undefined) {
  const [visits, setVisits] = useState<Visit[]>([])
  const seq = useRef(0)
  useEffect(() => {
    setVisits((v) =>
      // Same page as the last visit: React Strict Mode re-running the effect, not a navigation.
      v[v.length - 1]?.pathname === pathname
        ? v
        : [...v.slice(-(MAX_INSIGHTS - 1)), { id: `v${++seq.current}`, pathname, route, startTime: Date.now() }],
    )
  }, [pathname, route])
  useEffect(() => {
    if (!timing) return
    setVisits((v) => {
      const last = v[v.length - 1]
      if (!last || last.pathname !== pathname) return v
      if (last.ms === timing.ms && last.status === timing.status) return v
      return [...v.slice(0, -1), { ...last, status: timing.status, ms: timing.ms, via: timing.via }]
    })
  }, [pathname, timing])
  return [visits, setVisits] as const
}

const ADVISORIES_GLOBAL = (version: string) =>
  `https://api.github.com/advisories?ecosystem=npm&affects=${encodeURIComponent(`next@${version}`)}&per_page=100`
const ADVISORIES_REPO = 'https://api.github.com/repos/vercel/next.js/security-advisories?state=published&per_page=100&sort=published&direction=desc'
const SECURITY_KEY = 'next-toolbar:security'
const SECURITY_TTL = 6 * 60 * 60 * 1000 // GitHub allows 60 unauthenticated requests per hour per IP

// Known vulnerabilities of the installed Next.js: GitHub's reviewed database (GitHub matches the
// version) plus Next.js' own recent advisories, which appear days before they're reviewed.
function useSecurity(version: string | undefined, enabled: boolean) {
  const [state, setState] = useState<SecurityState>({ status: enabled ? 'loading' : 'off', advisories: [] })
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    if (!enabled || !version) return
    if (refresh === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(SECURITY_KEY) ?? 'null')
        if (cached?.version === version && Date.now() - cached.at < SECURITY_TTL) {
          setState({ status: 'ok', advisories: cached.advisories, checkedAt: cached.at })
          return
        }
      } catch {}
    }
    let cancelled = false
    setState((s) => ({ ...s, status: 'loading' }))
    const get = (url: string) =>
      fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    Promise.allSettled([get(ADVISORIES_GLOBAL(version)), get(ADVISORIES_REPO)]).then(([global, repo]) => {
      if (cancelled) return
      if (global.status === 'rejected' && repo.status === 'rejected') return setState({ status: 'error', advisories: [] })
      const advisories = mergeAdvisories(
        global.status === 'fulfilled' ? fromGlobalAdvisories(global.value, version) : [],
        repo.status === 'fulfilled' ? fromRepoAdvisories(repo.value, version, Date.now()) : [],
      )
      const partial = global.status === 'rejected' || repo.status === 'rejected'
      const at = Date.now()
      setState({ status: 'ok', advisories, checkedAt: at, partial })
      if (!partial)
        try {
          localStorage.setItem(SECURITY_KEY, JSON.stringify({ version, at, advisories }))
        } catch {}
    })
    return () => {
      cancelled = true
    }
  }, [version, enabled, refresh])

  return [state, () => setRefresh((n) => n + 1)] as const
}

function SecuritySegment({ security, nextVersion, onRefresh }: { security: SecurityState; nextVersion?: string; onRefresh?: () => void }) {
  const { status, advisories, checkedAt, partial } = security
  const serious = advisories.some((a) => a.severity === 'critical' || a.severity === 'high')
  const tone = advisories.length ? (serious ? 'err' : 'warn') : 'ok'
  const target = upgradeTarget(advisories)

  const label =
    status === 'ok' && advisories.length ? (
      <>
        <ShieldCross className={`ico ico-${tone}`} />
        <span className={`count ${tone}`}>{advisories.length}</span>
        <span className="dim hide-md">vulns</span>
      </>
    ) : status === 'ok' ? (
      <>
        <ShieldTick className="ico ico-ok" />
        <span className="dim hide-md">secure</span>
      </>
    ) : (
      <>
        <ShieldSearch className="ico" />
        <span className="dim hide-md">{status === 'loading' ? 'checking' : 'security ?'}</span>
      </>
    )

  return (
    <Segment className="security" label={label}>
      <div className="sec-head">
        <b>Next.js {nextVersion ?? '?'}</b>
        <span className="dim">
          {status === 'loading'
            ? 'Checking GitHub security advisories…'
            : status === 'error'
              ? "Couldn't reach GitHub (offline or rate-limited)."
              : advisories.length
                ? `${advisories.length} known ${advisories.length === 1 ? 'vulnerability' : 'vulnerabilities'}`
                : 'No known vulnerabilities'}
        </span>
      </div>
      {target && (
        <div className={`upgrade ${tone}`}>
          <span>
            Upgrade to <b>{target}</b> to fix {advisories.length === 1 ? 'it' : 'all of them'}
          </span>
          <code>npm i next@{target}</code>
        </div>
      )}
      {advisories.map((a) => (
        <a key={a.id} className="adv-row" href={a.url} target="_blank" rel="noreferrer">
          <span className={`sev ${a.severity}`}>{a.severity}</span>
          <span className="adv-main">
            <span className="adv-title">{a.summary.replace(/^Next\.js:\s*/, '')}</span>
            <span className="dim">
              {a.cve ?? a.id}
              {a.patched && ` · fixed in ${a.patched}`}
              {!a.reviewed && ' · not yet reviewed by GitHub'}
            </span>
          </span>
          <ExportSquare size={14} className="ico" />
        </a>
      ))}
      <div className="sec-foot">
        <span className="dim">
          GitHub Security Advisories{checkedAt ? ` · checked ${new Date(checkedAt).toLocaleTimeString()}` : ''}
          {partial && ' · one source failed, list may be incomplete'}
        </span>
        {onRefresh && status !== 'loading' && (
          <button className="text-btn" onClick={onRefresh} title="Check again now">
            <Refresh2 size={14} />
            Refresh
          </button>
        )}
      </div>
    </Segment>
  )
}

const readMeta = (selector: string) => document.head.querySelector<HTMLMetaElement>(selector)?.content || undefined

function readSeo(): SeoData {
  return {
    title: document.title || undefined,
    description: readMeta('meta[name="description"]'),
    canonical: document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href,
    robots: readMeta('meta[name="robots"]'),
    ogImage: readMeta('meta[property="og:image"]'),
    // Next's docs render JSON-LD in the page body, so search the whole document.
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ''),
  }
}

// Metadata as the browser sees it. Watches <head> because Next 15.2+ streams metadata in
// after the page, and React hoists it there. ponytail: JSON-LD changes in the body are
// only picked up on navigation or a head change.
function useSeo(pathname: string): SeoState | undefined {
  const [data, setData] = useState<SeoData>()
  const [ogImageStatus, setOgImageStatus] = useState<number>()

  useEffect(() => {
    const read = () => {
      const next = readSeo()
      setData((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.head, { childList: true, subtree: true, attributes: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname])

  const ogImage = data?.ogImage
  useEffect(() => {
    setOgImageStatus(undefined)
    if (!ogImage) return
    let url: URL
    try {
      url = new URL(ogImage, location.href)
    } catch {
      return
    }
    // ponytail: other origins need CORS to read the status; those are left unchecked.
    if (url.origin !== location.origin) return
    let cancelled = false
    fetch(url, { method: 'HEAD' })
      .then((r) => !cancelled && setOgImageStatus(r.status))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ogImage])

  return data && { data, ogImageStatus }
}

function SeoSegment({ seo: { data, ogImageStatus }, isNew, onOpen }: { seo: SeoState; isNew?: boolean; onOpen?: () => void }) {
  const issues = seoIssues(data, ogImageStatus)
  const problems = issues.filter((i) => i.level !== 'ok').length
  const tone = issues.some((i) => i.level === 'err') ? 'err' : problems ? 'warn' : ''
  const ld = jsonLdSummary(data.jsonLd)
  const unset = <span className="dim">not set</span>

  return (
    <Segment className="seo" isNew={isNew} onOpen={onOpen} label={<><SearchNormal1 className={`ico ${tone ? `ico-${tone}` : ''}`} /><span className="dim hide-md">SEO</span><span className={`count ${tone}`}>{problems}</span></>}>
      <div className="sec-head">
        <b>Page metadata</b>
        <span className="dim">Read from the document after each navigation.</span>
      </div>
      <Row k="title">{data.title ? <>{data.title} <span className="dim">({[...data.title].length} chars)</span></> : unset}</Row>
      <Row k="description">{data.description ?? unset}</Row>
      <Row k="canonical">{data.canonical ? <code>{data.canonical}</code> : unset}</Row>
      <Row k="og:image">
        {data.ogImage ? <><code>{data.ogImage}</code>{ogImageStatus !== undefined && <span className="dim"> · {ogImageStatus}</span>}</> : unset}
      </Row>
      <Row k="robots">{data.robots ?? <span className="dim">not set (index, follow)</span>}</Row>
      <Row k="JSON-LD">
        {data.jsonLd.length ? `${data.jsonLd.length} block${data.jsonLd.length > 1 ? 's' : ''}${ld.types.length ? ` · ${ld.types.join(', ')}` : ''}` : unset}
      </Row>
      {issues.length > 0 && <div className="sep-h" />}
      {issues.map((issue, i) => (
        <div key={i} className="issue">
          <span className={`issue-dot ${issue.level}`} />
          <span>{issue.message}</span>
        </div>
      ))}
    </Segment>
  )
}

const MAX_ACTIONS = 50

// Server Actions are POSTs that carry a `next-action` header, sent with the global fetch
// (next/dist/client/components/router-reducer/reducers/server-action-reducer.js).
// Wrapping window.fetch sees each call without touching Next. The response is returned
// untouched: only its headers are read.
function useServerActions() {
  const [calls, setCalls] = useState<ActionCall[]>([])
  useEffect(() => {
    const original = window.fetch
    let seq = 0
    const wrapped: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
      const actionId = headers.get('next-action')
      if (!actionId) return original(input, init)

      const id = `a${++seq}`
      const t0 = performance.now()
      const update = (patch: Partial<ActionCall>) => setCalls((c) => c.map((call) => (call.id === id ? { ...call, ...patch } : call)))
      setCalls((c) => [{ id, actionId, page: stripBasePath(location.pathname, BASE_PATH), startTime: Date.now() }, ...c].slice(0, MAX_ACTIONS))
      try {
        const res = await original(input, init)
        update({
          durationMs: performance.now() - t0,
          status: res.status,
          revalidation: parseActionRevalidated(res.headers.get('x-action-revalidated')),
          redirect: parseActionRedirect(res.headers.get('x-action-redirect')),
        })
        return res
      } catch (e) {
        update({ durationMs: performance.now() - t0, error: e instanceof Error ? e.message : String(e) })
        throw e
      }
    }
    window.fetch = wrapped
    return () => {
      // Someone else may have wrapped fetch after us; leave theirs in place.
      if (window.fetch === wrapped) window.fetch = original
    }
  }, [])
  return [calls, setCalls] as const
}

const revalidationLabel = { none: '—', all: 'static + dynamic', dynamic: 'dynamic only' } as const

function ActionsSegment({
  calls,
  pathname,
  server,
  onRefreshPage,
  onClear,
  onRevalidate,
  isNew,
  onOpen,
}: {
  calls: ActionCall[]
  pathname: string
  server?: ServerState
  onRefreshPage?: () => void
  onClear?: () => void
  onRevalidate?: (request: RevalidateRequest) => Promise<string | undefined>
  isNew?: boolean
  onOpen?: () => void
}) {
  const failed = calls.some(actionFailed)
  const [tag, setTag] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const run = async (request: RevalidateRequest, label: string) => {
    if (!onRevalidate) return
    setBusy(true)
    const error = await onRevalidate(request)
    setBusy(false)
    setMessage(error ? { ok: false, text: error } : { ok: true, text: `Revalidated ${label} and refreshed the page.` })
  }
  return (
    <Segment
      className="actions"
      isNew={isNew}
      onOpen={onOpen}
      label={<><Flash className={`ico ${failed ? 'ico-err' : ''}`} /><span className="dim hide-md">actions</span><span className={`count ${failed ? 'err' : ''}`}>{calls.length}</span></>}
    >
      <div className="act-head">
        <div className="sec-head">
          <b>Server Actions</b>
          <span className="dim">Calls since the page loaded, newest first.</span>
        </div>
        {onRefreshPage && (
          <button className="text-btn" onClick={onRefreshPage} title="router.refresh(): render this route again on the server">
            <Refresh2 size={14} />
            Refresh page
          </button>
        )}
        {onClear && calls.length > 0 && (
          <button className="text-btn" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {calls.length === 0 && <div className="hint">No calls yet. Server Actions called from the page show up here.</div>}
      {calls.length > 0 && (
        <div className="act-row act-cols dim">
          <span>Action</span>
          <span>Status</span>
          <span>Time</span>
          <span>Revalidated</span>
        </div>
      )}
      {calls.map((call) => {
        const known = server?.actionNames[call.actionId]
        return (
          <div key={call.id} className="act-row" title={`Action id ${call.actionId}\nCalled from ${call.page}${known?.file ? `\nDefined in ${known.file}` : ''}`}>
            <span className="act-id">
              <code>{known?.name ?? `${call.actionId.slice(0, 10)}…`}</code>
              <span className="dim">{call.page}</span>
            </span>
            <span>
              {call.durationMs === undefined ? (
                <span className="dim">…</span>
              ) : (
                <span className={`pill ${actionFailed(call) ? 'err' : 'ok'}`}>{call.error ? 'failed' : call.status}</span>
              )}
            </span>
            <span className="dim">{call.durationMs !== undefined && ms(call.durationMs)}</span>
            <span>
              {call.revalidation ? revalidationLabel[call.revalidation] : call.durationMs === undefined ? '' : '?'}
              {call.redirect && <span className="dim"> → {call.redirect}</span>}
              {call.error && <span className="dim"> {call.error}</span>}
            </span>
          </div>
        )
      })}
      <div className="sep-h" />
      {server?.status === 'missing' ? (
        <div className="hint">
          To revalidate from here and see action names instead of ids, add <code>app{SERVER_ROUTE}/route.ts</code> with{' '}
          <code>export {'{ GET, POST }'} from '@angelitolm/next-toolbar/server'</code> and reload.
        </div>
      ) : (
        <div className="reval">
          <span className="dim">Revalidate</span>
          <button className="text-btn" disabled={busy || !onRevalidate} onClick={() => run({ kind: 'path', path: pathname }, pathname)} title={`revalidatePath('${pathname}')`}>
            This page
          </button>
          <button className="text-btn" disabled={busy || !onRevalidate} onClick={() => run({ kind: 'path', path: '/', type: 'layout' }, 'every path')} title="revalidatePath('/', 'layout')">
            Everything
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (tag.trim()) run({ kind: 'tag', tag: tag.trim() }, `tag "${tag.trim()}"`)
            }}
          >
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="tag" aria-label="Tag to revalidate" />
            <button className="text-btn" disabled={busy || !onRevalidate || !tag.trim()} title="revalidateTag(tag, { expire: 0 })">
              Tag
            </button>
          </form>
        </div>
      )}
      {message && <div className={`hint ${message.ok ? '' : 'hint-err'}`}>{message.text}</div>}
    </Segment>
  )
}

// The app's server route: action names and revalidation. Probed when the actions panel opens,
// not on load, so apps without it don't get a 404 in the console on every page.
function useToolbarServer(refresh: () => void) {
  const [state, setState] = useState<ServerState>({ status: 'unknown', actionNames: {} })
  const missing = useRef(false)
  const url = BASE_PATH + SERVER_ROUTE

  const probe = useCallback(() => {
    if (missing.current) return // mounting it needs a reload anyway
    fetch(url, { headers: { [SERVER_HEADER]: '1' }, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json) => setState({ status: 'ready', actionNames: json?.actions ?? {} }))
      .catch(() => {
        missing.current = true
        setState((s) => ({ ...s, status: 'missing' }))
      })
  }, [url])

  const revalidate = useCallback(
    async (request: RevalidateRequest) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { [SERVER_HEADER]: '1', 'content-type': 'application/json' },
          body: JSON.stringify(request),
        })
        if (!res.ok) return (await res.json().catch(() => null))?.error ?? `The server route answered ${res.status}.`
        refresh()
        return undefined
      } catch (e) {
        return e instanceof Error ? e.message : String(e)
      }
    },
    [url, refresh],
  )

  return [state, probe, revalidate] as const
}

const LINK_CONCURRENCY = 3
const BROKEN_OUTLINE = '2px solid #ef4444'

// Checks this page's internal links on demand. Not automatic: `next dev` compiles each route
// on its first request, and firing them all at once would stall the dev server.
// Broken anchors get an outline on the page until the next check or navigation.
function useLinkCheck(pathname: string) {
  const [state, setState] = useState<LinksState>({ status: 'idle', results: [] })
  const run = useRef<AbortController | null>(null)
  const marked = useRef<{ el: HTMLAnchorElement; outline: string; offset: string }[]>([])

  const reset = useCallback(() => {
    run.current?.abort()
    for (const m of marked.current) {
      m.el.style.outline = m.outline
      m.el.style.outlineOffset = m.offset
    }
    marked.current = []
  }, [])

  useEffect(() => reset, [reset])
  useEffect(() => {
    reset()
    setState({ status: 'idle', results: [] })
  }, [pathname, reset])

  const check = useCallback(async () => {
    reset()
    const controller = new AbortController()
    run.current = controller
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
    const results: LinkResult[] = internalLinks(
      anchors.map((a) => a.href),
      location.origin,
    ).map((url) => {
      const u = new URL(url)
      return { url, path: stripBasePath(u.pathname, BASE_PATH) + u.search }
    })
    setState({ status: 'checking', results })

    await mapLimit(results, LINK_CONCURRENCY, async (link, i) => {
      if (controller.signal.aborted) return
      const outcome = await checkLink(link.url, controller.signal)
      if (controller.signal.aborted) return
      results[i] = { ...link, ...outcome }
      setState({ status: 'checking', results: [...results] })
    })
    if (controller.signal.aborted) return
    setState({ status: 'done', results: [...results] })

    const broken = new Set(results.filter(linkBroken).map((r) => r.url))
    for (const a of anchors) {
      if (!broken.has(linkKey(a.href) ?? '')) continue
      marked.current.push({ el: a, outline: a.style.outline, offset: a.style.outlineOffset })
      a.style.outline = BROKEN_OUTLINE
      a.style.outlineOffset = '2px'
    }
  }, [reset])

  return [state, check] as const
}

// HEAD, or GET when the route only answers GET (a route handler without HEAD).
// ponytail: redirects aren't followed. A redirect to another origin can't be read without
// CORS and would show up as a false "failed"; the row says "redirect" instead.
async function checkLink(url: string, signal: AbortSignal): Promise<Partial<LinkResult>> {
  try {
    const get = (method: string) => fetch(url, { method, signal, redirect: 'manual', cache: 'no-store' })
    let res = await get('HEAD')
    if (res.status === 405) res = await get('GET')
    if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return { redirect: true }
    return { status: res.status }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

function LinksSegment({ links: { status, results }, onCheck, isNew, onOpen }: { links: LinksState; onCheck?: () => void; isNew?: boolean; onOpen?: () => void }) {
  const broken = results.filter(linkBroken)
  const pending = results.filter(linkPending).length
  const shown = status === 'done' ? [...broken, ...results.filter((r) => !linkBroken(r))] : results
  const count = status === 'idle' ? '–' : status === 'checking' ? `${results.length - pending}/${results.length}` : broken.length

  return (
    <Segment
      className="links"
      isNew={isNew}
      onOpen={onOpen}
      label={<><Link21 className={`ico ${broken.length ? 'ico-err' : ''}`} /><span className="dim hide-md">links</span><span className={`count ${broken.length ? 'err' : ''}`}>{count}</span></>}
    >
      <div className="act-head">
        <div className="sec-head">
          <b>Internal links</b>
          <span className="dim">
            {status === 'done'
              ? `${results.length} checked · ${broken.length} broken`
              : `Checks this page's links on demand, ${LINK_CONCURRENCY} at a time.`}
          </span>
        </div>
        {onCheck && (
          <button className="text-btn" onClick={onCheck} disabled={status === 'checking'}>
            <Refresh2 size={14} />
            {status === 'checking' ? 'Checking…' : status === 'done' ? 'Check again' : 'Check links'}
          </button>
        )}
      </div>
      {status === 'idle' && <div className="hint">Broken links get a red outline on the page.</div>}
      {status !== 'idle' && results.length === 0 && <div className="hint">No internal links on this page.</div>}
      {shown.map((r) => (
        <div key={r.url} className="link-row">
          {linkPending(r) ? (
            <span className="pill none">…</span>
          ) : (
            <span className={`pill ${linkBroken(r) ? 'err' : r.redirect ? 'none' : 'ok'}`}>{r.error ? 'failed' : r.redirect ? '3xx' : r.status}</span>
          )}
          <code title={r.error ?? r.url}>{r.path}</code>
        </div>
      ))}
      <div className="hint">
        On demand because <code>next dev</code> compiles each route on its first request; checking every link at once would stall it.
        Redirects aren't followed.
      </div>
    </Segment>
  )
}
