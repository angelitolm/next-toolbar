import Link from 'next/link'

// One link per outcome the toolbar's link check can report.
const links = [
  ['/blog/hola', 'ok page'],
  ['/dynamic', 'ok dynamic page'],
  ['/api/time', 'route handler'],
  ['/old', 'redirects to /'],
  ['/boom', 'throws (500)'],
  ['/nope', 'missing (404)'],
  ['/blog/hola#top', 'same page as the first, with a hash'],
  ['https://nextjs.org', 'external, skipped'],
]

export default function Links() {
  return (
    <>
      <h1>Links</h1>
      <ul>
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href}>{href}</Link> — {label}
          </li>
        ))}
      </ul>
    </>
  )
}
