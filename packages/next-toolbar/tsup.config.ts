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
    entry: ['src/index.ts'],
    clean: true,
    // Directive must survive bundling so the App Router treats this as a client component.
    banner: { js: "'use client';" },
  },
  // Route handlers: server only, so no 'use client' banner.
  { ...shared, entry: ['src/server.ts'], platform: 'node' },
])
