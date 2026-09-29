import { useEffect, useMemo, useState } from 'react'
import type { Advisory, Insight, SeoData } from './core'
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
}: NextToolbarDemoProps) {
  // Clear works like the live toolbar: drop everything but the current page's request, and client errors.
  const [cleared, setCleared] = useState<{ keep?: string } | null>(null)
  useEffect(() => setCleared(null), [insights, clientErrors])

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
        security: advisories ? { status: 'ok', advisories, checkedAt: Date.now() } : { status: 'off', advisories: NONE },
      }}
      onClear={(keep) => setCleared({ keep })}
    />
  )
}
