import { lazy, Suspense, useEffect, useState } from 'react'
import { ACCESS_COOKIE, SERVER_HEADER, SERVER_ROUTE } from './core'
import type { NextToolbarProps } from './NextToolbar'

const dev = process.env.NODE_ENV === 'development'
// Inlined by Next's bundler (define-env) for every module, packages included.
const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH || ''
// Its own chunk: a production page downloads it only after the server route lets this browser in.
const LiveToolbar = lazy(() => import('./NextToolbar').then((m) => ({ default: m.LiveToolbar })))

/**
 * The toolbar. In `next dev` it always shows. In a production build it shows only when the server sets
 * NEXT_TOOLBAR_SECRET, mounts the server route, and the browser carries the secret in the `next-toolbar`
 * cookie (self-hosted staging for QA).
 */
export function NextToolbar({ theme = 'system', securityCheck = true }: NextToolbarProps = {}) {
  const [allowed, setAllowed] = useState(dev)
  useEffect(() => {
    // Production: only a browser holding the access cookie asks the server; every other visitor makes no request.
    if (dev || !document.cookie.split('; ').some((c) => c.startsWith(`${ACCESS_COOKIE}=`))) return
    fetch(BASE_PATH + SERVER_ROUTE, { headers: { [SERVER_HEADER]: '1' }, cache: 'no-store' }).then(
      (r) => setAllowed(r.ok),
      () => {},
    )
  }, [])
  if (!allowed) return null
  return (
    <Suspense>
      <LiveToolbar defaultTheme={theme} securityCheck={securityCheck} />
    </Suspense>
  )
}
