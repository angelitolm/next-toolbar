export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return Response.json({ now: new Date().toISOString(), q: new URL(request.url).search })
}
