import { useCallback, useEffect, useRef, useState, version as reactVersion, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useParams, usePathname } from 'next/navigation'
import { alternateHmrPath, assetPrefixFrom, errorOrigins, supportsRequestInsights, fetchCacheStats, refineRenderMode, type RenderMode, hmrPath, insightFor, parseHmr, renderMode, routePattern, stripBasePath, type Insight } from './core'
import { ArrangeHorizontal, ArrowRight, ArrowRight2, CloseCircle, Code, Danger, Hashtag, Monitor, Moon, Routing2, Sun1, Timer1 } from './icons'
import { Logo } from './Logo'
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

export type Theme = 'system' | 'light' | 'dark'

export type NextToolbarProps = {
  /** Initial theme. The toolbar's theme button overrides it and remembers the choice per browser. */
  theme?: Theme
}
const MAX_INSIGHTS = 100
// Inlined by Next's bundler (define-env) for every module, packages included.
const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH || ''

export function NextToolbar({ theme = 'system' }: NextToolbarProps = {}) {
  // Dead code in production builds: the bundler inlines NODE_ENV.
  if (process.env.NODE_ENV !== 'development') return null
  return <Toolbar defaultTheme={theme} />
}

function Toolbar({ defaultTheme }: { defaultTheme: Theme }) {
  const pathname = usePathname()
  const params = useParams()
  const timings = useTimings()
  const { manifest, insights, connected, clear } = useHmr()
  const [errors, setErrors] = useClientErrors(pathname)
  const nextVersion = typeof window !== 'undefined' ? window.next?.version : undefined

  return (
    <ToolbarView
      defaultTheme={defaultTheme}
      data={{ pathname, params, timing: timings[pathname], manifest, insights, connected, errors, nextVersion, basePath: BASE_PATH }}
      onClear={(keepId) => {
        clear(keepId)
        setErrors([])
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
}

type ViewProps = { data: ToolbarData; defaultTheme: Theme; onClear: (keepId?: string) => void }

export function ToolbarView({ data, defaultTheme, onClear }: ViewProps) {
  const { pathname, params, timing, manifest, insights, connected, errors, nextVersion, basePath } = data
  const root = useShadowRoot()
  const [collapsed, setCollapsed] = useState(false)
  const [profiler, setProfiler] = useState<{ open: boolean; id?: string }>({ open: false })
  const closeProfiler = useCallback(() => setProfiler((p) => ({ ...p, open: false })), [])

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
    <div className="bar" role="toolbar" aria-label="NextToolbar">
      <button className="logo-btn" onClick={() => toggle(true)} title="Minimize" aria-label="Minimize NextToolbar">
        <Logo size={26} />
      </button>
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

      <div className="spacer" />
      <div className="sep hide-md" />

      <Segment className="right hide-md" label={<><Code className="ico" /><span className="dim">Next</span><b>{nextVersion ?? '?'}</b></>}>
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

function Segment({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`seg ${className}`} tabIndex={0}>
      {label}
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

function useClientErrors(pathname: string) {
  const [errors, setErrors] = useState<ClientError[]>([])
  useEffect(() => setErrors([]), [pathname])
  useEffect(() => {
    const push = (error: ClientError) => setErrors((e) => [...e.slice(-19), error])
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
  return [errors, setErrors] as const
}
