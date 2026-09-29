import { useEffect, useMemo, useState } from 'react'
import { indexFetchCache, type ActionCall, type ActionName, type Advisory, type CachedFetch, type Insight, type LinkResult, type RevalidateRequest, type SeoData } from './core'
import { ToolbarView, type ClientError, type Theme } from './NextToolbar'

export type NextToolbarDemoProps = {
  /** Path of the simulated page, e.g. `/blog/hello`. */
  pathname: string
  params?: Record<string, string | string[]>
  /** HTTP status of the page. */
  status?: number
  /** TTFB of a document load, or duration of the RSC request of a client navigation. */
  timingMs?: number
  via?: 'document' | 'rsc'
  /** What Next's dev server reports for the path: true static, false dynamic, undefined still rendering. */
  isStatic?: boolean
  /** Simulated request insights. The one whose `url` matches `pathname` drives the bar; all of them fill the profiler. */
  insights?: Insight[]
  clientErrors?: ClientError[]
  nextVersion?: string
  theme?: Theme
  /** Known vulnerabilities to show for `nextVersion`. Omit to hide the security segment (the demo never fetches). */
  advisories?: Advisory[]
  /** Page metadata for the SEO segment. Omit to hide it. */
  seo?: SeoData
  /** Status of the og:image, as the live toolbar gets it from a HEAD request. */
  ogImageStatus?: number
  /** Server Actions called from the page, newest first. Omit to hide the segment. */
  actions?: ActionCall[]
  /** A finished link check of the page. Omit to hide the segment. */
  links?: LinkResult[]
  /** Server Action names, as the server route reports them. Also enables the (simulated) revalidate buttons. */
  actionNames?: Record<string, ActionName>
  /** Data cache entries for the insights' fetches: shows their tags and freshness. Also enables the revalidate buttons. */
  fetchCache?: CachedFetch[]
  /** Called when a (simulated) revalidation finishes, so the page can update its data to match. */
  onRevalidate?: (request: RevalidateRequest) => void
}

const NONE: never[] = []

/**
 * The real toolbar UI rendered from fixture data, in any environment (production included).
 * Meant for documentation, demos and screenshots; apps should render `NextToolbar`.
 */
export function NextToolbarDemo({
  pathname,
  params,
  status,
  timingMs,
  via = 'document',
  isStatic,
  insights = NONE,
  clientErrors = NONE,
  nextVersion = '16.3.6',
  theme = 'system',
  advisories,
  seo,
  ogImageStatus,
  actions,
  links,
  actionNames,
  fetchCache,
  onRevalidate,
}: NextToolbarDemoProps) {
  const hasServer = actionNames !== undefined || fetchCache !== undefined
  // Clear works like the live toolbar: drop everything but the current page's request, and client errors.
  const [cleared, setCleared] = useState<{ keep?: string } | null>(null)
  const [actionsCleared, setActionsCleared] = useState(false)
  useEffect(() => setCleared(null), [insights, clientErrors])
  useEffect(() => setActionsCleared(false), [actions])

  const map = useMemo(
    () => new Map(insights.filter((i) => !cleared || i.requestId === cleared.keep).map((i) => [i.requestId, i])),
    [insights, cleared],
  )
  const hasTiming = status !== undefined || timingMs !== undefined

  return (
    <ToolbarView
      defaultTheme={theme}
      data={{
        pathname,
        params: params ?? {},
        timing: hasTiming ? { status, ms: timingMs ?? 0, via } : undefined,
        manifest: isStatic === undefined ? {} : { [pathname]: isStatic },
        insights: map,
        connected: true,
        errors: cleared ? NONE : clientErrors,
        nextVersion,
        basePath: '',
        visits: NONE,
        errorLog: NONE,
        seo: seo && { data: seo, ogImageStatus },
        actions: actions && (actionsCleared ? NONE : actions),
        links: links && { status: 'done', results: links },
        server: hasServer ? { status: 'ready', actionNames: actionNames ?? {}, fetchCache: fetchCache && indexFetchCache(fetchCache) } : undefined,
        security: advisories ? { status: 'ok', advisories, checkedAt: Date.now() } : { status: 'off', advisories: NONE },
      }}
      onClear={(keep) => setCleared({ keep })}
      onClearActions={() => setActionsCleared(true)}
      onRevalidate={
        hasServer
          ? (request) =>
              new Promise((resolve) =>
                setTimeout(() => {
                  onRevalidate?.(request)
                  resolve(undefined)
                }, 300),
              )
          : undefined
      }
    />
  )
}
