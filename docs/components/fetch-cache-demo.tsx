'use client'
import { NextToolbarDemo, type CachedFetch, type Insight, type RevalidateRequest } from '@angelitolm/next-toolbar'
import { useLocale } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

const API = 'https://api.example.com'

type Row = CachedFetch & { name: string; cacheStatus: 'hit' | 'miss'; flash?: boolean }

// Seconds before mount each entry was stored: products is fresh, categories is about to go stale,
// settings is force-cache (no tag, never expires) so revalidating a tag never touches it.
const SEED: { name: string; tags: string[]; revalidate?: number; ago: number }[] = [
  { name: 'products', tags: ['products'], revalidate: 60, ago: 20 },
  { name: 'categories', tags: ['categories'], revalidate: 300, ago: 290 },
  { name: 'settings', tags: [], ago: 3_600 },
]

const COPY = {
  en: {
    hint: 'Hover fetch in the toolbar below and click a tag. Only the fetches carrying it are fetched again.',
    fetch: 'Fetch',
    tags: 'Tags',
    fetchedAt: 'Fetched at',
    state: 'Cache',
    none: 'none',
    fresh: (s: number) => `fresh · stale in ${s}s`,
    stale: (s: number) => `stale for ${s}s`,
    forever: 'no expiry',
  },
  es: {
    hint: 'Pasa el ratón por fetch en la barra de abajo y pulsa un tag. Solo se vuelven a pedir los fetches que lo llevan.',
    fetch: 'Fetch',
    tags: 'Tags',
    fetchedAt: 'Obtenido a las',
    state: 'Caché',
    none: 'ninguno',
    fresh: (s: number) => `fresco · caduca en ${s}s`,
    stale: (s: number) => `caducado hace ${s}s`,
    forever: 'sin caducidad',
  },
}

// A page with three tagged/untagged fetches and the toolbar showing them. Revalidating from the
// toolbar updates the "fetched at" time of exactly the rows it would refetch in a real app.
export function FetchCacheDemo() {
  const locale = useLocale()
  const t = COPY[locale === 'es' ? 'es' : 'en']
  // Times depend on the reader's clock, so they only exist after mount (no hydration mismatch).
  const [rows, setRows] = useState<Row[]>()
  const [now, setNow] = useState(0)

  useEffect(() => {
    const start = Date.now()
    setNow(start)
    setRows(SEED.map(({ ago, ...s }) => ({ ...s, url: `${API}/${s.name}`, storedAt: start - ago * 1000, cacheStatus: 'hit' })))
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const revalidate = (request: RevalidateRequest) => {
    const at = Date.now()
    // revalidatePath refetches every cacheable fetch of the page; revalidateTag only the tagged ones.
    const tags = request.kind === 'tag' ? [request.tag] : request.kind === 'tags' ? request.tags : undefined
    const hit = (r: Row) => (tags ? r.tags.some((t) => tags.includes(t)) : r.revalidate !== undefined)
    setRows((rs) => rs?.map((r) => (hit(r) ? { ...r, storedAt: at, cacheStatus: 'miss', flash: true } : { ...r, cacheStatus: 'hit', flash: false })))
    setTimeout(() => setRows((rs) => rs?.map((r) => ({ ...r, flash: false }))), 1500)
  }

  const insight = useMemo<Insight | undefined>(
    () =>
      rows && {
        requestId: 'fetchcache',
        kind: 'request',
        route: '/products',
        url: '/products',
        startTime: Math.max(...rows.map((r) => r.storedAt)),
        durationMs: 64,
        status: 'ok',
        fetches: rows.map((r) => ({
          url: r.url,
          method: 'GET',
          statusCode: 200,
          durationMs: r.cacheStatus === 'miss' ? 180 : 3,
          cacheStatus: r.cacheStatus,
          cacheReason: r.revalidate ? `revalidate: ${r.revalidate}` : 'revalidate: never',
        })),
      },
    [rows],
  )

  const state = (r: Row) => {
    if (r.revalidate === undefined) return t.forever
    const left = Math.round((r.storedAt + r.revalidate * 1000 - now) / 1000)
    return left > 0 ? t.fresh(left) : t.stale(Math.abs(left))
  }

  return (
    <div className="not-prose my-6 rounded-xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{t.hint}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">{t.fetch}</th>
              <th className="py-2 pr-4 font-medium">{t.tags}</th>
              <th className="py-2 pr-4 font-medium">{t.fetchedAt}</th>
              <th className="py-2 font-medium">{t.state}</th>
            </tr>
          </thead>
          <tbody>
            {SEED.map(({ name, tags }, i) => {
              const r = rows?.[i]
              return (
                <tr key={name} className={`border-t border-border transition-colors duration-700 ${r?.flash ? 'bg-brand-soft' : ''}`}>
                  <td className="py-2 pr-4 font-mono text-xs">GET /{name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-brand-text">
                    {tags.length ? tags.map((tag) => `#${tag}`).join(' ') : <span className="text-muted-foreground">{t.none}</span>}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs tabular-nums">{r ? new Date(r.storedAt).toLocaleTimeString(locale) : '—'}</td>
                  <td className="py-2 text-xs tabular-nums text-muted-foreground">{r ? state(r) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows && insight && (
        <NextToolbarDemo pathname="/products" status={200} timingMs={96} isStatic insights={[insight]} fetchCache={rows} onRevalidate={revalidate} />
      )}
    </div>
  )
}
