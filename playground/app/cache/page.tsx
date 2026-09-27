// Fetch targets the local API (no outbound network needed). Port matches `pnpm dev`.
const api = 'http://localhost:3100/api/time'

async function get(query: string, init: RequestInit) {
  const res = await fetch(`${api}?${query}`, init)
  return (await res.json()).now as string
}

export default async function Cache() {
  const [forced, revalidated, fresh] = await Promise.all([
    get('forced', { cache: 'force-cache' }),
    get('revalidated', { next: { revalidate: 30 } }),
    get('fresh', { cache: 'no-store' }),
  ])
  return (
    <ul>
      <li>force-cache: {forced}</li>
      <li>revalidate 30: {revalidated}</li>
      <li>no-store: {fresh}</li>
    </ul>
  )
}
