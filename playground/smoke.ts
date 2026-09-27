// Smoke test against the installed Next version: starts `next dev`, opens the HMR
// socket the toolbar would open and checks the messages it relies on still arrive
// in a shape the toolbar's own parser (core.ts) understands.
// Run: pnpm --filter playground smoke
import { spawn, execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { alternateHmrPath, hmrPath, parseHmr, supportsRequestInsights, type Insight } from '../packages/next-toolbar/src/core.ts'

const PORT = 3199
const BASE = `http://localhost:${PORT}`
const version: string = JSON.parse(readFileSync(new URL('./node_modules/next/package.json', import.meta.url), 'utf8')).version
const wantInsights = supportsRequestInsights(version)
console.log(`next ${version}, expecting ${wantInsights ? 'manifest + request insights' : 'manifest'}`)

const posix = process.platform !== 'win32'
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', String(PORT)], {
  cwd: new URL('.', import.meta.url),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'inherit', 'inherit'],
  detached: posix, // own process group, so the kill below also takes Next's workers
})
const stop = () => {
  try {
    if (posix) process.kill(-server.pid!, 'SIGKILL')
    else execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' })
  } catch {}
}
const fail = (msg: string) => {
  console.error(`SMOKE FAIL (next ${version}): ${msg}`)
  stop()
  process.exit(1)
}
setTimeout(() => fail('timed out after 180s'), 180_000).unref()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const visit = async (path: string) => {
  const res = await fetch(BASE + path)
  await res.text()
  if (!res.ok) fail(`GET ${path} -> ${res.status}`)
}

for (let up = false; !up; await sleep(500)) {
  up = await fetch(BASE).then(() => true, () => false)
}
// Compile both pages first so the manifest sent on connect already knows them.
await visit('/')
await visit('/dynamic')

// Same fallback as the toolbar: expected endpoint for this version, then the other one.
const connect = (path: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}${path}`)
    ws.onopen = () => resolve(ws)
    ws.onerror = () => reject(new Error(path))
  })
const path = hmrPath(version)
const ws = await connect(path).catch(() => connect(alternateHmrPath(path))).catch(() => fail('no HMR socket on /_next/hmr or /_next/webpack-hmr'))
console.log(`connected to ${new URL(ws!.url).pathname}`)

const manifest: Record<string, boolean> = {}
const insights: Insight[] = []
ws!.onmessage = (e) => {
  const ev = parseHmr(e.data)
  if (ev?.kind === 'manifest') Object.assign(manifest, ev.data)
  if (ev?.kind === 'insights') insights.push(...ev.list)
}

await visit('/')
await visit('/dynamic')
const done = () => manifest['/'] !== undefined && (!wantInsights || insights.some((i) => i.route === '/dynamic'))
for (let i = 0; i < 60 && !done(); i++) await sleep(500)

if (manifest['/'] !== true) fail(`manifest should mark / static, got ${JSON.stringify(manifest)}`)
// 16 writes false for dynamic routes, 15.5 leaves them out; either way never true.
if (manifest['/dynamic'] === true) fail('manifest marks /dynamic static')
if (wantInsights && !insights.some((i) => i.route === '/dynamic')) fail(`no request insight for /dynamic (got ${insights.length} insights)`)

console.log(`SMOKE OK (next ${version}): manifest ${JSON.stringify(manifest)}${wantInsights ? `, ${insights.length} insights` : ''}`)
ws!.close()
stop()
process.exit(0)
