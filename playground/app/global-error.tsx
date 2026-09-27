'use client'
import { NextToolbar } from '@angelitolm/next-toolbar'

// Replaces the root layout when an error isn't caught by an error.tsx.
// Rendering the toolbar here keeps it on screen for exactly the crashes you want to debug.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
        <p>{error.digest ? `Digest: ${error.digest}` : error.message}</p>
        <NextToolbar />
      </body>
    </html>
  )
}
