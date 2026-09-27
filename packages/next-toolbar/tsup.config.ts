import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Directive must survive bundling so the App Router treats this as a client component.
  banner: { js: "'use client';" },
})
