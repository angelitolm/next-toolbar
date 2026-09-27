// Render at request time only, so `next build` doesn't fail prerendering it.
export const dynamic = 'force-dynamic'

export default function Boom(): never {
  throw new Error('boom')
}
