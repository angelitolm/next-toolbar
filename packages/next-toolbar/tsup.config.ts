import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Directive must survive bundling so the App Router treats this as a client component.
  banner: { js: "'use client';" },
  // The toolbar shows its own version, read from package.json at build time.
  define: { __NEXT_TOOLBAR_VERSION__: JSON.stringify(version) },
})
