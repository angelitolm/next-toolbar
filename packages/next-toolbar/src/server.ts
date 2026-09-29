// Route handlers for the toolbar's server side. Mount them in the app:
//
//   // app/api/next-toolbar/route.ts
//   export { GET, POST } from '@angelitolm/next-toolbar/server'
//
// GET: Server Action names. POST: revalidatePath / revalidateTag.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { revalidatePath, revalidateTag } from 'next/cache'
import { actionNames, parseRevalidate, SERVER_HEADER } from './core'
import { VERSION } from './version'

const notFound = () => new Response(null, { status: 404 })

// Only in `next dev`, and only for requests carrying SERVER_HEADER. Browsers won't send a custom
// header cross-origin without a CORS preflight, which this route never answers, so another site
// open in your browser can't call it.
const allowed = (req: Request) => process.env.NODE_ENV === 'development' && req.headers.get(SERVER_HEADER) === '1'

export async function GET(req: Request) {
  if (!allowed(req)) return notFound()
  return Response.json({ version: VERSION, actions: actionNames(await readManifests()) })
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
  else revalidatePath(request.path, request.type)
  return Response.json({ ok: true })
}

// Next 15 (webpack) writes .next/server/server-reference-manifest.json; Next 16 writes one per
// route under .next/dev/server (Turbopack) or one in .next/dev/server (webpack).
// ponytail: assumes the default distDir `.next` in the working directory `next dev` runs in.
async function readManifests(): Promise<unknown[]> {
  const found: unknown[] = []
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
        if (entry.name !== 'server-reference-manifest.json') return
        try {
          found.push(JSON.parse(await readFile(path, 'utf8')))
        } catch {} // being rewritten by the compiler right now; the next request gets it
      }),
    )
  }
  const dist = join(process.cwd(), '.next')
  await Promise.all([walk(join(dist, 'server')), walk(join(dist, 'dev', 'server'))])
  return found
}
