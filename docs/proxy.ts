import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // `\\.` so the regex gets a literal dot: in a plain string `\.` is just `.`, and the
  // lookahead `.*..*` then excluded every path except `/`.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
