import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

const shared = {
  format: ['esm'] as const,
  dts: true,
  // The toolbar shows its own version, read from package.json at build time.
  define: { __NEXT_TOOLBAR_VERSION__: JSON.stringify(version) },
}

export default defineConfig([
  {
    ...shared,
    // The demo is its own entry: from the root it would statically import the toolbar, and the root's
    // lazy import of it would land in every production bundle.
    entry: ['src/index.ts', 'src/Demo.tsx'],
    // No `clean` here: the configs build in parallel, and cleaning in one deleted the other's
    // server.d.ts (0.6.0 shipped without it). The build script empties dist first instead.
    // Directive must survive bundling so the App Router treats this as a client component.
    banner: { js: "'use client';" },
  },
  // Route handlers: server only, so no 'use client' banner.
  { ...shared, entry: ['src/server.ts'], platform: 'node' },
])
