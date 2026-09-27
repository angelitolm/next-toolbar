import { headers } from 'next/headers'

export default async function Dynamic() {
  const ua = (await headers()).get('user-agent')
  return <h1>Dynamic: {ua}</h1>
}
