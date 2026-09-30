// Fails the build when a file named in package.json "exports" is missing from dist.
// Runs after every build (CI and publish), so a broken tarball never reaches npm again.
import { existsSync, readFileSync } from 'node:fs'

const { exports } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const missing = Object.values(exports)
  .flatMap((entry) => Object.values(entry))
  .filter((file) => !existsSync(new URL(file, import.meta.url)))
if (missing.length) {
  console.error(`Missing from dist: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`exports OK (${Object.keys(exports).length} entries)`)
