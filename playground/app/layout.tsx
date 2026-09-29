import Link from 'next/link'
import { NextToolbar } from '@angelitolm/next-toolbar'

const links = ['/', '/dynamic', '/isr', '/cache', '/blog/hola', '/boom', '/nope', '/client-error', '/actions', '/links']

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {links.map((href) => (
            <Link key={href} href={href}>
              {href}
            </Link>
          ))}
        </nav>
        {children}
        <NextToolbar />
      </body>
    </html>
  )
}
