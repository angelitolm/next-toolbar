// Route handlers for the toolbar's server side. Mount them in the app:
//
//   // app/api/next-toolbar/route.ts
//   export { GET, POST } from '@angelitolm/next-toolbar/server'
//
// GET: Server Action names and the data cache's fetch entries. POST: revalidatePath / revalidateTag.
import { createHash, timingSafeEqual } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { revalidatePath, revalidateTag } from 'next/cache'
import { ACCESS_COOKIE, actionNames, cookieValue, indexFetchCache, parseFetchCacheEntry, parseRevalidate, SERVER_HEADER, type CachedFetch } from './core'
import { VERSION } from './version'

const notFound = () => new Response(null, { status: 404 })

// Only for requests carrying SERVER_HEADER: browsers won't send a custom header cross-origin without
// a CORS preflight, which this route never answers, so another site open in your browser can't call it.
// And only in `next dev`, or on a staging server that set NEXT_TOOLBAR_SECRET (16+ characters) for
// requests carrying it in the ACCESS_COOKIE cookie.
const MIN_SECRET_LENGTH = 16
const digest = (s: string) => createHash('sha256').update(s).digest()

function allowed(req: Request): boolean {
  if (req.headers.get(SERVER_HEADER) !== '1') return false
  if (process.env.NODE_ENV === 'development') return true
  const secret = process.env.NEXT_TOOLBAR_SECRET
  const sent = cookieValue(req.headers.get('cookie'), ACCESS_COOKIE)
  // Hashing first gives timingSafeEqual equal lengths.
  return !!secret && secret.length >= MIN_SECRET_LENGTH && !!sent && timingSafeEqual(digest(sent), digest(secret))
}

export async function GET(req: Request) {
  if (!allowed(req)) return notFound()
  const [manifests, fetchCache] = await Promise.all([readManifests(), readFetchCache()])
  return Response.json({ version: VERSION, actions: actionNames(manifests), fetchCache: indexFetchCache(fetchCache) })
}

export async function POST(req: Request) {
  if (!allowed(req)) return notFound()
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  const request = parseRevalidate(body)
  if ('error' in request) return Response.json(request, { status: 400 })
  // expire: 0 expires the tag now (Next 16); Next 15's revalidateTag ignores the second argument.
  if (request.kind === 'tag') revalidateTag(request.tag, { expire: 0 })
  else if (request.kind === 'tags') for (const tag of request.tags) revalidateTag(tag, { expire: 0 })
  else revalidatePath(request.path, request.type)
  return Response.json({ ok: true })
}

// Next 15 (webpack) writes .next/server/server-reference-manifest.json; Next 16 writes one per
// route under .next/dev/server (Turbopack) or one in .next/dev/server (webpack).
// ponytail: assumes the default distDir `.next` in the working directory `next dev` runs in.
const DIST = join(process.cwd(), '.next')

async function readManifests(): Promise<unknown[]> {
  const found: unknown[] = []
  await walkFiles([join(DIST, 'server'), join(DIST, 'dev', 'server')], async (path, name) => {
    if (name === 'server-reference-manifest.json') found.push(JSON.parse(await readFile(path, 'utf8')))
  })
  return found
}

// Next's file-system data cache: one JSON file per cached fetch, with the url, tags and revalidate
// that request insights leave out. `next dev` writes .next/dev/cache (16.3+) or .next/cache; `next start` .next/cache.
// ponytail: reads whole files, bodies included; fine for a dev cache, slow if it grows to GBs.
async function readFetchCache(): Promise<CachedFetch[]> {
  const found: CachedFetch[] = []
  const dirs = process.env.NODE_ENV === 'development' ? [join(DIST, 'dev', 'cache', 'fetch-cache'), join(DIST, 'cache', 'fetch-cache')] : [join(DIST, 'cache', 'fetch-cache')]
  await walkFiles(dirs, async (path) => {
    const [text, info] = await Promise.all([readFile(path, 'utf8'), stat(path)])
    const entry = parseFetchCacheEntry(JSON.parse(text), info.mtimeMs)
    if (entry) found.push(entry)
  })
  return found
}

// Calls `onFile` for every file under `dirs`. Missing dirs are skipped, and so are files that
// fail to read or parse: Next may be rewriting them right now, and the next request gets them.
async function walkFiles(dirs: string[], onFile: (path: string, name: string) => Promise<void>): Promise<void> {
  const walk = async (dir: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return walk(path)
        try {
          await onFile(path, entry.name)
        } catch {}
      }),
    )
  }
  await Promise.all(dirs.map(walk))
}
